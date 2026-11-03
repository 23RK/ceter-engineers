import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clientPriceFor,
  dayName,
  derivePaymentStatus,
  deriveStatus,
  inspectorPayFor,
  needsAttention,
  shiftMonth,
  summarize,
  toCsv,
  withVat,
  type RateRow,
} from "./inspections";

// The rates from the spreadsheet (SPEC §4.2), as in the migration.
const rates: RateRow[] = [
  { inspectorId: "liran", apartmentTypeId: null, kind: "REGULAR", rate: 585, multiUnitRate: 526.5 },
  { inspectorId: "liran", apartmentTypeId: "6plus", kind: "REGULAR", rate: 702, multiUnitRate: null },
  { inspectorId: "liran", apartmentTypeId: "garden", kind: "REGULAR", rate: 702, multiUnitRate: null },
  { inspectorId: "liran", apartmentTypeId: null, kind: "REPEAT", rate: 468, multiUnitRate: null },
  { inspectorId: "avi", apartmentTypeId: null, kind: "REGULAR", rate: 550, multiUnitRate: 500 },
  { inspectorId: "avi", apartmentTypeId: null, kind: "REPEAT", rate: 450, multiUnitRate: null },
  { inspectorId: "oz", apartmentTypeId: null, kind: "REGULAR", rate: 650, multiUnitRate: 600 },
];
const liran = { id: "liran", employmentType: "FREELANCER" as const };
const avi = { id: "avi", employmentType: "FREELANCER" as const };
const oz = { id: "oz", employmentType: "FREELANCER" as const };
const ron = { id: "ron", employmentType: "OWNER" as const };

test("inspector pay from the spreadsheet rates", () => {
  assert.equal(inspectorPayFor(rates, liran, "4", "REGULAR", 1), 585);
  assert.equal(inspectorPayFor(rates, liran, "4", "REGULAR", 3), 1579.5); // 526.5 x 3
  assert.equal(inspectorPayFor(rates, liran, "garden", "REGULAR", 1), 702);
  assert.equal(inspectorPayFor(rates, liran, "6plus", "REPEAT", 1), 468);
  assert.equal(inspectorPayFor(rates, avi, "6plus", "REGULAR", 1), 550); // "–": general rate
  assert.equal(inspectorPayFor(rates, oz, "4", "REGULAR", 2), 1200);
  assert.equal(inspectorPayFor(rates, oz, "4", "REPEAT", 1), null); // "–": by hand
  assert.equal(inspectorPayFor(rates, ron, "4", "REGULAR", 1), 0); // owners aren't paid
  assert.equal(inspectorPayFor(rates, null, "4", "REGULAR", 1), null);
});

test("client price from the price list tiers; empty list or repeat = by hand", () => {
  const tiers = [
    { apartmentTypeId: "4", minUnits: 1, unitPrice: 1500 },
    { apartmentTypeId: "4", minUnits: 2, unitPrice: 1400 },
    { apartmentTypeId: "4", minUnits: 4, unitPrice: 1300 },
  ];
  assert.equal(clientPriceFor(tiers, "4", "REGULAR", 1), 1500);
  assert.equal(clientPriceFor(tiers, "4", "REGULAR", 3), 4200);
  assert.equal(clientPriceFor(tiers, "4", "REGULAR", 5), 6500);
  assert.equal(clientPriceFor(tiers, "4", "REPEAT", 1), null);
  assert.equal(clientPriceFor([], "4", "REGULAR", 1), null);
});

test("automatic status: report sent, then completed when also paid", () => {
  assert.equal(deriveStatus("DONE", true, "UNPAID"), "REPORT_SENT");
  assert.equal(deriveStatus("REPORT_SENT", true, "PAID"), "COMPLETED");
  assert.equal(deriveStatus("COMPLETED", true, "PARTIAL"), "REPORT_SENT");
  assert.equal(deriveStatus("REPORT_SENT", false, "PAID"), "DONE");
  assert.equal(deriveStatus("SCHEDULED", false, "PAID"), "SCHEDULED");
  assert.equal(deriveStatus("CANCELED", true, "PAID"), "CANCELED");
  assert.equal(derivePaymentStatus(1000, 0), "UNPAID");
  assert.equal(derivePaymentStatus(1000, 400), "PARTIAL");
  assert.equal(derivePaymentStatus(1000, 1000), "PAID");
});

