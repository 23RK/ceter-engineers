import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getInspectionSetup } from "@/lib/inspection-data";
import { israelToday } from "@/lib/format";
import {
  EMPTY_FILTERS,
  INSPECTION_STATUSES,
  PAYMENT_STATUSES,
  monthKey,
  shiftMonth,
  type InspectionFilters,
} from "@/lib/inspections";
import { InspectionsBoard } from "@/components/inspections/board";
import { InspectionsNav } from "@/components/inspections/inspections-nav";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** How many months back the board loads by default (all with ?range=all). */
const MONTHS_BACK = 5;

/** לוח בדיקות בדק בית (SPEC §4.3). */
export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const today = israelToday();
  const all = one(query.range) === "all";
  const fromMonth = shiftMonth(monthKey(today), -MONTHS_BACK);
  const [fy, fm] = fromMonth.split("-").map(Number);

  const [setup, rows, developerRows] = await Promise.all([
    getInspectionSetup(),
    prisma.inspection.findMany({
      where: all ? {} : { OR: [{ date: null }, { date: { gte: new Date(Date.UTC(fy, fm - 1, 1)) } }] },
      omit: { googleEventId: true, createdById: true, updatedAt: true },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    }),
    // Autocomplete from earlier values (SPEC §4.2: developer_contractor).
    prisma.inspection.findMany({
      where: { developerContractor: { not: null } },
      distinct: ["developerContractor"],
      select: { developerContractor: true },
    }),
  ]);
  const developers = developerRows
    .map((d) => d.developerContractor!.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "he"));
  const myInspectorId = setup.inspectors.find((i) => i.userId === user.id)?.id ?? null;

  const preset = one(query.preset);
  const status = one(query.status);
  const payment = one(query.payment);
  const report = one(query.report);
  const initialFilters: InspectionFilters = {
    ...EMPTY_FILTERS,
    preset: ["unpaid", "awaitingReport", "thisWeek", "mine"].includes(preset) ? (preset as InspectionFilters["preset"]) : "",
    month: one(query.month),
    from: one(query.from),
    to: one(query.to),
    inspectorId: one(query.inspectorId),
    status: INSPECTION_STATUSES.some((s) => s.value === status) ? (status as InspectionFilters["status"]) : "",
    payment: PAYMENT_STATUSES.some((s) => s.value === payment) ? (payment as InspectionFilters["payment"]) : "",
    report: report === "sent" || report === "notSent" ? report : "",
    developer: one(query.developer),
    city: one(query.city),
    q: one(query.q),
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-brand-900">בדק בית</h1>
        <p className="text-sm text-black/50">לוח ניהול הבדיקות. כל הסכומים ללא מע&quot;מ, אלא אם צוין אחרת.</p>
      </div>
      <InspectionsNav active="board" />
      <InspectionsBoard
        rows={rows}
        setup={setup}
        developers={developers}
        myInspectorId={myInspectorId}
        today={today.toISOString().slice(0, 10)}
        initialFilters={initialFilters}
        loadedFrom={all ? null : fromMonth}
      />
    </div>
  );
}
