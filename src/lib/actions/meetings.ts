"use server";

import { untracked, withUndo } from "@/lib/undo/undo";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/actions/tasks";
import { parseIsraelDateTime } from "@/lib/israel-time";
import {
  deleteMeetingEvent,
  pushMeeting,
  syncAccount,
} from "@/lib/google/calendar-sync";

export type { ActionState };

function toOptionalString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str || null;
}

async function readMeetingFields(formData: FormData, currentUserId: string) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "יש להזין כותרת לפגישה" } as const;

  // datetime-local values are wall-clock times in Israel (the server runs in UTC).
  const startTime = parseIsraelDateTime(String(formData.get("startTime") ?? ""));
  const endTime = parseIsraelDateTime(String(formData.get("endTime") ?? ""));
  if (!startTime || !endTime) {
    return { error: "יש להזין תאריך ושעת התחלה וסיום" } as const;
  }
  if (endTime <= startTime) {
    return { error: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" } as const;
  }

  // Whose calendar it goes to (SPEC §2.2): Ron or Guy, by default the one saving it.
  const ownerIdIn = toOptionalString(formData.get("ownerId")) ?? currentUserId;
  const owner = await prisma.user.findFirst({
    where: { id: ownerIdIn, role: "PARTNER" },
    select: { id: true },
  });
  if (!owner) return { error: "יש לבחור של מי הפגישה" } as const;

  return {
    title,
    startTime,
    endTime,
    description: toOptionalString(formData.get("description")),
    location: toOptionalString(formData.get("location")),
    ownerId: owner.id,
    withPartner: formData.get("withPartner") === "on",
  } as const;
}

function revalidate() {
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

/**
 * Saved in the system first; Google is written right after. A failure
 * leaves the meeting marked "not yet in Google" and the cron retries it.
 */
async function writeToGoogle(meetingId: string) {
  await untracked(() => pushMeeting(meetingId)).catch(() => {});
}

export async function createMeeting(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return withUndo("הפגישה נקבעה", async () => {
    const user = await requireUser();

    const fields = await readMeetingFields(formData, user.id);
    if ("error" in fields) return fields;

    const meeting = await prisma.meeting.create({
      data: { ...fields, createdById: user.id, googleSyncPending: true },
    });
    await writeToGoogle(meeting.id);

    revalidate();
    return { ok: true, ts: Date.now() };
  });
}

// Used from a lead's task list to schedule + link a meeting in one step
// (e.g. a "קביעת פגישה עם אדריכלים" task).
export async function createMeetingForLeadTask(
  leadTaskId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return withUndo("הפגישה נקבעה", async () => {
    const user = await requireUser();

    const fields = await readMeetingFields(formData, user.id);
    if ("error" in fields) return fields;

    const leadTask = await prisma.leadTask.findUnique({
      where: { id: leadTaskId },
    });
    if (!leadTask) return { error: "המשימה לא נמצאה" };

    const meeting = await prisma.meeting.create({
      data: { ...fields, createdById: user.id, googleSyncPending: true },
    });
    await prisma.leadTask.update({
      where: { id: leadTaskId },
      data: { meetingId: meeting.id },
    });
    await writeToGoogle(meeting.id);

    revalidate();
    revalidatePath(`/business-dev/${leadTask.leadId}`);
    return { ok: true, ts: Date.now() };
  });
}

export async function updateMeeting(
  meetingId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return withUndo("הפגישה עודכנה", async () => {
    const user = await requireUser();

    const existing = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!existing) return { error: "הפגישה לא נמצאה" };
    if (existing.readOnly) {
      return { error: "את הפגישה הזו עורכים ביומן Google (הוזמנתם אליה, או שהיא פרטית / של יום שלם)." };
    }

    const fields = await readMeetingFields(formData, existing.ownerId ?? user.id);
    if ("error" in fields) return fields;

    // Moved to the other partner: removed from the old owner's calendar first.
    const ownerChanged = existing.ownerId && existing.ownerId !== fields.ownerId;
    if (ownerChanged && existing.googleEventId) {
      const removed = await deleteMeetingEvent(existing.ownerId!, existing.googleEventId);
      if (!removed) return { error: "לא הצלחנו להעביר את הפגישה ביומן Google. נסו שוב." };
    }

    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        ...fields,
        googleSyncPending: true,
        ...(ownerChanged ? { googleEventId: null, googleKey: null, googleUpdated: null } : {}),
      },
    });
    await writeToGoogle(meetingId);

    revalidate();
    return { ok: true, ts: Date.now() };
  });
}

export async function deleteMeeting(meetingId: string): Promise<ActionState> {
  return withUndo("הפגישה נמחקה", async () => {
    await requireUser();
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) return { ok: true, ts: Date.now() };
    if (meeting.readOnly) {
      return { error: "את הפגישה הזו מוחקים ביומן Google." };
    }
    if (meeting.ownerId && meeting.googleEventId) {
      const removed = await deleteMeetingEvent(meeting.ownerId, meeting.googleEventId);
      if (!removed) return { error: "לא הצלחנו למחוק את הפגישה מיומן Google. נסו שוב." };
    }
    await prisma.meeting.delete({ where: { id: meetingId } });
    revalidate();
    return { ok: true, ts: Date.now() };
  });
}

/** "סנכרון עכשיו": reads both partners' calendars right away. */
export async function syncCalendarsNow(): Promise<ActionState> {
  await requireUser();
  const accounts = await prisma.googleAccount.findMany({ select: { userId: true } });
  const results = await Promise.all(accounts.map((a) => syncAccount(a.userId)));
  revalidate();
  revalidatePath("/settings");
  if (results.includes("error")) return { error: "הסנכרון נכשל לאחד היומנים. הפרטים מופיעים בהגדרות." };
  return { ok: true, ts: Date.now() };
}
