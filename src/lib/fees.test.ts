import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agreedFee,
  feeProgress,
  feeSummary,
  paymentsDueForDoneStages,
  retainerMonths,
  retainerSchedule,
  type FeeTerms,
} from "./fees";
import { fullAddress, telHref, wazeHref, whatsappHref } from "./contacts";

const none: FeeTerms = {
  feeModel: null,
  feeTotal: null,
  feeMonthly: null,
  feeStartDate: null,
  feeEndDate: null,
  feePercent: null,
  feeConstructionCost: null,
};

test("agreed fee per model", () => {
  assert.equal(agreedFee({ ...none, feeModel: "MILESTONES", feeTotal: 120000 }), 120000);
  assert.equal(
    agreedFee({
      ...none,
      feeModel: "RETAINER",
      feeMonthly: 5000,
      feeStartDate: "2026-01-15",
      feeEndDate: "2026-12-01",
    }),
    60000
  );
  assert.equal(
    agreedFee({ ...none, feeModel: "PERCENTAGE", feePercent: 2.5, feeConstructionCost: 4_000_000 }),
    100000
  );
  // Fields not filled yet.
  assert.equal(agreedFee({ ...none, feeModel: "PERCENTAGE", feePercent: 3 }), null);
  assert.equal(agreedFee(none), null);
});

test("retainer months count both ends", () => {
  assert.equal(retainerMonths("2026-01-15", "2026-03-01"), 3);
  assert.equal(retainerMonths("2026-11-01", "2027-02-28"), 4);
  assert.equal(retainerMonths("2026-05-01", "2026-04-01"), 0);
});

test("summary: collected, remaining, and what isn't scheduled yet", () => {
  const s = feeSummary({ ...none, feeModel: "MILESTONES", feeTotal: 100000 }, [
    { amount: 30000, paid: true },
    { amount: 30000, paid: false },
  ]);
  assert.deepEqual(s, {
    total: 100000,
    collected: 30000,
    remaining: 70000,
    scheduled: 60000,
    unscheduled: 40000,
    agreed: 100000,
  });
  // No model, but a schedule: the schedule is the total.
  assert.equal(feeSummary(none, [{ amount: 1000, paid: false }])?.total, 1000);
  // Nothing at all.
  assert.equal(feeSummary(none, []), null);
  assert.equal(feeProgress(none, []), null);
});

test("alert: a payment tied to a done stage that isn't paid", () => {
  const due = paymentsDueForDoneStages(
    [
      { id: "1", paid: false, stageId: "a" },
      { id: "2", paid: true, stageId: "a" },
      { id: "3", paid: false, stageId: "b" },
      { id: "4", paid: false, stageId: null },
    ],
    [
      { id: "a", status: "DONE" },
      { id: "b", status: "IN_PROGRESS" },
    ]
  );
  assert.deepEqual(due.map((p) => p.id), ["1"]);
});

test("retainer schedule: one payment a month, skipping months already scheduled", () => {
  // Before the billing settings existed: billed on the start date's day, due at once.
  const rows = retainerSchedule(
    { feeMonthly: 4000, feeStartDate: "2026-01-31", feeEndDate: "2026-04-01" },
    ["ריטיינר 2/2026"]
  );
  assert.deepEqual(
    rows.map((r) => [r.title, r.dueDate.toISOString().slice(0, 10)]),
    [
      ["ריטיינר 1/2026", "2026-01-31"],
      ["ריטיינר 3/2026", "2026-03-31"],
      ["ריטיינר 4/2026", "2026-04-30"],
    ]
  );
  assert.equal(rows[0].amount, 4000);
});

test("retainer billing day and payment terms (שוטף+30 / שוטף+60)", () => {
  const base = { feeMonthly: 5000, feeStartDate: "2026-01-15", feeEndDate: "2026-03-01" };
  const due = (o: object) =>
    retainerSchedule({ ...base, ...o }, []).map((r) => r.dueDate.toISOString().slice(0, 10));
  assert.deepEqual(due({ feeBillingDay: 1, feePaymentTermsDays: 0 }), ["2026-01-01", "2026-02-01", "2026-03-01"]);
  assert.deepEqual(due({ feeBillingDay: 10 }), ["2026-01-10", "2026-02-10", "2026-03-10"]);
  assert.deepEqual(due({ feeBillingDay: 0 }), ["2026-01-31", "2026-02-28", "2026-03-31"]);
  // שוטף+30: end of the billed month + 30 days
  assert.deepEqual(due({ feeBillingDay: 1, feePaymentTermsDays: 30 }), ["2026-03-02", "2026-03-30", "2026-04-30"]);
  assert.deepEqual(due({ feeBillingDay: 10, feePaymentTermsDays: 60 }).at(0), "2026-04-01");
});

test("phone, WhatsApp and Waze links", () => {
  assert.equal(telHref("050-123 4567"), "tel:0501234567");
  assert.equal(whatsappHref("050-123-4567"), "https://wa.me/972501234567");
  assert.equal(whatsappHref("+972 50 123 4567"), "https://wa.me/972501234567");
  assert.equal(whatsappHref("12"), null);
  assert.equal(
    wazeHref("הרצל 12", "ראשון לציון"),
    `https://waze.com/ul?q=${encodeURIComponent("הרצל 12, ראשון לציון")}&navigate=yes`
  );
  assert.equal(fullAddress("הרצל 12, ראשון לציון", "ראשון לציון"), "הרצל 12, ראשון לציון");
  assert.equal(wazeHref(null, null), null);
});
