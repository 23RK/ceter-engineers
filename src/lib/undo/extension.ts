import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { activeContext } from "@/lib/undo/context";
import { changedFields, plainData } from "@/lib/undo/codec";
import {
  delegateName,
  HIDDEN_TRASH_HOURS,
  IGNORED_FIELDS,
  isTracked,
  primaryKey,
  scalarFields,
  TRASH_DAYS,
  trashKind,
} from "@/lib/undo/models";
import { collectSnapshot } from "@/lib/undo/snapshot";

// Records every write made inside withUndo() (src/lib/undo/undo.ts), so any
// Server Action can be undone without its own undo code:
//  - create:  the new row's id (undo deletes it)
//  - update:  the changed columns, before and after (undo puts them back)
//  - delete:  the row and everything deleted with it go to the recycle bin
//             (TrashItem); undo / "שחזור" re-inserts them.
// Outside withUndo() (calendar sync, login, ...) writes run as usual.
// Reads made here use the plain client, so they are never recorded.

type Args = Record<string, unknown> & { where?: Record<string, unknown>; data?: Record<string, unknown> };
type Row = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDelegate = any;

export function undoTracking(base: PrismaClient) {
  const d = (model: string): AnyDelegate => (base as AnyDelegate)[delegateName(model)];

  async function contextOf(rootModel: string, row: Row): Promise<string | null> {
    try {
      if (typeof row.projectId === "string" && rootModel !== "Project") {
        return (await base.project.findUnique({ where: { id: row.projectId }, select: { name: true } }))?.name ?? null;
      }
      if (rootModel === "LeadTask" && typeof row.leadId === "string") {
        return (await base.lead.findUnique({ where: { id: row.leadId }, select: { name: true } }))?.name ?? null;
      }
      if (rootModel === "InspectorRate" && typeof row.inspectorId === "string") {
        return (await base.inspector.findUnique({ where: { id: row.inspectorId }, select: { name: true } }))?.name ?? null;
      }
    } catch {
      // only a description
    }
    return null;
  }

  async function titleOf(model: string, row: Row) {
    if (model === "ProjectContact" && typeof row.contactId === "string") {
      const c = await base.contact.findUnique({ where: { id: row.contactId }, select: { name: true } });
      if (c) return c.name;
    }
    return trashKind(model).title(row) || trashKind(model).kind;
  }

  /** Moves rows (and their cascade) to the recycle bin, then lets the delete run. */
  async function trashThenDelete(model: string, rows: Row[], userId: string | null, run: () => Promise<unknown>) {
    const pk = primaryKey(model);
    const snapshots = [];
    for (const row of rows) snapshots.push({ row, snapshot: await collectSnapshot(base, model, [String(row[pk])]) });
    const result = await run();
    const ctx = activeContext();
    const kind = trashKind(model);
    const now = Date.now();
    for (const { row, snapshot } of snapshots) {
      const item = await base.trashItem.create({
        data: {
          model,
          rootId: String(row[pk]),
          kind: kind.kind,
          title: (await titleOf(model, row)).slice(0, 200),
          context: await contextOf(model, row),
          visible: kind.visible,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          deletedById: userId,
          purgeAfter: new Date(now + (kind.visible ? TRASH_DAYS * 24 : HIDDEN_TRASH_HOURS) * 3600_000),
        },
        select: { id: true },
      });
      ctx?.ops.push({ t: "trash", trashId: item.id });
    }
    return result;
  }

  return Prisma.defineExtension({
    name: "undo-tracking",
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const ctx = activeContext();
          const result = (await query(args)) as Row;
          if (ctx && isTracked(model)) {
            const id = result?.[primaryKey(model)];
            if (id != null) ctx.ops.push({ t: "create", model, id: String(id) });
          }
          return result;
        },

        async createMany({ model, args, query }) {
          const ctx = activeContext();
          if (!ctx || !isTracked(model)) return query(args);
          // Ids are given up front (where the table generates them), so the
          // insert itself stays Prisma's own - inside the caller's transaction.
          const pk = primaryKey(model);
          const a = args as Args & { data: Row | Row[] };
          const rows = (Array.isArray(a.data) ? a.data : [a.data]).map((r) => (r[pk] == null ? { ...r, [pk]: randomUUID() } : r));
          const result = await query({ ...a, data: rows } as typeof args);
          for (const r of rows) ctx.ops.push({ t: "create", model, id: String(r[pk]) });
          return result;
        },

        async update({ model, args, query }) {
          const ctx = activeContext();
          if (!ctx || !isTracked(model)) return query(args);
          const a = args as Args;
          const before: Row | null = await d(model).findUnique({ where: a.where });
          const result = (await query(args)) as Row;
          if (before) {
            // The update's own result has the new values; fall back to `data`
            // for columns a `select` left out.
            const after = { ...plainData(a.data, scalarFields(model)), ...(result ?? {}) };
            const diff = changedFields(before, after, IGNORED_FIELDS);
            if (diff) ctx.ops.push({ t: "update", model, id: String(before[primaryKey(model)]), ...diff });
          }
          return result;
        },

        async updateMany({ model, args, query }) {
          const ctx = activeContext();
          if (!ctx || !isTracked(model)) return query(args);
          const a = args as Args;
          const before: Row[] = await d(model).findMany({ where: a.where });
          const result = await query(args);
          const data = plainData(a.data, scalarFields(model));
          const pk = primaryKey(model);
          for (const row of before) {
            const diff = changedFields(row, data, IGNORED_FIELDS);
            if (diff) ctx.ops.push({ t: "update", model, id: String(row[pk]), ...diff });
          }
          return result;
        },

        async upsert({ model, args, query }) {
          const ctx = activeContext();
          if (!ctx || !isTracked(model)) return query(args);
          const a = args as Args & { update?: Record<string, unknown> };
          const before: Row | null = await d(model).findUnique({ where: a.where });
          const result = (await query(args)) as Row;
          const pk = primaryKey(model);
          if (!before) {
            if (result?.[pk] != null) ctx.ops.push({ t: "create", model, id: String(result[pk]) });
          } else {
            const after = { ...plainData(a.update, scalarFields(model)), ...(result ?? {}) };
            const diff = changedFields(before, after, IGNORED_FIELDS);
            if (diff) ctx.ops.push({ t: "update", model, id: String(before[pk]), ...diff });
          }
          return result;
        },

        async delete({ model, args, query }) {
          const ctx = activeContext();
          if (!ctx || !isTracked(model)) return query(args);
          const row: Row | null = await d(model).findUnique({ where: (args as Args).where });
          if (!row) return query(args); // let Prisma raise "not found"
          return trashThenDelete(model, [row], ctx.userId, () => query(args));
        },

        async deleteMany({ model, args, query }) {
          const ctx = activeContext();
          if (!ctx || !isTracked(model)) return query(args);
          const rows: Row[] = await d(model).findMany({ where: (args as Args).where });
          if (!rows.length) return query(args);
          return trashThenDelete(model, rows, ctx.userId, () => query(args));
        },
      },
    },
  });
}
