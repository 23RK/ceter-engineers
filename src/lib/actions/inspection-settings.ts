"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/actions/tasks";
import { num, str } from "@/lib/form-values";
import { isEmploymentType, isInspectionKind } from "@/lib/inspections";

/** Settings changes affect new inspections only - existing ones keep their amounts. */
function revalidate() {
  revalidatePath("/settings/inspections");
  revalidatePath("/inspections", "layout");
}

const ok = (): ActionState => ({ ok: true, ts: Date.now() });
const COLOR = /^#[0-9a-fA-F]{6}$/;

// --- בודקים -----------------------------------------------------------------

export async function saveInspector(
  inspectorId: string | null,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const name = str(formData.get("name"));
  if (!name) return { error: "יש להזין שם" };
  const employmentType = formData.get("employmentType");
  if (!isEmploymentType(employmentType)) return { error: "יש לבחור סוג העסקה" };
  const color = str(formData.get("color")) ?? "#64748b";
  if (!COLOR.test(color)) return { error: "צבע לא חוקי" };
  const data = {
    name,
    phone: str(formData.get("phone")),
    email: str(formData.get("email")),
    color,
    employmentType,
    active: formData.get("active") === "on",
  };
  if (inspectorId) {
    await prisma.inspector.update({ where: { id: inspectorId }, data });
  } else {
    await prisma.inspector.create({ data: { ...data, active: true } });
  }
  revalidate();
  return ok();
}

export async function setInspectorActive(inspectorId: string, active: boolean): Promise<ActionState> {
  await requireUser();
  await prisma.inspector.update({ where: { id: inspectorId }, data: { active } });
  revalidate();
  return ok();
}

/**
 * Full delete - only for an inspector with no inspections (their rates go
 * with them). Owners (רון / גיא) are only deactivated.
 */
export async function deleteInspector(inspectorId: string): Promise<ActionState> {
  await requireUser();
  const inspector = await prisma.inspector.findUnique({
    where: { id: inspectorId },
    select: { employmentType: true, _count: { select: { inspections: true } } },
  });
  if (!inspector) return { error: "הבודק לא נמצא" };
  if (inspector.employmentType === "OWNER") {
    return { error: "בעלים (רון / גיא) לא נמחקים. אפשר להשבית." };
  }
  const n = inspector._count.inspections;
  if (n > 0) {
    return { error: `לבודק יש ${n === 1 ? "בדיקה אחת" : `${n} בדיקות`}, ולכן אפשר רק להשבית אותו.` };
  }
  await prisma.inspector.delete({ where: { id: inspectorId } });
  revalidate();
  return ok();
}

// --- סוגי נכס ---------------------------------------------------------------

export async function createApartmentType(name: string): Promise<ActionState> {
  await requireUser();
  const n = str(name);
  if (!n) return { error: "יש להזין שם" };
  const last = await prisma.apartmentType.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  await prisma.apartmentType.create({ data: { name: n, order: (last?.order ?? -1) + 1 } });
  revalidate();
  return ok();
}

export async function updateApartmentType(
  id: string,
  patch: { name?: string; active?: boolean }
): Promise<ActionState> {
  await requireUser();
  const data: { name?: string; active?: boolean } = {};
  if (patch.name !== undefined) {
    const n = str(patch.name);
    if (!n) return { error: "יש להזין שם" };
    data.name = n;
  }
  if (patch.active !== undefined) data.active = patch.active;
  await prisma.apartmentType.update({ where: { id }, data });
  revalidate();
  return ok();
}

export async function moveApartmentType(id: string, direction: "up" | "down"): Promise<ActionState> {
  await requireUser();
  const all = await prisma.apartmentType.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const from = all.findIndex((t) => t.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= all.length) return ok();
  [all[from], all[to]] = [all[to], all[from]];
  await prisma.$transaction(
    all.map((t, order) => prisma.apartmentType.update({ where: { id: t.id }, data: { order } }))
  );
  revalidate();
  return ok();
}

// --- מחירון ------------------------------------------------------------------

/** Set the unit price of a tier (empty = remove that tier). */
export async function setPriceTier(
  apartmentTypeId: string,
  minUnits: number,
  unitPrice: string
): Promise<ActionState> {
  await requireUser();
  if (!Number.isInteger(minUnits) || minUnits < 1) return { error: "כמות לא חוקית" };
  const price = num(unitPrice);
  if (price === undefined || (price !== null && price < 0)) return { error: "מחיר לא חוקי" };
  if (price === null) {
    await prisma.priceTier.deleteMany({ where: { apartmentTypeId, minUnits } });
  } else {
    await prisma.priceTier.upsert({
      where: { apartmentTypeId_minUnits: { apartmentTypeId, minUnits } },
      create: { apartmentTypeId, minUnits, unitPrice: price },
      update: { unitPrice: price },
    });
  }
  revalidate();
  return ok();
}

// --- תעריפים ------------------------------------------------------------------

export async function saveRate(
  rateId: string | null,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();
  const inspectorId = str(formData.get("inspectorId"));
  const kind = formData.get("kind");
  if (!inspectorId) return { error: "יש לבחור בודק" };
  if (!isInspectionKind(kind)) return { error: "יש לבחור סוג בדיקה" };
  const apartmentTypeId = str(formData.get("apartmentTypeId"));
  const rate = num(formData.get("rate"));
  const multiUnitRate = num(formData.get("multiUnitRate"));
  if (rate == null || rate < 0) return { error: "יש להזין תעריף" };
  if (multiUnitRate === undefined || (multiUnitRate !== null && multiUnitRate < 0)) {
    return { error: "תעריף ליחידה לא חוקי" };
  }
  const duplicate = await prisma.inspectorRate.findFirst({
    where: { inspectorId, kind, apartmentTypeId, ...(rateId && { id: { not: rateId } }) },
    select: { id: true },
  });
  if (duplicate) return { error: "כבר קיים תעריף לבודק, סוג הנכס וסוג הבדיקה האלה" };

  const data = { inspectorId, kind, apartmentTypeId, rate, multiUnitRate };
  if (rateId) await prisma.inspectorRate.update({ where: { id: rateId }, data });
  else await prisma.inspectorRate.create({ data });
  revalidate();
  return ok();
}

export async function deleteRate(rateId: string): Promise<ActionState> {
  await requireUser();
  await prisma.inspectorRate.delete({ where: { id: rateId } });
  revalidate();
  return ok();
}

// --- מע"מ --------------------------------------------------------------------

export async function saveVatRate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const v = num(formData.get("vatRate"));
  if (v == null || v < 0 || v > 100) return { error: "שיעור מע\"מ לא חוקי" };
  await prisma.appSetting.upsert({
    where: { key: "vatRate" },
    create: { key: "vatRate", value: String(v) },
    update: { value: String(v) },
  });
  revalidate();
  return ok();
}
