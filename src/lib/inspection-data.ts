import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

/** שיעור מע"מ in percent (Settings), 18 by default. */
export const getVatRate = cache(async () => {
  const row = await prisma.appSetting.findUnique({ where: { key: "vatRate" } });
  const v = Number(row?.value);
  return Number.isFinite(v) ? v : 18;
});

/** Everything needed to price an inspection: inspectors, types, rates, price list. */
export const getInspectionSetup = cache(async () => {
  const [inspectors, apartmentTypes, rates, tiers, vatRate] = await Promise.all([
    prisma.inspector.findMany({
      select: { id: true, name: true, color: true, active: true, employmentType: true, phone: true, email: true, userId: true },
      orderBy: [{ active: "desc" }, { employmentType: "asc" }, { createdAt: "asc" }],
    }),
    prisma.apartmentType.findMany({
      select: { id: true, name: true, order: true, active: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    prisma.inspectorRate.findMany({
      select: { id: true, inspectorId: true, apartmentTypeId: true, kind: true, rate: true, multiUnitRate: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.priceTier.findMany({
      select: { id: true, apartmentTypeId: true, minUnits: true, unitPrice: true },
      orderBy: { minUnits: "asc" },
    }),
    getVatRate(),
  ]);
  return { inspectors, apartmentTypes, rates, tiers, vatRate };
});

export type InspectionSetup = Awaited<ReturnType<typeof getInspectionSetup>>;
