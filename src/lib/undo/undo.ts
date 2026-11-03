import "server-only";
import type { Prisma } from "@prisma/client";
import { basePrisma } from "@/lib/prisma-base";
import { getCurrentUser } from "@/lib/auth";
import { undoStore, type UndoContext, type UndoOp } from "@/lib/undo/context";
import { decodeValue, sameValue } from "@/lib/undo/codec";
import { delegateName, primaryKey, UNDO_WINDOW_MS } from "@/lib/undo/models";
import { restoreSnapshot, type Snapshot } from "@/lib/undo/snapshot";

// ביטול פעולה (stage 5b). Every changing Server Action runs inside
// withUndo(label, ...): its writes are recorded by the Prisma extension
// (src/lib/undo/extension.ts) and the result carries `undo: { id, label }`,
// which the client shows as a toast with "בטל" for ~8 seconds.

export type UndoInfo = { id: string; label: string };

/**
 * Runs a Server Action body and records what it changed. Nothing changed, or
 * the action returned an error: no undo. Deletes inside it go to the
 * recycle bin either way.
 */
export async function withUndo<T>(label: string, fn: () => Promise<T>): Promise<T & { undo?: UndoInfo }> {
  const user = await getCurrentUser().catch(() => null);
  const ctx: UndoContext = { userId: user?.id ?? null, ops: [], closed: false };
  let result: T;
  try {
    // Awaited inside the context: Prisma queries only run when awaited.
    result = await undoStore.run(ctx, async () => await fn());
  } finally {
    ctx.closed = true;
  }
  const out = (result ?? {}) as T & { undo?: UndoInfo };
  if (!ctx.ops.length || (out as { error?: unknown }).error) return out;
  const entry = await basePrisma.undoEntry.create({
    data: {
      userId: ctx.userId,
      label,
      ops: ctx.ops as unknown as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + UNDO_WINDOW_MS),
    },
    select: { id: true },
  });
  return { ...out, undo: { id: entry.id, label } };
}

/** Runs without recording (e.g. writing Google calendar ids after a save). */
export function untracked<T>(fn: () => Promise<T>): Promise<T> {
  return undoStore.run(null, async () => await fn());
}

// ---------------------------------------------------------------------------

type Tx = Prisma.TransactionClient;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const delegate = (db: Tx, model: string) => (db as any)[delegateName(model)];

/** What has to happen in Google Calendar after an undo / restore. */
type Effects = {
  pushMeetings: Set<string>;
  removeMeetingEvents: { ownerId: string; eventId: string }[];
  syncInspections: Set<string>;
  removeInspectionEvents: { userId: string; eventId: string }[];
};
const noEffects = (): Effects => ({
  pushMeetings: new Set(),
  removeMeetingEvents: [],
  syncInspections: new Set(),
  removeInspectionEvents: [],
});

/** A restored meeting is written to Google again as a new event (the old one was deleted there). */
function restoreTransform(effects: Effects) {
  return (model: string, row: Record<string, unknown>) => {
    if (model === "Meeting") {
      effects.pushMeetings.add(String(row.id));
      return { ...row, googleEventId: null, googleKey: null, googleUpdated: null, googleSyncPending: !row.readOnly, googleSyncError: null };
    }
    if (model === "Inspection") effects.syncInspections.add(String(row.id));
    return row;
  };
}

async function restoreTrashInTx(tx: Tx, trashId: string, effects: Effects) {
  const item = await tx.trashItem.findUnique({ where: { id: trashId } });
  if (!item) return { ok: false as const, error: "הפריט כבר לא בסל המחזור" };
  await restoreSnapshot(tx, item.snapshot as unknown as Snapshot, restoreTransform(effects));
  await tx.trashItem.delete({ where: { id: trashId } });
  return { ok: true as const };
}

function restoreError(e: unknown) {
  const code = (e as { code?: string })?.code;
  if (code === "P2003") return "אי אפשר לשחזר: הפריט שייך לפריט אחר שנמחק (למשל פרויקט). יש לשחזר אותו קודם.";
  if (code === "P2002") return "אי אפשר לשחזר: כבר קיים פריט זהה.";
  return "השחזור נכשל. נסו שוב.";
}

