import type { FeeModel, StageStatus } from "@prisma/client";

/** שכר טרחה (SPEC §3.5): the three fee models and what each one asks for. */
export const FEE_MODELS: { value: FeeModel; label: string; hint: string }[] = [
  {
    value: "MILESTONES",
    label: "סכום כולל לפי אבני דרך",
    hint: "סכום כולל, שמתחלק לתשלומים שמקושרים לשלבים",
  },
  {
    value: "RETAINER",
    label: "ריטיינר חודשי",
    hint: "סכום לחודש, מתאריך התחלה עד תאריך סיום",
  },
  {
    value: "PERCENTAGE",
    label: "אחוז מעלות הבנייה",
    hint: "אחוז מתוך עלות הבנייה המשוערת, ולוח תשלומים",
  },
];

export function feeModelMeta(model: FeeModel) {
  return FEE_MODELS.find((m) => m.value === model)!;
}

export function isFeeModel(value: unknown): value is FeeModel {
  return FEE_MODELS.some((m) => m.value === value);
}

export type FeeTerms = {
  feeModel: FeeModel | null;
  feeTotal: number | null;
  feeMonthly: number | null;
  feeStartDate: Date | string | null;
  feeEndDate: Date | string | null;
  feePercent: number | null;
  feeConstructionCost: number | null;
};

type PaymentLike = { amount: number; paid: boolean };

const sum = (values: number[]) =>
  Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

/** Calendar months from start to end, both included (Jan 15 – Mar 1 = 3). */
export function retainerMonths(start: Date | string, end: Date | string) {
  const s = new Date(start);
  const e = new Date(end);
  const months =
    (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + 1;
  return Math.max(0, months);
}

/**
 * The agreed fee, from the model's own fields. null when the model's fields
 * aren't filled yet (then the schedule's sum is used - see feeSummary).
 */
export function agreedFee(terms: FeeTerms): number | null {
  switch (terms.feeModel) {
    case "MILESTONES":
      return terms.feeTotal ?? null;
    case "RETAINER":
      if (terms.feeMonthly == null || !terms.feeStartDate || !terms.feeEndDate) return null;
      return sum([terms.feeMonthly * retainerMonths(terms.feeStartDate, terms.feeEndDate)]);
    case "PERCENTAGE":
      if (terms.feePercent == null || terms.feeConstructionCost == null) return null;
      return sum([(terms.feePercent * terms.feeConstructionCost) / 100]);
    default:
      return null;
  }
}

export type FeeSummary = {
  /** The total to collect: the agreed fee, else the sum of the schedule. */
  total: number;
  collected: number;
  remaining: number;
  /** Sum of all scheduled payments. */
  scheduled: number;
  /** Agreed fee minus what's scheduled (0 when they match or there's no agreed fee). */
  unscheduled: number;
  agreed: number | null;
};

export function feeSummary(terms: FeeTerms, payments: PaymentLike[]): FeeSummary | null {
  const agreed = agreedFee(terms);
  const scheduled = sum(payments.map((p) => p.amount));
  const collected = sum(payments.filter((p) => p.paid).map((p) => p.amount));
  const total = agreed ?? scheduled;
  if (!terms.feeModel && payments.length === 0) return null;
  return {
    total,
    collected,
    remaining: sum([total - collected]),
    scheduled,
    unscheduled: agreed == null ? 0 : sum([agreed - scheduled]),
    agreed,
  };
}

/** For the department screen: collected out of total, or null. */
export function feeProgress(terms: FeeTerms, payments: PaymentLike[]) {
  const summary = feeSummary(terms, payments);
  return summary && summary.total > 0
    ? { collected: summary.collected, total: summary.total }
    : null;
}

/**
 * SPEC §3.5 alert: a payment tied to a stage that's done, but not collected.
 */
export function paymentsDueForDoneStages<
  P extends { paid: boolean; stageId: string | null },
>(payments: P[], stages: { id: string; status: StageStatus }[]) {
  const done = new Set(stages.filter((s) => s.status === "DONE").map((s) => s.id));
  return payments.filter((p) => !p.paid && p.stageId && done.has(p.stageId));
}

/** יום הגבייה בחודש: 1 / 10 / 0 = סוף החודש. */
export const BILLING_DAYS = [
  { value: 1, label: "ב-1 לחודש" },
  { value: 10, label: "ב-10 לחודש" },
  { value: 0, label: "בסוף החודש" },
] as const;

/** תנאי תשלום: מיידי, או שוטף + X (סוף חודש החיוב + X ימים). */
export const PAYMENT_TERMS = [
  { value: 0, label: "מיידי (ביום החיוב)" },
  { value: 30, label: "שוטף+30" },
  { value: 60, label: "שוטף+60" },
] as const;

export type RetainerTerms = Pick<FeeTerms, "feeMonthly" | "feeStartDate" | "feeEndDate"> & {
  /** null = the start date's day (as before these settings existed). */
  feeBillingDay?: number | null;
  feePaymentTermsDays?: number | null;
};

const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/**
 * One payment per month of the period (start month to end month, both in).
 * Each month is billed on the billing day; it's due then (מיידי), or at the
 * end of that month plus 30 / 60 days (שוטף+30 / שוטף+60). Months that already
 * have their retainer payment (same title) are skipped.
 */
export function retainerSchedule(
  terms: RetainerTerms,
  existingTitles: (string | null)[]
): { amount: number; dueDate: Date; title: string }[] {
  if (terms.feeMonthly == null || !terms.feeStartDate || !terms.feeEndDate) return [];
  const start = new Date(terms.feeStartDate);
  const months = retainerMonths(start, terms.feeEndDate);
  const have = new Set(existingTitles.filter(Boolean));
  const termsDays = terms.feePaymentTermsDays ?? 0;
  const out: { amount: number; dueDate: Date; title: string }[] = [];
  for (let i = 0; i < months; i++) {
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth() + i;
    const last = lastDayOf(y, m);
    const day =
      terms.feeBillingDay == null
        ? Math.min(start.getUTCDate(), last)
        : terms.feeBillingDay === 0
          ? last
          : Math.min(terms.feeBillingDay, last);
    const billed = new Date(Date.UTC(y, m, day));
    const title = `ריטיינר ${billed.getUTCMonth() + 1}/${billed.getUTCFullYear()}`;
    if (have.has(title)) continue;
    const dueDate =
      termsDays > 0
        ? new Date(Date.UTC(y, m, last) + termsDays * 24 * 60 * 60 * 1000) // שוטף + X
        : billed;
    out.push({ amount: terms.feeMonthly, dueDate, title });
  }
  return out;
}
