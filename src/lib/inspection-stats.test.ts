import { test } from "node:test";
import assert from "node:assert/strict";
import { breakdown, change, monthTotals, openDebts, trend, type StatRow } from "./inspection-stats";

const r = (o: Partial<StatRow> & { city?: string }) => ({
  date: "2026-10-10",
  status: "COMPLETED" as const,
  price: 1000,
  amountPaid: 1000,
  paymentStatus: "PAID" as const,
  reportSent: true,
  inspectorPay: 500,
  inspectorPaid: true,
  isOwner: false,
  city: "חולון",
  ...o,
});

const rows = [
  r({}),
  r({ isOwner: true, inspectorPay: 0, city: "בת ים" }),
  r({ status: "DONE", reportSent: false, paymentStatus: "UNPAID", amountPaid: 0, inspectorPaid: false }),
  r({ status: "SCHEDULED" }), // not carried out - doesn't count
  r({ status: "CANCELED" }),
  r({ date: "2026-09-10", price: 2000 }),
];

test("month totals: carried-out inspections only; owners cost nothing", () => {
  assert.deepEqual(monthTotals(rows, "2026-10"), {
    performed: 3,
    reportsSent: 2,
    revenue: 3000,
    toInspectors: 1000,
    profit: 2000,
    margin: 66.7,
  });
  assert.equal(change(3000, 2000), 50);
  assert.equal(change(5, 0), null);
});

test("open debts over all months", () => {
  assert.deepEqual(openDebts(rows), { clients: 1000, inspectors: 500 });
});

test("breakdown by city and the 12-month trend", () => {
  const b = breakdown(rows, "2026-10", (x) => (x as ReturnType<typeof r>).city);
  assert.deepEqual(b.map((l) => [l.key, l.count, l.revenue, l.profit]), [
    ["חולון", 2, 2000, 1000],
    ["בת ים", 1, 1000, 1000],
  ]);
  const t = trend(rows, "2026-10");
  assert.equal(t.length, 12);
  assert.deepEqual(t.at(-1), { month: "2026-10", revenue: 3000, profit: 2000 });
  assert.deepEqual(t.at(-2), { month: "2026-09", revenue: 2000, profit: 1500 });
  assert.equal(t[0].month, "2025-11");
});
