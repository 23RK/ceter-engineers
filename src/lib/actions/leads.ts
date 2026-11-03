"use server";

import { withUndo } from "@/lib/undo/undo";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { LeadStatus, TaskStatus } from "@prisma/client";
import type { ActionState } from "@/lib/actions/tasks";

export type { ActionState };

function toOptionalDate(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? new Date(str) : null;
}

function toOptionalString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str || null;
}

export async function createLead(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return withUndo("הליד נוסף", async () => {
    await requireUser();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "יש להזין שם לקוח/יזם" };

    await prisma.lead.create({
      data: {
        name,
        status: (formData.get("status") as LeadStatus) || "IN_PROGRESS",
        notes: toOptionalString(formData.get("notes")),
      },
    });

    revalidatePath("/business-dev");
    return { ok: true, ts: Date.now() };
  });
}

export async function updateLead(
  leadId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return withUndo("הליד עודכן", async () => {
    await requireUser();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "יש להזין שם לקוח/יזם" };

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        name,
        status: (formData.get("status") as LeadStatus) || "IN_PROGRESS",
        notes: toOptionalString(formData.get("notes")),
      },
    });

    revalidatePath("/business-dev");
    revalidatePath(`/business-dev/${leadId}`);
    return { ok: true, ts: Date.now() };
  });
}

export async function deleteLead(leadId: string): Promise<ActionState> {
  return withUndo("הליד נמחק", async () => {
    await requireUser();
    await prisma.lead.delete({ where: { id: leadId } });
    revalidatePath("/business-dev");
    return { ok: true, redirectTo: "/business-dev" };
  });
}

export async function createLeadTask(
  leadId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return withUndo("המשימה נוספה", async () => {
    await requireUser();

    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { error: "יש להזין כותרת למשימה" };

    const count = await prisma.leadTask.count({ where: { leadId } });

    await prisma.leadTask.create({
      data: {
        title,
        dueDate: toOptionalDate(formData.get("dueDate")),
        leadId,
        order: count,
      },
    });

    revalidatePath(`/business-dev/${leadId}`);
    return { ok: true, ts: Date.now() };
  });
}

export async function setLeadTaskStatus(
  leadTaskId: string,
  status: TaskStatus
): Promise<ActionState> {
  return withUndo("סטטוס המשימה עודכן", async () => {
    await requireUser();
    const task = await prisma.leadTask.update({
      where: { id: leadTaskId },
      data: { status },
    });
    revalidatePath(`/business-dev/${task.leadId}`);
    return { ok: true };
  });
}

export async function deleteLeadTask(leadTaskId: string): Promise<ActionState> {
  return withUndo("המשימה נמחקה", async () => {
    await requireUser();
    const task = await prisma.leadTask.delete({ where: { id: leadTaskId } });
    revalidatePath(`/business-dev/${task.leadId}`);
    return { ok: true };
  });
}