async function runEffects(effects: Effects) {
  if (!effects.pushMeetings.size && !effects.removeMeetingEvents.length && !effects.syncInspections.size && !effects.removeInspectionEvents.length) {
    return;
  }
  // Loaded only when needed (Google client).
  const sync = await import("@/lib/google/calendar-sync");
  await untracked(async () => {
    for (const e of effects.removeMeetingEvents) await sync.deleteMeetingEvent(e.ownerId, e.eventId).catch(() => {});
    for (const e of effects.removeInspectionEvents) await sync.removeInspectionEvent(e.userId, e.eventId).catch(() => {});
    for (const id of effects.pushMeetings) {
      await basePrisma.meeting.updateMany({ where: { id, readOnly: false }, data: { googleSyncPending: true } });
      await sync.pushMeeting(id).catch(() => {});
    }
    for (const id of effects.syncInspections) await sync.syncInspectionEventSafely(id);
  });
}

/**
 * "בטל": reverses an action, last change first, in one transaction. A field
 * that someone changed again since is left as it is now.
 */
export async function performUndo(entryId: string, userId: string): Promise<{ ok: true; partial: boolean } | { ok: false; error: string }> {
  const entry = await basePrisma.undoEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== userId) return { ok: false, error: "אין מה לבטל" };
  if (entry.undoneAt) return { ok: false, error: "הפעולה כבר בוטלה" };
  if (entry.expiresAt < new Date()) return { ok: false, error: "עבר יותר מדי זמן. אפשר לשחזר פריטים שנמחקו מסל המחזור בהגדרות." };

  // Claim it first, so a double click can't undo twice.
  const claimed = await basePrisma.undoEntry.updateMany({ where: { id: entryId, undoneAt: null }, data: { undoneAt: new Date() } });
  if (!claimed.count) return { ok: false, error: "הפעולה כבר בוטלה" };

  const ops = [...(entry.ops as unknown as UndoOp[])].reverse();
  const effects = noEffects();
  let partial = false;
  try {
    await basePrisma.$transaction(
      async (tx) => {
        for (const op of ops) {
          if (op.t === "create") {
            const pk = primaryKey(op.model);
            const row = await delegate(tx, op.model).findUnique({ where: { [pk]: op.id } });
            if (!row) continue; // already gone
            if (op.model === "Meeting" && row.googleEventId && row.ownerId) {
              effects.removeMeetingEvents.push({ ownerId: row.ownerId, eventId: row.googleEventId });
            }
            if (op.model === "Inspection" && row.googleEventId && row.googleEventUserId) {
              effects.removeInspectionEvents.push({ userId: row.googleEventUserId, eventId: row.googleEventId });
            }
            await delegate(tx, op.model).delete({ where: { [pk]: op.id } });
          } else if (op.t === "update") {
            const pk = primaryKey(op.model);
            const current = await delegate(tx, op.model).findUnique({ where: { [pk]: op.id } });
            if (!current) {
              partial = true;
              continue;
            }
            const data: Record<string, unknown> = {};
            for (const [field, before] of Object.entries(op.before)) {
              if (sameValue(current[field], decodeValue(op.after[field]))) data[field] = decodeValue(before);
              else partial = true; // changed again since - keep the newer value
            }
            if (Object.keys(data).length) await delegate(tx, op.model).update({ where: { [pk]: op.id }, data });
            if (op.model === "Meeting") effects.pushMeetings.add(op.id);
            if (op.model === "Inspection") effects.syncInspections.add(op.id);
          } else {
            const r = await restoreTrashInTx(tx, op.trashId, effects);
            if (!r.ok) partial = true;
          }
        }
      },
      { timeout: 20_000, maxWait: 10_000 }
    );
  } catch (e) {
    await basePrisma.undoEntry.update({ where: { id: entryId }, data: { undoneAt: null } }).catch(() => {});
    console.error(`[undo] failed entry=${entryId}: ${(e as Error)?.message?.split("\n")[0]}`);
    return { ok: false, error: restoreError(e) };
  }
  await runEffects(effects);
  return { ok: true, partial };
}

/** "שחזור" from the recycle bin. */
export async function restoreTrashItem(trashId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const effects = noEffects();
  try {
    const r = await basePrisma.$transaction((tx) => restoreTrashInTx(tx, trashId, effects), { timeout: 20_000, maxWait: 10_000 });
    if (!r.ok) return r;
  } catch (e) {
    console.error(`[trash] restore failed item=${trashId}: ${(e as Error)?.message?.split("\n")[0]}`);
    return { ok: false, error: restoreError(e) };
  }
  await runEffects(effects);
  return { ok: true };
}

/** Deletes for good: recycle-bin items past their 30 days, and old undo records. */
export async function purgeExpired() {
  const now = new Date();
  const [trash, undo] = await Promise.all([
    basePrisma.trashItem.deleteMany({ where: { purgeAfter: { lt: now } } }),
    basePrisma.undoEntry.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } }),
  ]);
  return { trash: trash.count, undo: undo.count };
}