test("group summary: profit computed in code, canceled and owners excluded", () => {
  const row = (o: Partial<Parameters<typeof summarize>[0][0]>) => ({
    status: "DONE" as const,
    price: 1000,
    amountPaid: 0,
    inspectorPay: 585,
    inspectorPaid: false,
    paymentStatus: "UNPAID" as const,
    isOwner: false,
    ...o,
  });
  const s = summarize([
    row({}),
    row({ amountPaid: 1000, paymentStatus: "PAID" }),
    row({ isOwner: true, inspectorPay: 0 }),
    row({ status: "CANCELED" }),
    row({ price: null, inspectorPay: null }), // empty cells don't break the sum
  ]);
  assert.deepEqual(s, { count: 4, revenue: 3000, toInspectors: 1170, profit: 1830, unpaid: 2000 });
});

test("needs attention: late report, unpaid by age, tomorrow not scheduled", () => {
  const today = new Date("2026-11-10");
  const r = (id: string, o: object) => ({
    id,
    date: "2026-11-01",
    status: "DONE" as const,
    reportSent: false,
    reportSentAt: null,
    paymentStatus: "UNPAID" as const,
    ...o,
  });
  const a = needsAttention(
    [
      r("late", { date: "2026-11-08" }),
      r("fresh", { date: "2026-11-09" }),
      r("u3", { status: "REPORT_SENT", reportSent: true, reportSentAt: "2026-11-07" }),
      r("u20", { status: "REPORT_SENT", reportSent: true, reportSentAt: "2026-10-21" }),
      r("u40", { status: "REPORT_SENT", reportSent: true, reportSentAt: "2026-09-25" }),
      r("tom", { status: "PENDING_SCHEDULING", date: "2026-11-11" }),
    ],
    today
  );
  const ids = (l: { id: string }[]) => l.map((x) => x.id);
  assert.deepEqual(ids(a.reportLate), ["late"]);
  assert.deepEqual(ids(a.unpaid0to7), ["u3"]);
  assert.deepEqual(ids(a.unpaid8to30), ["u20"]);
  assert.deepEqual(ids(a.unpaid30plus), ["u40"]);
  assert.deepEqual(ids(a.tomorrowNotScheduled), ["tom"]);
});

test("small helpers", () => {
  assert.equal(withVat(1000, 18), 1180);
  assert.equal(dayName("2026-11-08"), "ראשון");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(toCsv([["a,b", 'x"y', null]]), '﻿"a,b","x""y",');
});

import { applyInspectionPatch, type InspectionRow } from "./inspections";

const ctx = {
  rates,
  tiers: [{ apartmentTypeId: "4", minUnits: 1, unitPrice: 1500 }],
  inspectors: [liran, avi, ron],
  today: new Date("2026-11-10"),
};
const base: InspectionRow = {
  id: "i1",
  date: null,
  time: null,
  kind: "REGULAR",
  unitsCount: 1,
  status: "PENDING_SCHEDULING",
  clientName: "דנה",
  clientPhone: null,
  clientEmail: null,
  city: null,
  address: null,
  apartmentNumber: null,
  developerContractor: null,
  price: null,
  paymentStatus: "UNPAID",
  amountPaid: 0,
  paymentMethod: null,
  paidAt: null,
  reportSent: false,
  reportSentAt: null,
  inspectorPay: null,
  inspectorPaid: false,
  inspectorPaidAt: null,
  notes: null,
  inspectorId: null,
  apartmentTypeId: null,
  parentInspectionId: null,
  createdAt: new Date("2026-11-01"),
};

