"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/auth";
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

export async function createMeeting(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requirePartner();

  const fields = readMeetingFields(formData);
  if ("error" in fields) return fields;

  await prisma.meeting.create({
    data: { ...fields, createdById: user.id },
  });

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

  await prisma.meeting.update({
    where: { id: meetingId },
    data: fields,
  });

  revalidatePath("/calendar");
  return { ok: true, ts: Date.now() };
}

export async function deleteMeeting(meetingId: string) {
  await requirePartner();
  await prisma.meeting.delete({ where: { id: meetingId } });
  revalidatePath("/calendar");
}
