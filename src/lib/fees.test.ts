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
  const rows = retainerSchedule(
    { feeMonthly: 4000, feeStartDate: "2026-01-31", feeEndDate: "2026-04-01" },
    ["2026-02-10"]
  );
  assert.deepEqual(
    rows.map((r) => r.dueDate.toISOString().slice(0, 10)),
    ["2026-01-31", "2026-03-31", "2026-04-30"]
  );
  assert.equal(rows[0].amount, 4000);
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
