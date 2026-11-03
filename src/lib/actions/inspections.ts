"use server";

import { untracked, withUndo } from "@/lib/undo/undo";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { syncInspectionEventSafely } from "@/lib/google/calendar-sync";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/actions/tasks";
import { date, num, str } from "@/lib/form-values";
import { israelToday } from "@/lib/format";
import {
  applyInspectionPatch,
  clientPriceFor,
  inspectorPayFor,
  isInspectionKind,
  isInspectionStatus,
  isPaymentMethod,
  isPaymentStatus,
  scheduleStatus,
  type InspectionPatch,
  type InspectionRow,
  type PricingContext,
} from "@/lib/inspections";

function revalidate() {
  revalidatePath("/inspections", "layout");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

/**
 * An inspection of Ron / Guy is written to their Google calendar (SPEC §4.3),
 * after the response so editing stays fast. Unchanged events aren't rewritten.
 */
function writeToGoogleLater(inspectionId: string) {
  after(() => untracked(() => syncInspectionEventSafely(inspectionId)));
}

async function pricingContext(): Promise<PricingContext> {
  const [rates, tiers, inspectors] = await Promise.all([
    prisma.inspectorRate.findMany({
      select: { inspectorId: true, apartmentTypeId: true, kind: true, rate: true, multiUnitRate: true },
    }),
    prisma.priceTier.findMany({ select: { apartmentTypeId: true, minUnits: true, unitPrice: true } }),
    prisma.inspector.findMany({ select: { id: true, employmentType: true } }),
  ]);
  return { rates, tiers, inspectors, today: israelToday() };
}

const ROW_SELECT = {
  id: true,
  date: true,
  time: true,
  kind: true,
  unitsCount: true,
  status: true,
  clientName: true,
  clientPhone: true,
  clientEmail: true,
  city: true,
  address: true,
  apartmentNumber: true,
  developerContractor: true,
  price: true,
  paymentStatus: true,
  amountPaid: true,
  paymentMethod: true,
  paidAt: true,
  reportSent: true,
  reportSentAt: true,
  inspectorPay: true,
  inspectorPaid: true,
  inspectorPaidAt: true,
  notes: true,
  inspectorId: true,
  apartmentTypeId: true,
  parentInspectionId: true,
  createdAt: true,
} as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * הוספת בדיקה (SPEC §4.3, the short form). Price and inspector pay fill in
 * from the price list and the rates unless typed in.
 */
export async function createInspection(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  return withUndo("הבדיקה נוספה", async () => {
    const user = await requireUser();
    const clientName = str(formData.get("clientName"));
    if (!clientName) return { error: "יש להזין שם לקוח" };
    const kind = formData.get("kind") ?? "REGULAR";
    if (!isInspectionKind(kind)) return { error: "סוג בדיקה לא חוקי" };
    const time = str(formData.get("time"));
    if (time && !TIME.test(time)) return { error: "שעה לא חוקית" };
    const unitsCount = Math.max(1, Math.round(num(formData.get("unitsCount")) ?? 1));
    const inspectorId = str(formData.get("inspectorId"));
    const apartmentTypeId = str(formData.get("apartmentTypeId"));
    const priceIn = num(formData.get("price"));
    const payIn = num(formData.get("inspectorPay"));
    if (priceIn === undefined || payIn === undefined) return { error: "סכום לא חוקי" };

    const ctx = await pricingContext();
    const inspector = ctx.inspectors.find((i) => i.id === inspectorId) ?? null;
    if (inspectorId && !inspector) return { error: "בודק לא חוקי" };
    const d = date(formData.get("date"));
    const parentInspectionId = str(formData.get("parentInspectionId"));

    const created = await prisma.inspection.create({
      data: {
        clientName,
        clientPhone: str(formData.get("clientPhone")),
        clientEmail: str(formData.get("clientEmail")),
        date: d,
        time,
        kind,
        unitsCount,
        inspectorId,
        apartmentTypeId,
        city: str(formData.get("city")),
        address: str(formData.get("address")),
        apartmentNumber: str(formData.get("apartmentNumber")),
        developerContractor: str(formData.get("developerContractor")),
        notes: str(formData.get("notes")),
        price: priceIn ?? clientPriceFor(ctx.tiers, apartmentTypeId, kind, unitsCount),
        inspectorPay: payIn ?? inspectorPayFor(ctx.rates, inspector, apartmentTypeId, kind, unitsCount),
        status: scheduleStatus("PENDING_SCHEDULING", d, inspectorId),
        parentInspectionId,
        createdById: user.id,
      },
    });
    writeToGoogleLater(created.id);
    revalidate();
    return { ok: true, ts: Date.now() };
  });
}

/** Inline edit (SPEC §4.3), with the automatic rules of applyInspectionPatch. */
export async function updateInspection(
  inspectionId: string,
  patch: InspectionPatch
): Promise<ActionState> {
  return withUndo("הבדיקה עודכנה", async () => {
    await requireUser();
    // Validate the closed lists; the rest is cleaned by applyInspectionPatch.
    if (patch.status !== undefined && !isInspectionStatus(patch.status)) return { error: "סטטוס לא חוקי" };
    if (patch.paymentStatus !== undefined && !isPaymentStatus(patch.paymentStatus)) return { error: "סטטוס תשלום לא חוקי" };
    if (patch.paymentMethod != null && !isPaymentMethod(patch.paymentMethod)) return { error: "אמצעי תשלום לא חוקי" };
    if (patch.kind !== undefined && !isInspectionKind(patch.kind)) return { error: "סוג בדיקה לא חוקי" };
    if (patch.time && !TIME.test(patch.time)) return { error: "שעה לא חוקית" };
    if ("clientName" in patch && !patch.clientName?.trim()) return { error: "יש להזין שם לקוח" };
    for (const k of ["price", "inspectorPay", "amountPaid"] as const) {
      const v = patch[k];
      if (v != null && (!Number.isFinite(v) || v < 0)) return { error: "סכום לא חוקי" };
    }

    const [row, ctx] = await Promise.all([
      prisma.inspection.findUnique({ where: { id: inspectionId }, select: ROW_SELECT }),
      pricingContext(),
    ]);
    if (!row) return { error: "הבדיקה לא נמצאה" };
    if (patch.inspectorId && !ctx.inspectors.some((i) => i.id === patch.inspectorId)) {
      return { error: "בודק לא חוקי" };
    }

    const next: InspectionRow = applyInspectionPatch(row, patch, ctx);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, parentInspectionId, ...data } = next;
    await prisma.inspection.update({ where: { id: inspectionId }, data });
    writeToGoogleLater(inspectionId);
    revalidate();
    return { ok: true, ts: Date.now() };
  });
}

