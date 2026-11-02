import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getVatRate } from "@/lib/inspection-data";
import { formatDateShort, formatMoney, israelToday } from "@/lib/format";
import { PERFORMED, monthKey, monthLabel, needsAttention, shiftMonth, withVat } from "@/lib/inspections";
import { breakdown, change, monthTotals, openDebts, trend, type BreakdownLine } from "@/lib/inspection-stats";
import { InspectionsNav } from "@/components/inspections/inspections-nav";
import { TrendChart } from "@/components/inspections/trend-chart";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const start = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
};

/** סיכום ורווחיות (SPEC §4.3). */
export default async function InspectionsSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireUser();
  const { month: m } = await searchParams;
  const today = israelToday();
  const month = m && MONTH.test(m) ? m : monthKey(today);
  const prev = shiftMonth(month, -1);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const inspectorSelect = { select: { name: true, employmentType: true } } as const;
  const [window12, debtRows, attentionRows, vatRate] = await Promise.all([
    prisma.inspection.findMany({
      where: {
        status: { in: PERFORMED },
        date: { gte: start(shiftMonth(month, -11)), lt: start(shiftMonth(month, 1)) },
      },
      select: {
        date: true,
        status: true,
        price: true,
        amountPaid: true,
        paymentStatus: true,
        reportSent: true,
        inspectorPay: true,
        inspectorPaid: true,
        city: true,
        developerContractor: true,
        inspector: inspectorSelect,
        apartmentType: { select: { name: true } },
      },
    }),
    // Open debts over all months, as of today.
    prisma.inspection.findMany({
      where: {
        status: { in: PERFORMED },
        OR: [{ paymentStatus: { not: "PAID" } }, { inspectorPaid: false }],
      },
      select: {
        date: true,
        status: true,
        price: true,
        amountPaid: true,
        paymentStatus: true,
        reportSent: true,
        inspectorPay: true,
        inspectorPaid: true,
        inspector: inspectorSelect,
      },
    }),
    // "דורש טיפול" candidates.
    prisma.inspection.findMany({
      where: {
        OR: [
          { status: "DONE", reportSent: false },
          { reportSent: true, status: { not: "CANCELED" }, paymentStatus: { not: "PAID" } },
          { status: "PENDING_SCHEDULING", date: tomorrow },
        ],
      },
      select: {
        id: true,
        date: true,
        status: true,
        reportSent: true,
        reportSentAt: true,
        paymentStatus: true,
        clientName: true,
        price: true,
        amountPaid: true,
        inspector: inspectorSelect,
      },
      orderBy: { date: "asc" },
    }),
    getVatRate(),
  ]);

  const withOwner = <T extends { inspector: { employmentType: string } | null }>(rows: T[]) =>
    rows.map((r) => ({ ...r, isOwner: r.inspector?.employmentType === "OWNER" }));
  const rows = withOwner(window12);
  const cur = monthTotals(rows, month);
  const before = monthTotals(rows, prev);
  const debts = openDebts(withOwner(debtRows));
  const attention = needsAttention(attentionRows, today);
  const attentionCount =
    attention.reportLate.length +
    attention.unpaid0to7.length +
    attention.unpaid8to30.length +
    attention.unpaid30plus.length +
    attention.tomorrowNotScheduled.length;

  const byInspector = breakdown(rows, month, (r) => r.inspector?.name ?? null);
  const byType = breakdown(rows, month, (r) => r.apartmentType?.name ?? null);
  const byDeveloper = breakdown(rows, month, (r) => r.developerContractor);
  const byCity = breakdown(rows, month, (r) => r.city);
  const href = (k: string) => `/inspections/summary?month=${k}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-brand-900">בדק בית</h1>
        <p className="text-sm text-black/50">סיכום ורווחיות. הסכומים ללא מע&quot;מ.</p>
      </div>
      <InspectionsNav active="summary" />

      <div className="flex items-center justify-center gap-3">
        <Link href={href(prev)} aria-label="החודש הקודם" className="rounded-lg border border-black/10 p-2 text-black/50 hover:bg-black/5">
          <ChevronRight size={16} />
        </Link>
        <h2 className="w-40 text-center text-sm font-bold text-brand-900">{monthLabel(month)}</h2>
        <Link href={href(shiftMonth(month, 1))} aria-label="החודש הבא" className="rounded-lg border border-black/10 p-2 text-black/50 hover:bg-black/5">
          <ChevronLeft size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="בדיקות שבוצעו" value={String(cur.performed)} delta={change(cur.performed, before.performed)} good="up" prev={prev} />
        <Kpi label="דוחות שנשלחו" value={String(cur.reportsSent)} delta={change(cur.reportsSent, before.reportsSent)} good="up" prev={prev} />
        <Kpi
          label="הכנסות"
          value={formatMoney(cur.revenue)!}
          sub={`${formatMoney(withVat(cur.revenue, vatRate))} כולל מע"מ`}
          delta={change(cur.revenue, before.revenue)}
          good="up"
          prev={prev}
        />
        <Kpi label="תשלומים לבודקים" value={formatMoney(cur.toInspectors)!} delta={change(cur.toInspectors, before.toInspectors)} prev={prev} />
        <Kpi
          label="רווח גולמי"
          value={formatMoney(cur.profit)!}
          sub={cur.margin != null ? `${cur.margin}% רווח` : undefined}
          delta={change(cur.profit, before.profit)}
          good="up"
          prev={prev}
          strong
        />
        <Kpi label="חוב פתוח מלקוחות" value={formatMoney(debts.clients)!} sub="נכון להיום, כל החודשים" tone={debts.clients ? "warn" : undefined} />
        <Kpi label="חוב לבודקים" value={formatMoney(debts.inspectors)!} sub="נכון להיום, בלי הבעלים" tone={debts.inspectors ? "warn" : undefined} />
        <a href="#attention" className={`flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${attentionCount ? "border-amber-200 bg-amber-50" : "border-black/5 bg-white"}`}>
          <span className="flex items-center gap-1.5 text-xs text-black/55">
            <AlertTriangle size={14} className={attentionCount ? "text-amber-600" : "text-black/30"} />
            דורש טיפול
          </span>
          <span className="mt-1 text-2xl font-bold text-brand-900">{attentionCount}</span>
        </a>
      </div>

      <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-sm font-bold text-brand-900">מגמה: 12 חודשים, הכנסות מול רווח</h2>
        <TrendChart data={trend(rows, month)} />
      </section>

      <section id="attention" className="scroll-mt-20 rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-brand-900">
          <AlertTriangle size={16} className="text-amber-600" />
          דורש טיפול
        </h2>
        {attentionCount === 0 ? (
          <p className="text-sm text-black/45">אין כרגע משהו שדורש טיפול.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AttentionList
              title="בוצע לפני יותר מ-48 שעות, ודוח לא נשלח"
              rows={attention.reportLate}
              detail={(r) =>
                `אחראי לדוח: ${r.inspector?.name ?? "—"}${r.inspector && r.inspector.employmentType !== "OWNER" ? " (בודק חיצוני, ובמעקב של רון)" : ""}`
              }
            />
            <AttentionList title="בדיקות מחר שלא תואמו" rows={attention.tomorrowNotScheduled} detail={() => "ממתין לתיאום"} />
            <AttentionList title="דוח נשלח ולא שולם: 0–7 ימים" rows={attention.unpaid0to7} detail={(r) => owed(r)} />
            <AttentionList title="דוח נשלח ולא שולם: 8–30 ימים" rows={attention.unpaid8to30} detail={(r) => owed(r)} tone="warn" />
            <AttentionList title="דוח נשלח ולא שולם: יותר מ-30 יום" rows={attention.unpaid30plus} detail={(r) => owed(r)} tone="danger" />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownTable title="לפי בודק" lines={byInspector} showPay />
        <BreakdownTable title="לפי סוג נכס" lines={byType} />
        <BreakdownTable
          title="לפי יזם / קבלן"
          hint="מקור הפניות, וגם הזדמנות להציע ליזם ניהול ופיקוח."
          lines={byDeveloper}
        />
        <BreakdownTable title="לפי עיר" lines={byCity} />
      </div>
    </div>
  );
}

