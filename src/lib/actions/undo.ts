"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { basePrisma } from "@/lib/prisma-base";
import { performUndo, purgeExpired, restoreTrashItem } from "@/lib/undo/undo";
import type { ActionState } from "@/lib/actions/tasks";

// "בטל" in the toast, and the recycle bin in Settings (stage 5b).

export async function undoAction(entryId: string): Promise<ActionState & { partial?: boolean }> {
  const user = await requireUser();
  const result = await performUndo(entryId, user.id);
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  return { ok: true, ts: Date.now(), partial: result.partial };
}

export async function restoreFromTrash(trashId: string): Promise<ActionState> {
  await requireUser();
  const result = await restoreTrashItem(trashId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  return { ok: true, ts: Date.now() };
}

/** "מחיקה סופית": no way back. */
export async function deleteFromTrash(trashId: string): Promise<ActionState> {
  await requireUser();
  await basePrisma.trashItem.deleteMany({ where: { id: trashId } });
  revalidatePath("/settings/trash");
  return { ok: true, ts: Date.now() };
}

/** "ריקון הסל": deletes for good everything in the recycle bin. */
export async function emptyTrash(): Promise<ActionState> {
  await requireUser();
  await basePrisma.trashItem.deleteMany({ where: { visible: true } });
  await purgeExpired();
  revalidatePath("/settings/trash");
  return { ok: true, ts: Date.now() };
}
