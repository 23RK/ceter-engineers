"use server";

import { revalidatePath } from "next/cache";
import { requirePartner } from "@/lib/auth";
import { isGoogleConfigured, disconnectGoogleAccount } from "@/lib/google/oauth";
import { pullGoogleUpdates } from "@/lib/google/sync";
import type { ActionState } from "@/lib/actions/tasks";

export type { ActionState };

/** Manual "רענון מיומן Google" button on the calendar page. */
// The params match the (prevState, formData) signature useActionState
// requires, even though this action ignores both.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function syncFromGoogleAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requirePartner();
  if (!isGoogleConfigured()) {
    return { error: "חיבור ל-Google Calendar עדיין לא הוגדר" };
  }
  await pullGoogleUpdates();
  revalidatePath("/calendar");
  return { ok: true, ts: Date.now() };
}

/** A partner can only disconnect their own Google account. */
export async function disconnectGoogleAction() {
  const partner = await requirePartner();
  await disconnectGoogleAccount(partner.id);
  revalidatePath("/calendar");
}
