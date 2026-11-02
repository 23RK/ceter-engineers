"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/actions/tasks";
import { date, num, safeUrl, str } from "@/lib/form-values";

/** The partner who did the visit; anyone else is a free-text name. */
async function performer(value: string | null) {
  if (!value) return { performedById: null };
  const user = await prisma.user.findFirst({
    where: { id: value, role: "PARTNER" },
    select: { id: true },
  });
  return user ? { performedById: user.id } : undefined;
}

// --- יזמים: דוחות פיקוח -------------------------------------------------

export async function createSupervisionReport(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const visitDate = date(formData.get("visitDate"));
  if (!visitDate) return { error: "יש להזין תאריך ביקור" };
  const rawUrl = str(formData.get("fileUrl"));
  const fileUrl = safeUrl(rawUrl);
  if (rawUrl && !fileUrl) return { error: "הקישור לקובץ צריך להתחיל ב-https://" };
  const by = await performer(str(formData.get("performedById")));
  if (!by) return { error: "מבצע לא חוקי" };

  await prisma.supervisionReport.create({
    data: {
      projectId,
      visitDate,
      ...by,
      performedByName: by.performedById ? null : str(formData.get("performedByName")),
      reportSent: formData.get("reportSent") === "on",
      fileUrl,
      notes: str(formData.get("notes")),
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, ts: Date.now() };
}

export async function updateSupervisionReport(
  reportId: string,
  patch: {
    visitDate?: string;
    performedById?: string | null;
    performedByName?: string | null;
    reportSent?: boolean;
    fileUrl?: string | null;
    notes?: string | null;
  }
): Promise<ActionState> {
  await requireUser();
  const data: Record<string, unknown> = {};
  if ("visitDate" in patch) {
    const d = date(patch.visitDate);
    if (!d) return { error: "יש להזין תאריך ביקור" };
    data.visitDate = d;
  }
  if ("performedById" in patch) {
    const by = await performer(patch.performedById ?? null);
    if (!by) return { error: "מבצע לא חוקי" };
    Object.assign(data, by);
    if (by.performedById) data.performedByName = null;
  }
  if ("performedByName" in patch) data.performedByName = str(patch.performedByName);
  if ("reportSent" in patch) data.reportSent = !!patch.reportSent;
  if ("fileUrl" in patch) {
    const url = safeUrl(patch.fileUrl);
    if (patch.fileUrl && !url) return { error: "הקישור לקובץ צריך להתחיל ב-https://" };
    data.fileUrl = url;
  }
  if ("notes" in patch) data.notes = str(patch.notes);

  const report = await prisma.supervisionReport.update({
    where: { id: reportId },
    data,
    select: { projectId: true },
  });
  revalidatePath(`/projects/${report.projectId}`);
  return { ok: true, ts: Date.now() };
}

export async function deleteSupervisionReport(reportId: string): Promise<ActionState> {
  await requireUser();
  const report = await prisma.supervisionReport.delete({
    where: { id: reportId },
    select: { projectId: true },
  });
  revalidatePath(`/projects/${report.projectId}`);
  return { ok: true, ts: Date.now() };
}

// --- וילות: שינויים ותוספות ------------------------------------------------

export async function createChangeOrder(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const description = str(formData.get("description"));
  if (!description) return { error: "יש להזין תיאור" };
  const cost = num(formData.get("cost"));
  if (cost === undefined) return { error: "עלות לא חוקית" };
  await prisma.changeOrder.create({
    data: {
      projectId,
      description,
      cost,
      clientApproved: formData.get("clientApproved") === "on",
      date: date(formData.get("date")),
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, ts: Date.now() };
}

export async function updateChangeOrder(
  changeId: string,
  patch: {
    description?: string;
    cost?: string | null;
    clientApproved?: boolean;
    date?: string | null;
  }
): Promise<ActionState> {
  await requireUser();
  const data: Record<string, unknown> = {};
  if ("description" in patch) {
    const d = str(patch.description);
    if (!d) return { error: "יש להזין תיאור" };
    data.description = d;
  }
  if ("cost" in patch) {
    const cost = num(patch.cost);
    if (cost === undefined) return { error: "עלות לא חוקית" };
    data.cost = cost;
  }
  if ("clientApproved" in patch) data.clientApproved = !!patch.clientApproved;
  if ("date" in patch) data.date = date(patch.date);

  const change = await prisma.changeOrder.update({
    where: { id: changeId },
    data,
    select: { projectId: true },
  });
  revalidatePath(`/projects/${change.projectId}`);
  return { ok: true, ts: Date.now() };
}

export async function deleteChangeOrder(changeId: string): Promise<ActionState> {
  await requireUser();
  const change = await prisma.changeOrder.delete({
    where: { id: changeId },
    select: { projectId: true },
  });
  revalidatePath(`/projects/${change.projectId}`);
  return { ok: true, ts: Date.now() };
}