test("edit: date + inspector schedule it, and the amounts fill in", () => {
  const a = applyInspectionPatch(base, { date: "2026-11-12", inspectorId: "liran", apartmentTypeId: "4" }, ctx);
  assert.equal(a.status, "SCHEDULED");
  assert.equal(a.inspectorPay, 585);
  assert.equal(a.price, 1500);
  // Clearing the date sends it back to waiting.
  assert.equal(applyInspectionPatch(a, { date: null }, ctx).status, "PENDING_SCHEDULING");
});

test("edit: report sent, then paid -> completed, with dates", () => {
  const done = { ...base, status: "DONE" as const, price: 1500, inspectorId: "liran", date: new Date("2026-11-08") };
  const sent = applyInspectionPatch(done, { reportSent: true }, ctx);
  assert.equal(sent.status, "REPORT_SENT");
  assert.equal(sent.reportSentAt?.toISOString().slice(0, 10), "2026-11-10");
  const paid = applyInspectionPatch(sent, { paymentStatus: "PAID", paymentMethod: "BIT" }, ctx);
  assert.equal(paid.status, "COMPLETED");
  assert.equal(paid.amountPaid, 1500);
  assert.equal(paid.paymentMethod, "BIT");
  assert.equal(paid.paidAt?.toISOString().slice(0, 10), "2026-11-10");
  // A partial payment: back to "דוח נשלח".
  const partial = applyInspectionPatch(paid, { amountPaid: 500 }, ctx);
  assert.equal(partial.paymentStatus, "PARTIAL");
  assert.equal(partial.status, "REPORT_SENT");
});

test("edit: a paid inspector's pay and a paid price don't change with the job", () => {
  const row = { ...base, inspectorId: "liran", inspectorPay: 600, inspectorPaid: true, price: 2000, paymentStatus: "PAID" as const, amountPaid: 2000 };
  const next = applyInspectionPatch(row, { unitsCount: 3, apartmentTypeId: "4" }, ctx);
  assert.equal(next.inspectorPay, 600);
  assert.equal(next.price, 2000);
  // Manual amounts win.
  assert.equal(applyInspectionPatch(base, { inspectorId: "avi", inspectorPay: 999 }, ctx).inspectorPay, 999);
});

import { EMPTY_FILTERS, filterInspections, groupByMonth } from "./inspections";

test("board filters: presets, search by name / phone / address, groups", () => {
  const today = new Date("2026-11-10"); // Tuesday; week = Nov 8-14
  const rows: InspectionRow[] = [
    { ...base, id: "a", clientName: "דנה כהן", clientPhone: "050-1234567", date: new Date("2026-11-09"), status: "DONE", inspectorId: "liran" },
    { ...base, id: "b", clientName: "יוסי", address: "הרצל 5", date: new Date("2026-10-20"), status: "REPORT_SENT", reportSent: true, paymentStatus: "PAID" },
    { ...base, id: "c", clientName: "מיכל", date: null },
  ];
  const ids = (f: Partial<typeof EMPTY_FILTERS>, mine: string | null = null) =>
    filterInspections(rows, { ...EMPTY_FILTERS, ...f }, { today, myInspectorId: mine }).map((r) => r.id);
  assert.deepEqual(ids({ preset: "unpaid" }), ["a"]);
  assert.deepEqual(ids({ preset: "awaitingReport" }), ["a"]);
  assert.deepEqual(ids({ preset: "thisWeek" }), ["a"]);
  assert.deepEqual(ids({ preset: "mine" }, "liran"), ["a"]);
  assert.deepEqual(ids({ q: "1234567" }), ["a"]);
  assert.deepEqual(ids({ q: "הרצל" }), ["b"]);
  assert.deepEqual(ids({ month: "2026-10" }), ["b"]);
  assert.deepEqual(groupByMonth(rows).map((g) => g.key), ["none", "2026-11", "2026-10"]);
});
