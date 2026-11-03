import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { israelToday } from "@/lib/format";
import { PERFORMED, monthKey, monthLabel, shiftMonth } from "@/lib/inspections";
import { InspectionsNav } from "@/components/inspections/inspections-nav";
import { Payouts } from "@/components/inspections/payouts";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** תשלומים לבודקים (SPEC §4.3): per month, per inspector. Owners are never owed. */
export default async function InspectorPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireUser();
  const { month: m } = await searchParams;
  const month = m && MONTH.test(m) ? m : monthKey(israelToday());
  const [y, mm] = month.split("-").map(Number);

  const inspections = await prisma.inspection.findMany({
    where: {
      status: { in: PERFORMED },
      date: { gte: new Date(Date.UTC(y, mm - 1, 1)), lt: new Date(Date.UTC(y, mm, 1)) },
      inspector: { employmentType: { not: "OWNER" } },
    },
    select: {
      id: true,
      date: true,
      clientName: true,
      city: true,
      address: true,
      unitsCount: true,
      kind: true,
      inspectorPay: true,
      inspectorPaid: true,
      inspectorPaidAt: true,
      inspector: { select: { id: true, name: true, color: true } },
      apartmentType: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
  const href = (k: string) => `/inspections/payouts?month=${k}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="print:hidden">
        <h1 className="text-xl font-bold text-brand-900">בדק בית</h1>
        <p className="text-sm text-black/50">תשלומים לבודקים. רון וגיא (בעלים) לא מופיעים כחוב.</p>
      </div>
      <div className="print:hidden">
        <InspectionsNav active="payouts" />
      </div>
      <div className="flex items-center justify-center gap-3 print:hidden">
        <Link href={href(shiftMonth(month, -1))} aria-label="החודש הקודם" className="rounded-lg border border-black/10 p-2 text-black/50 hover:bg-black/5">
          <ChevronRight size={16} />
        </Link>
        <h2 className="w-40 text-center text-sm font-bold text-brand-900">{monthLabel(month)}</h2>
        <Link href={href(shiftMonth(month, 1))} aria-label="החודש הבא" className="rounded-lg border border-black/10 p-2 text-black/50 hover:bg-black/5">
          <ChevronLeft size={16} />
        </Link>
      </div>
      <Payouts month={month} inspections={inspections} />
    </div>
  );
}
