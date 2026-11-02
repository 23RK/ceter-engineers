"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/actions/tasks";
import { date, num, str } from "@/lib/form-values";
import { isFeeModel, retainerSchedule } from "@/lib/fees";
import { israelToday } from "@/lib/format";

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/departments/[slug]", "page");
}

/** Save the fee model and its fields (SPEC §3.5). Fields of other models are kept. */
export async function saveFeeTerms(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const model = formData.get("feeModel");
  if (model && !isFeeModel(model)) return { error: "מודל לא חוקי" };

  const numbers = {
    feeTotal: num(formData.get("feeTotal")),
    feeMonthly: num(formData.get("feeMonthly")),
    feePercent: num(formData.get("feePercent")),
    feeConstructionCost: num(formData.get("feeConstructionCost")),
  };
  if (Object.values(numbers).some((n) => n === undefined || (n !== null && n < 0))) {
    return { error: "יש להזין מספרים חיוביים בלבד" };
  }
  if (numbers.feePercent != null && numbers.feePercent > 100) {
    return { error: "האחוז צריך להיות בין 0 ל-100" };
  }
  const billingDay = num(formData.get("feeBillingDay"));
  const termsDays = num(formData.get("feePaymentTermsDays"));
  if (billingDay != null && ![0, 1, 10].includes(billingDay)) return { error: "יום גבייה לא חוקי" };
  if (termsDays != null && ![0, 30, 60].includes(termsDays)) return { error: "תנאי תשלום לא חוקיים" };
  const feeStartDate = date(formData.get("feeStartDate"));
  const feeEndDate = date(formData.get("feeEndDate"));
  if (feeStartDate && feeEndDate && feeEndDate < feeStartDate) {
    return { error: "תאריך הסיום לפני תאריך ההתחלה" };
  }

  // Only the chosen model's fields are sent by the form; the others stay as
  // they were, so switching models back and forth loses nothing.
  const sent = (key: string) => formData.has(key);
  await prisma.project.update({
    where: { id: projectId },
    data: {
      feeModel: isFeeModel(model) ? model : null,
      ...(sent("feeTotal") && { feeTotal: numbers.feeTotal }),
      ...(sent("feeMonthly") && { feeMonthly: numbers.feeMonthly }),
      ...(sent("feeStartDate") && { feeStartDate }),
      ...(sent("feeEndDate") && { feeEndDate }),
      ...(sent("feeBillingDay") && { feeBillingDay: billingDay ?? null }),
      ...(sent("feePaymentTermsDays") && { feePaymentTermsDays: termsDays ?? null }),
      ...(sent("feePercent") && { feePercent: numbers.feePercent }),
      ...(sent("feeConstructionCost") && {
        feeConstructionCost: numbers.feeConstructionCost,
      }),
      ...(sent("feeNotes") && { feeNotes: str(formData.get("feeNotes")) }),
    },
  });

  revalidateProject(projectId);
  return { ok: true, ts: Date.now() };
}

/** A stage id is accepted only if it belongs to the same project. */
async function checkStage(projectId: string, stageId: string | null | undefined) {
  if (!stageId) return null;
  const stage = await prisma.milestone.findFirst({
    where: { id: stageId, projectId },
    select: { id: true },
  });
  return stage ? stage.id : undefined;
}

export async function createPayment(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const amount = num(formData.get("amount"));
  if (amount == null || amount <= 0) return { error: "יש להזין סכום" };
  const stageId = await checkStage(projectId, str(formData.get("stageId")));
  if (stageId === undefined) return { error: "שלב לא חוקי" };

  const last = await prisma.payment.findFirst({
    where: { projectId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.payment.create({
    data: {
      projectId,
      title: str(formData.get("title")),
      amount,
      dueDate: date(formData.get("dueDate")),
      stageId,
      order: (last?.order ?? -1) + 1,
    },
  });
  revalidateProject(projectId);
  return { ok: true, ts: Date.now() };
}

export type PaymentPatch = {
  title?: string | null;
  amount?: number;
  dueDate?: string | null;
  invoiceIssued?: boolean;
  paid?: boolean;
  paidAt?: string | null;
  stageId?: string | null;
};

/** Inline edit of one payment. Marking paid saves today as the payment date. */
export async function updatePayment(
  paymentId: string,
  patch: PaymentPatch
): Promise<ActionState> {
  await requireUser();
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { projectId: true, paidAt: true },
  });
  if (!payment) return { error: "התשלום לא נמצא" };

  const data: Record<string, unknown> = {};
  if ("title" in patch) data.title = str(patch.title ?? null);
  if ("amount" in patch) {
    const amount = num(patch.amount);
    if (amount == null || amount <= 0) return { error: "יש להזין סכום" };
    data.amount = amount;
  }
  if ("dueDate" in patch) data.dueDate = date(patch.dueDate ?? null);
  if ("invoiceIssued" in patch) data.invoiceIssued = !!patch.invoiceIssued;
  if ("stageId" in patch) {
    const stageId = await checkStage(payment.projectId, patch.stageId);
    if (stageId === undefined) return { error: "שלב לא חוקי" };
    data.stageId = stageId;
  }
  if ("paid" in patch) {
    data.paid = !!patch.paid;
    data.paidAt = patch.paid ? (payment.paidAt ?? israelToday()) : null;
  }
  if ("paidAt" in patch) data.paidAt = date(patch.paidAt ?? null);

  await prisma.payment.update({ where: { id: paymentId }, data });
  revalidateProject(payment.projectId);
  return { ok: true, ts: Date.now() };
}

export async function deletePayment(paymentId: string): Promise<ActionState> {
  await requireUser();
  const payment = await prisma.payment.delete({
    where: { id: paymentId },
    select: { projectId: true },
  });
  revalidateProject(payment.projectId);
  return { ok: true, ts: Date.now() };
}

/** Retainer: add one payment per month that isn't scheduled yet. */
export async function generateRetainerPayments(projectId: string): Promise<ActionState> {
  await requireUser();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      feeMonthly: true,
      feeStartDate: true,
      feeEndDate: true,
      feeBillingDay: true,
      feePaymentTermsDays: true,
      payments: { select: { title: true, order: true } },
    },
  });
  if (!project) return { error: "הפרויקט לא נמצא" };
  const rows = retainerSchedule(
    project,
    project.payments.map((p) => p.title)
  );
  if (rows.length === 0) {
    return { error: "אין חודשים חדשים להוספה. בדקו סכום לחודש ותאריכי התחלה וסיום." };
  }
  const start = Math.max(-1, ...project.payments.map((p) => p.order)) + 1;
  await prisma.payment.createMany({
    data: rows.map((r, i) => ({ ...r, projectId, order: start + i })),
  });
  revalidateProject(projectId);
  return { ok: true, ts: Date.now() };
}