/** "צור בדיקה חוזרת": same client and property, linked to the original. */
export async function createRepeatInspection(parentId: string): Promise<ActionState> {
  return withUndo("נוצרה בדיקה חוזרת", async () => {
    const user = await requireUser();
    const [parent, ctx] = await Promise.all([
      prisma.inspection.findUnique({ where: { id: parentId } }),
      pricingContext(),
    ]);
    if (!parent) return { error: "הבדיקה המקורית לא נמצאה" };
    const inspector = ctx.inspectors.find((i) => i.id === parent.inspectorId) ?? null;
    await prisma.inspection.create({
      data: {
        kind: "REPEAT",
        parentInspectionId: parent.id,
        clientName: parent.clientName,
        clientPhone: parent.clientPhone,
        clientEmail: parent.clientEmail,
        city: parent.city,
        address: parent.address,
        apartmentNumber: parent.apartmentNumber,
        developerContractor: parent.developerContractor,
        apartmentTypeId: parent.apartmentTypeId,
        unitsCount: parent.unitsCount,
        inspectorId: parent.inspectorId,
        inspectorPay: inspectorPayFor(ctx.rates, inspector, parent.apartmentTypeId, "REPEAT", parent.unitsCount),
        price: null, // a repeat inspection is priced by hand
        status: "PENDING_SCHEDULING",
        createdById: user.id,
      },
    });
    revalidate();
    return { ok: true, ts: Date.now() };
  });
}

const digits = (s: string) => s.replace(/\D/g, "").replace(/^972/, "0");

/** "לקוח חוזר" (SPEC §4.3): earlier inspections with the same phone number. */
export async function lookupClient(
  phone: string
): Promise<{ count: number; lastDate: Date | null; name: string | null }> {
  await requireUser();
  const d = digits(phone);
  if (d.length < 9) return { count: 0, lastDate: null, name: null };
  const candidates = await prisma.inspection.findMany({
    where: { clientPhone: { contains: d.slice(-7) } },
    select: { clientPhone: true, date: true, createdAt: true, clientName: true },
    orderBy: { createdAt: "desc" },
  });
  const same = candidates.filter((c) => c.clientPhone && digits(c.clientPhone) === d);
  return {
    count: same.length,
    lastDate: same.map((s) => s.date).find(Boolean) ?? null,
    name: same[0]?.clientName ?? null,
  };
}

/** "סמן הכל כשולם" for one inspector and month (SPEC §4.3, inspector payments). */
export async function markInspectorMonthPaid(inspectorId: string, month: string): Promise<ActionState> {
  return withUndo("סומן כשולם לבודק", async () => {
    await requireUser();
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return { error: "חודש לא חוקי" };
    const { count } = await prisma.inspection.updateMany({
      where: {
        inspectorId,
        inspectorPaid: false,
        status: { in: ["DONE", "REPORT_SENT", "COMPLETED"] },
        date: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) },
        inspector: { employmentType: { not: "OWNER" } },
      },
      data: { inspectorPaid: true, inspectorPaidAt: israelToday() },
    });
    revalidate();
    return count ? { ok: true, ts: Date.now() } : { error: "אין בדיקות פתוחות לתשלום בחודש הזה" };
  });
}