const owed = (r: { price: number | null; amountPaid: number }) =>
  `יתרה: ${formatMoney(Math.max(0, (r.price ?? 0) - r.amountPaid))}`;

function Kpi({
  label,
  value,
  sub,
  delta,
  good,
  prev,
  tone,
  strong,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  /** Which direction is good (colored); others show the change in neutral gray. */
  good?: "up";
  prev?: string;
  tone?: "warn";
  strong?: boolean;
}) {
  const Arrow = delta != null && delta < 0 ? TrendingDown : TrendingUp;
  const deltaColor =
    delta == null || delta === 0 || !good ? "text-black/45" : delta > 0 ? "text-green-700" : "text-red-600";
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border p-4 shadow-sm ${tone === "warn" ? "border-amber-200 bg-amber-50" : "border-black/5 bg-white"}`}>
      <span className="text-xs text-black/55">{label}</span>
      <span className={`text-2xl font-bold ${strong ? "text-green-700" : "text-brand-900"}`}>{value}</span>
      {sub && <span className="text-xs text-black/45">{sub}</span>}
      {prev && (
        <span className={`flex items-center gap-1 text-xs font-medium ${deltaColor}`}>
          {delta == null ? (
            <span className="text-black/35">אין נתונים ל{monthLabel(prev)}</span>
          ) : (
            <>
              <Arrow size={13} />
              {delta > 0 ? "+" : ""}
              {delta}% לעומת {monthLabel(prev)}
            </>
          )}
        </span>
      )}
    </div>
  );
}

function AttentionList<T extends { id: string; date: Date | null; clientName: string }>({
  title,
  rows,
  detail,
  tone,
}: {
  title: string;
  rows: T[];
  detail: (r: T) => string;
  tone?: "warn" | "danger";
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className={`mb-1 text-xs font-bold ${tone === "danger" ? "text-red-700" : tone === "warn" ? "text-amber-800" : "text-brand-900"}`}>
        {title} ({rows.length})
      </h3>
      <ul className="divide-y divide-black/5 rounded-xl border border-black/5">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/inspections?q=${encodeURIComponent(r.clientName)}${r.date ? `&month=${monthKey(r.date)}` : ""}`}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-black/[0.02]"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-brand-900">{r.clientName}</span>
                <span className="block truncate text-xs text-black/45">{detail(r)}</span>
              </span>
              <span className="shrink-0 text-xs text-black/45">{formatDateShort(r.date) ?? "—"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BreakdownTable({
  title,
  hint,
  lines,
  showPay,
}: {
  title: string;
  hint?: string;
  lines: BreakdownLine[];
  showPay?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-bold text-brand-900">{title}</h2>
      {hint && <p className="text-xs text-black/50">{hint}</p>}
      {lines.length === 0 ? (
        <p className="mt-3 text-sm text-black/40">אין בדיקות שבוצעו בחודש הזה.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-black/45">
              <tr>
                <th className="py-1.5 text-right font-medium" />
                <th className="py-1.5 text-right font-medium">כמות</th>
                <th className="py-1.5 text-right font-medium">הכנסות</th>
                {showPay && <th className="py-1.5 text-right font-medium">תשלום</th>}
                <th className="py-1.5 text-right font-medium">רווח</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {lines.map((l) => (
                <tr key={l.key}>
                  <td className="py-1.5 font-medium text-brand-900">{l.key}</td>
                  <td className="py-1.5 text-black/70">{l.count}</td>
                  <td className="py-1.5 text-black/70">{formatMoney(l.revenue)}</td>
                  {showPay && <td className="py-1.5 text-black/70">{formatMoney(l.pay)}</td>}
                  <td className="py-1.5 font-semibold text-brand-900">{formatMoney(l.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
