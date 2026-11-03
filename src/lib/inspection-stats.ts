import type { InspectionPaymentStatus, InspectionStatus } from "@prisma/client";
import { PERFORMED, monthKey, shiftMonth } from "@/lib/inspections";

/** סיכום ורווחיות (SPEC §4.3). Amounts without VAT; owners are never owed pay. */

export type StatRow = {
  date: Date | string | null;
  status: InspectionStatus;
  price: number | null;
  amountPaid: number;
  paymentStatus: InspectionPaymentStatus;
  reportSent: boolean;
  inspectorPay: number | null;
  inspectorPaid: boolean;
  isOwner: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (ns: number[]) => round2(ns.reduce((a, b) => a + b, 0));

export const performedIn = <T extends StatRow>(rows: T[], month: string) =>
  rows.filter((r) => PERFORMED.includes(r.status) && r.date && monthKey(r.date) === month);

/** The month's numbers: what was carried out in it. */
export function monthTotals(rows: StatRow[], month: string) {
  const done = performedIn(rows, month);
  const revenue = sum(done.map((r) => r.price ?? 0));
  const toInspectors = sum(done.filter((r) => !r.isOwner).map((r) => r.inspectorPay ?? 0));
  const profit = round2(revenue - toInspectors);
  return {
    performed: done.length,
    reportsSent: done.filter((r) => r.reportSent).length,
    revenue,
    toInspectors,
    profit,
    margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null,
  };
}

/** Change from the previous value in percent (null when there's nothing to compare to). */
export function change(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/** Open debts as of today, over all months: clients to us, us to inspectors. */
export function openDebts(rows: StatRow[]) {
  const done = rows.filter((r) => PERFORMED.includes(r.status));
  return {
    clients: sum(
      done.filter((r) => r.paymentStatus !== "PAID").map((r) => Math.max(0, (r.price ?? 0) - r.amountPaid))
    ),
    inspectors: sum(done.filter((r) => !r.isOwner && !r.inspectorPaid).map((r) => r.inspectorPay ?? 0)),
  };
}

export type BreakdownLine = { key: string; count: number; revenue: number; pay: number; profit: number };

/** A breakdown of the month's inspections by a key (inspector, type, developer, city). */
export function breakdown<T extends StatRow>(rows: T[], month: string, keyOf: (r: T) => string | null) {
  const lines = new Map<string, BreakdownLine>();
  for (const r of performedIn(rows, month)) {
    const key = keyOf(r)?.trim() || "—";
    const l = lines.get(key) ?? { key, count: 0, revenue: 0, pay: 0, profit: 0 };
    const pay = r.isOwner ? 0 : (r.inspectorPay ?? 0);
    l.count += 1;
    l.revenue = round2(l.revenue + (r.price ?? 0));
    l.pay = round2(l.pay + pay);
    l.profit = round2(l.revenue - l.pay);
    lines.set(key, l);
  }
  return [...lines.values()].sort((a, b) => b.revenue - a.revenue || b.count - a.count);
}

/** Revenue and profit for the 12 months ending at `month` (oldest first). */
export function trend(rows: StatRow[], month: string, months = 12) {
  return Array.from({ length: months }, (_, i) => {
    const key = shiftMonth(month, i - (months - 1));
    const t = monthTotals(rows, key);
    return { month: key, revenue: t.revenue, profit: t.profit };
  });
}
