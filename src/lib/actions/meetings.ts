"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/auth";
import { isGoogleConfigured } from "@/lib/google/oauth";
import {
  deleteMeetingFromGoogleForAll,
  pushMeetingToAllConnectedPartners,
} from "@/lib/google/calendar";
import type { ActionState } from "@/lib/actions/tasks";

export type { ActionState };

function toOptionalString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str || null;
}

function toDate(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? new Date(str) : null;
}

function readMeetingFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "יש להזין כותרת לפגישה" } as const;

  const startTime = toDate(formData.get("startTime"));
  const endTime = toDate(formData.get("endTime"));
  if (!startTime || !endTime) {
    return { error: "יש להזין תאריך ושעת התחלה וסיום" } as const;
  }
  if (endTime <= startTime) {
    return { error: "שעת הסיום חייבת להיות אחרי שעת ההתחלה" } as const;
  }

  return {
    title,
    startTime,
    endTime,
    description: toOptionalString(formData.get("description")),
    location: toOptionalString(formData.get("location")),
  } as const;
}

// Push is best-effort and never blocks the save - if Google isn't
// configured yet, or a partner isn't connected, this just no-ops.
async function pushToGoogle(meeting: { id: string }) {
  if (!isGoogleConfigured()) return;
  const full = await prisma.meeting.findUnique({ where: { id: meeting.id } });
  if (full) await pushMeetingToAllConnectedPartners(full);
}

export async function createMeeting(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePartner();

  const fields = readMeetingFields(formData);
  if ("error" in fields) return fields;

  const meeting = await prisma.meeting.create({
    data: { ...fields, createdById: user.id },
  });
  await pushToGoogle(meeting);

  revalidatePath("/calendar");
  return { ok: true, ts: Date.now() };
}

// Used from a lead's task list to schedule + link a meeting in one step
// (e.g. a "קביעת פגישה עם אדריכלים" task).
export async function createMeetingForLeadTask(
  leadTaskId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePartner();

  const fields = readMeetingFields(formData);
  if ("error" in fields) return fields;

  const leadTask = await prisma.leadTask.findUnique({
    where: { id: leadTaskId },
  });
  if (!leadTask) return { error: "המשימה לא נמצאה" };

  const meeting = await prisma.meeting.create({
    data: { ...fields, createdById: user.id },
  });
  await prisma.leadTask.update({
    where: { id: leadTaskId },
    data: { meetingId: meeting.id },
  });
  await pushToGoogle(meeting);

  revalidatePath("/calendar");
  revalidatePath(`/business-dev/${leadTask.leadId}`);
  return { ok: true, ts: Date.now() };
}

export async function updateMeeting(
  meetingId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePartner();

  const fields = readMeetingFields(formData);
  if ("error" in fields) return fields;

  const meeting = await prisma.meeting.update({
    where: { id: meetingId },
    data: fields,
  });
  await pushToGoogle(meeting);

  revalidatePath("/calendar");
  return { ok: true, ts: Date.now() };
}

export async function deleteMeeting(meetingId: string) {
  await requirePartner();
  if (isGoogleConfigured()) {
    await deleteMeetingFromGoogleForAll(meetingId);
  }
  await prisma.meeting.delete({ where: { id: meetingId } });
  revalidatePath("/calendar");
}
