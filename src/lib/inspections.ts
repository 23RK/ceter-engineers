import type {
  EmploymentType,
  InspectionKind,
  InspectionPaymentStatus,
  InspectionStatus,
  PaymentMethod,
} from "@prisma/client";

/** בדק בית (SPEC §4): labels, calculations and rules. Plain module, used on both sides. */

export const INSPECTION_STATUSES: {
  value: InspectionStatus;
  label: string;
  badge: string;
  dot: string;
}[] = [
  { value: "PENDING_SCHEDULING", label: "ממתין לתיאום", badge: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  { value: "SCHEDULED", label: "תואם", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  { value: "DONE", label: "בוצע", badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  { value: "REPORT_SENT", label: "דוח נשלח", badge: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  { value: "COMPLETED", label: "הושלם", badge: "bg-green-100 text-green-700", dot: "bg-green-500" },
  { value: "CANCELED", label: "בוטל", badge: "bg-red-100 text-red-700", dot: "bg-red-500" },
];

export const INSPECTION_KINDS: { value: InspectionKind; label: string }[] = [
  { value: "REGULAR", label: "רגילה" },
  { value: "REPEAT", label: "חוזרת" },
];

export const PAYMENT_STATUSES: { value: InspectionPaymentStatus; label: string; badge: string }[] = [
  { value: "UNPAID", label: "לא שולם", badge: "bg-red-50 text-red-700" },
  { value: "PARTIAL", label: "חלקי", badge: "bg-amber-50 text-amber-800" },
  { value: "PAID", label: "שולם", badge: "bg-green-50 text-green-700" },
];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "TRANSFER", label: "העברה" },
  { value: "BIT", label: "ביט" },
  { value: "PAYBOX", label: "פייבוקס" },
  { value: "CHECK", label: "צ'ק" },
  { value: "CASH", label: "מזומן" },
  { value: "CREDIT", label: "אשראי" },
];

export const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "OWNER", label: "בעלים" },
  { value: "FREELANCER", label: "פרילנסר" },
  { value: "EMPLOYEE", label: "עובד" },
];

const find = <T extends { value: string }>(list: T[], value: string) =>
  list.find((x) => x.value === value)!;
export const inspectionStatusMeta = (s: InspectionStatus) => find(INSPECTION_STATUSES, s);
export const paymentStatusMeta = (s: InspectionPaymentStatus) => find(PAYMENT_STATUSES, s);
export const paymentMethodLabel = (m: PaymentMethod) => find(PAYMENT_METHODS, m).label;
export const kindLabel = (k: InspectionKind) => find(INSPECTION_KINDS, k).label;
export const employmentLabel = (e: EmploymentType) => find(EMPLOYMENT_TYPES, e).label;

export const isInspectionStatus = (v: unknown): v is InspectionStatus =>
  INSPECTION_STATUSES.some((s) => s.value === v);
export const isPaymentStatus = (v: unknown): v is InspectionPaymentStatus =>
  PAYMENT_STATUSES.some((s) => s.value === v);
export const isPaymentMethod = (v: unknown): v is PaymentMethod =>
  PAYMENT_METHODS.some((s) => s.value === v);
export const isInspectionKind = (v: unknown): v is InspectionKind =>
  INSPECTION_KINDS.some((s) => s.value === v);
export const isEmploymentType = (v: unknown): v is EmploymentType =>
  EMPLOYMENT_TYPES.some((s) => s.value === v);

/** Statuses where the inspection was carried out. */
export const PERFORMED: InspectionStatus[] = ["DONE", "REPORT_SENT", "COMPLETED"];

/**
 * The automatic status rules (SPEC §4.2): "דוח נשלח" when the report is
 * marked sent; "הושלם" when the report is sent and the payment received.
 * Un-marking the report takes it back to "בוצע". A canceled one stays canceled.
 */
export function deriveStatus(
  current: InspectionStatus,
  reportSent: boolean,
  paymentStatus: InspectionPaymentStatus
): InspectionStatus {
  if (current === "CANCELED") return current;
  if (reportSent && paymentStatus === "PAID") return "COMPLETED";
  if (reportSent) return "REPORT_SENT";
  if (current === "REPORT_SENT" || current === "COMPLETED") return "DONE";
  return current;
}

/** Payment status from the amount paid. */
export function derivePaymentStatus(
  price: number | null,
  amountPaid: number
): InspectionPaymentStatus {
  if (amountPaid <= 0) return "UNPAID";
  if (price != null && amountPaid < price) return "PARTIAL";
  return "PAID";
}

export type RateRow = {
  inspectorId: string;
  apartmentTypeId: string | null;
  kind: InspectionKind;
  rate: number;
  multiUnitRate: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * תשלום לבודק (SPEC §4.2), from the inspector's rate: the row for this
 * property type, else the inspector's general row for this kind. Several
 * units in one visit use the reduced per-unit rate when there is one.
 * Owners (רון / גיא) are not paid: 0. No matching rate: null (entered by hand).
 */
export function inspectorPayFor(
  rates: RateRow[],
  inspector: { id: string; employmentType: EmploymentType } | null,
  apartmentTypeId: string | null,
  kind: InspectionKind,
  units: number
): number | null {
  if (!inspector) return null;
  if (inspector.employmentType === "OWNER") return 0;
  const mine = rates.filter((r) => r.inspectorId === inspector.id && r.kind === kind);
  const row =
    (apartmentTypeId && mine.find((r) => r.apartmentTypeId === apartmentTypeId)) ||
    mine.find((r) => r.apartmentTypeId === null);
  if (!row) return null;
  const n = Math.max(1, units);
  const perUnit = n > 1 && row.multiUnitRate != null ? row.multiUnitRate : row.rate;
  return round2(perUnit * n);
}

export type PriceTierRow = { apartmentTypeId: string; minUnits: number; unitPrice: number };

/**
 * מחיר ללקוח from the price list: the unit price of the highest tier that
 * the number of units reaches, times the units. A repeat inspection, or a
 * type without prices, has no automatic price (null - entered by hand).
 */
export function clientPriceFor(
  tiers: PriceTierRow[],
  apartmentTypeId: string | null,
  kind: InspectionKind,
  units: number
): number | null {
  if (kind === "REPEAT" || !apartmentTypeId) return null;
  const n = Math.max(1, units);
  const tier = tiers
    .filter((t) => t.apartmentTypeId === apartmentTypeId && t.minUnits <= n)
    .sort((a, b) => b.minUnits - a.minUnits)[0];
  return tier ? round2(tier.unitPrice * n) : null;
}

export function withVat(amount: number, vatRate: number) {
  return round2(amount * (1 + vatRate / 100));
}

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
/** עמודת "יום" - computed from the date (SPEC §4.1). Dates are UTC-midnight date-only values. */
export function dayName(date: Date | string) {
  return DAY_NAMES[new Date(date).getUTCDay()];
}

export function monthKey(date: Date | string) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Adds n months to a "yyyy-mm" key. */
export function shiftMonth(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return monthKey(d);
}

export type MoneyRow = {
  status: InspectionStatus;
  price: number | null;
  amountPaid: number;
  inspectorPay: number | null;
  inspectorPaid: boolean;
  paymentStatus: InspectionPaymentStatus;
  isOwner: boolean;
};

/**
 * Summary of a group of inspections (SPEC §4.1 - computed in code, not with
 * spreadsheet cells): count, revenue, paid to inspectors, profit, unpaid.
 * Canceled inspections don't count. Owners are never owed pay.
 */
export function summarize(rows: MoneyRow[]) {
  const live = rows.filter((r) => r.status !== "CANCELED");
  const revenue = round2(live.reduce((s, r) => s + (r.price ?? 0), 0));
  const toInspectors = round2(
    live.filter((r) => !r.isOwner).reduce((s, r) => s + (r.inspectorPay ?? 0), 0)
  );
  const unpaid = round2(
    live
      .filter((r) => r.paymentStatus !== "PAID")
      .reduce((s, r) => s + Math.max(0, (r.price ?? 0) - r.amountPaid), 0)
  );
  return {
    count: live.length,
    revenue,
    toInspectors,
    profit: round2(revenue - toInspectors),
    unpaid,
  };
}

export type AttentionRow = {
  id: string;
  date: Date | string | null;
  status: InspectionStatus;
  reportSent: boolean;
  reportSentAt: Date | string | null;
  paymentStatus: InspectionPaymentStatus;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * "דורש טיפול" (SPEC §4.3) and the alerts of §4.4, for date-only `today`:
 * carried out 2+ days ago without a report; report sent and not paid, by
 * age (0–7 / 8–30 / 30+ days); tomorrow's inspections not scheduled yet.
 */
export function needsAttention<T extends AttentionRow>(rows: T[], today: Date) {
  const t = today.getTime();
  const reportLate = rows.filter(
    (r) => r.status === "DONE" && !r.reportSent && r.date && t - new Date(r.date).getTime() >= 2 * DAY
  );
  const unpaid = rows.filter(
    (r) => r.reportSent && r.status !== "CANCELED" && r.paymentStatus !== "PAID"
  );
  const age = (r: T) =>
    Math.max(0, Math.round((t - new Date(r.reportSentAt ?? r.date ?? today).getTime()) / DAY));
  const tomorrow = t + DAY;
  return {
    reportLate,
    unpaid0to7: unpaid.filter((r) => age(r) <= 7),
    unpaid8to30: unpaid.filter((r) => age(r) >= 8 && age(r) <= 30),
    unpaid30plus: unpaid.filter((r) => age(r) > 30),
    tomorrowNotScheduled: rows.filter(
      (r) => r.status === "PENDING_SCHEDULING" && r.date && new Date(r.date).getTime() === tomorrow
    ),
  };
}

/** The 3 ready WhatsApp messages (SPEC §4.3). */
export function whatsappMessage(
  type: "reminder" | "report" | "payment",
  i: { clientName: string; date: Date | string | null; time: string | null; address: string | null; city: string | null; price: number | null },
  vatRate: number
) {
  const first = i.clientName.split(" ")[0];
  const when = i.date
    ? `${new Date(i.date).getUTCDate()}/${new Date(i.date).getUTCMonth() + 1}${i.time ? ` בשעה ${i.time}` : ""}`
    : "";
  const where = [i.address, i.city].filter(Boolean).join(", ");
  switch (type) {
    case "reminder":
      return `שלום ${first}, תזכורת לבדיקת בדק הבית${when ? ` ב-${when}` : ""}${where ? ` ב${where}` : ""}. כתר הנדסה`;
    case "report":
      return `שלום ${first}, דוח בדק הבית נשלח אליך במייל. נשמח לעמוד לרשותך בכל שאלה. כתר הנדסה`;
    case "payment":
      return `שלום ${first}, תזכורת לתשלום עבור בדיקת בדק הבית${
        i.price ? ` (${withVat(i.price, vatRate).toLocaleString("he-IL")} ₪ כולל מע"מ)` : ""
      }. תודה, כתר הנדסה`;
  }
}

/** Escape a value for CSV (Excel opens the file; a BOM keeps the Hebrew). */
export function toCsv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

// ---------------------------------------------------------------------------
// Editing an inspection. The same rules run on the server (saving) and in
// the browser (showing the change at once), so the two always agree.

export type InspectionRow = {
  id: string;
  date: Date | null;
  time: string | null;
  kind: InspectionKind;
  unitsCount: number;
  status: InspectionStatus;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  city: string | null;
  address: string | null;
  apartmentNumber: string | null;
  developerContractor: string | null;
  price: number | null;
  paymentStatus: InspectionPaymentStatus;
  amountPaid: number;
  paymentMethod: PaymentMethod | null;
  paidAt: Date | null;
  reportSent: boolean;
  reportSentAt: Date | null;
  inspectorPay: number | null;
  inspectorPaid: boolean;
  inspectorPaidAt: Date | null;
  notes: string | null;
  inspectorId: string | null;
  apartmentTypeId: string | null;
  parentInspectionId: string | null;
  createdAt: Date;
};

/** What can be edited; dates as "yyyy-mm-dd" (or null to clear). */
export type InspectionPatch = Partial<{
  date: string | null;
  time: string | null;
  kind: InspectionKind;
  unitsCount: number;
  status: InspectionStatus;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  city: string | null;
  address: string | null;
  apartmentNumber: string | null;
  developerContractor: string | null;
  price: number | null;
  paymentStatus: InspectionPaymentStatus;
  amountPaid: number;
  paymentMethod: PaymentMethod | null;
  paidAt: string | null;
  reportSent: boolean;
  inspectorPay: number | null;
  inspectorPaid: boolean;
  notes: string | null;
  inspectorId: string | null;
  apartmentTypeId: string | null;
}>;

export type PricingContext = {
  rates: RateRow[];
  tiers: PriceTierRow[];
  inspectors: { id: string; employmentType: EmploymentType }[];
  /** Today, date-only (Israel). */
  today: Date;
};

const TEXT_FIELDS = [
  "time",
  "clientPhone",
  "clientEmail",
  "city",
  "address",
  "apartmentNumber",
  "developerContractor",
  "notes",
] as const;

/**
 * "תואם" means a date and an inspector are set: a waiting inspection that
 * gets both becomes "תואם", and a scheduled one that loses either goes back
 * to "ממתין לתיאום".
 */
export function scheduleStatus(status: InspectionStatus, date: unknown, inspectorId: unknown) {
  const ready = !!date && !!inspectorId;
  if (status === "PENDING_SCHEDULING" && ready) return "SCHEDULED";
  if (status === "SCHEDULED" && !ready) return "PENDING_SCHEDULING";
  return status;
}

/** Apply an edit, with the automatic rules (amounts, payment, status). */
export function applyInspectionPatch<T extends InspectionRow>(
  row: T,
  patch: InspectionPatch,
  ctx: PricingContext
): T {
  const next = { ...row };
  const has = (k: keyof InspectionPatch) => k in patch;
  const toDate = (v: string | null | undefined) => (v ? new Date(v) : null);

  for (const k of TEXT_FIELDS) {
    if (has(k)) next[k] = (patch[k] as string | null | undefined)?.trim() || null;
  }
  if (has("clientName") && patch.clientName?.trim()) next.clientName = patch.clientName.trim();
  if (has("date")) next.date = toDate(patch.date);
  if (has("kind") && patch.kind) next.kind = patch.kind;
  if (has("unitsCount")) next.unitsCount = Math.max(1, Math.round(patch.unitsCount ?? 1));
  if (has("inspectorId")) next.inspectorId = patch.inspectorId ?? null;
  if (has("apartmentTypeId")) next.apartmentTypeId = patch.apartmentTypeId ?? null;
  if (has("price")) next.price = patch.price ?? null;
  if (has("inspectorPay")) next.inspectorPay = patch.inspectorPay ?? null;
  if (has("paymentMethod")) next.paymentMethod = patch.paymentMethod ?? null;
  if (has("paidAt")) next.paidAt = toDate(patch.paidAt);

  // Amounts follow the job when it changes - unless already paid, or edited by hand.
  const jobChanged = (["inspectorId", "apartmentTypeId", "unitsCount", "kind"] as const).some(
    (k) => has(k) && patch[k] !== row[k]
  );
  if (jobChanged && !has("inspectorPay") && !row.inspectorPaid) {
    const inspector = ctx.inspectors.find((i) => i.id === next.inspectorId) ?? null;
    next.inspectorPay = inspectorPayFor(ctx.rates, inspector, next.apartmentTypeId, next.kind, next.unitsCount);
  }
  const priceChanged = (["apartmentTypeId", "unitsCount", "kind"] as const).some(
    (k) => has(k) && patch[k] !== row[k]
  );
  if (priceChanged && !has("price") && row.paymentStatus === "UNPAID") {
    const auto = clientPriceFor(ctx.tiers, next.apartmentTypeId, next.kind, next.unitsCount);
    if (auto != null) next.price = auto;
  }

  if (has("inspectorPaid")) {
    next.inspectorPaid = !!patch.inspectorPaid;
    next.inspectorPaidAt = next.inspectorPaid ? (row.inspectorPaidAt ?? ctx.today) : null;
  }
  if (has("reportSent")) {
    next.reportSent = !!patch.reportSent;
    next.reportSentAt = next.reportSent ? (row.reportSentAt ?? ctx.today) : null;
  }

  // Payment: an explicit status wins; otherwise it follows the amounts.
  if (has("paymentStatus") && patch.paymentStatus) {
    next.paymentStatus = patch.paymentStatus;
    if (patch.paymentStatus === "PAID") {
      if (!has("amountPaid")) next.amountPaid = next.price ?? next.amountPaid;
    } else if (patch.paymentStatus === "UNPAID") {
      next.amountPaid = 0;
      next.paidAt = null;
    }
  }
  if (has("amountPaid")) next.amountPaid = Math.max(0, patch.amountPaid ?? 0);
  if (!has("paymentStatus") && (has("amountPaid") || has("price"))) {
    next.paymentStatus = derivePaymentStatus(next.price, next.amountPaid);
  }
  if (next.paymentStatus === "PAID" && !next.paidAt) next.paidAt = ctx.today;
  if (next.paymentStatus === "UNPAID") next.paidAt = null;

  // Status: set by hand, or by the automatic rules.
  if (has("status") && patch.status) {
    next.status = patch.status;
  } else {
    next.status = deriveStatus(
      scheduleStatus(next.status, next.date, next.inspectorId),
      next.reportSent,
      next.paymentStatus
    );
    // An untouched report/payment shouldn't move a not-yet-done inspection forward.
    if (!has("reportSent") && !has("paymentStatus") && !has("amountPaid") && !has("price")) {
      next.status = scheduleStatus(row.status, next.date, next.inspectorId);
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// Board filters (SPEC §4.3)

export type InspectionFilters = {
  /** Ready-made filters: לא שולם / ממתין לדוח / השבוע / שלי. */
  preset: "" | "unpaid" | "awaitingReport" | "thisWeek" | "mine";
  month: string; // "yyyy-mm" or ""
  from: string; // "yyyy-mm-dd" or ""
  to: string;
  inspectorId: string;
  status: InspectionStatus | "";
  payment: InspectionPaymentStatus | "";
  report: "" | "sent" | "notSent";
  developer: string;
  city: string;
  q: string;
};

export const EMPTY_FILTERS: InspectionFilters = {
  preset: "",
  month: "",
  from: "",
  to: "",
  inspectorId: "",
  status: "",
  payment: "",
  report: "",
  developer: "",
  city: "",
  q: "",
};

/** Sunday to Saturday of today's week (date-only values). */
export function weekRange(today: Date) {
  const start = new Date(today.getTime() - today.getUTCDay() * DAY);
  return { start, end: new Date(start.getTime() + 6 * DAY) };
}

const phoneDigits = (s: string) => s.replace(/\D/g, "");

export function filterInspections<T extends InspectionRow>(
  rows: T[],
  f: InspectionFilters,
  ctx: { today: Date; myInspectorId: string | null }
) {
  const q = f.q.trim().toLowerCase();
  const qDigits = phoneDigits(q);
  const week = weekRange(ctx.today);
  const time = (d: Date | null) => (d ? new Date(d).getTime() : null);
  return rows.filter((r) => {
    const t = time(r.date);
    switch (f.preset) {
      case "unpaid":
        if (!PERFORMED.includes(r.status) || r.paymentStatus === "PAID") return false;
        break;
      case "awaitingReport":
        if (r.status !== "DONE" || r.reportSent) return false;
        break;
      case "thisWeek":
        if (t == null || t < week.start.getTime() || t > week.end.getTime()) return false;
        break;
      case "mine":
        if (!ctx.myInspectorId || r.inspectorId !== ctx.myInspectorId) return false;
        break;
    }
    if (f.month && (!r.date || monthKey(r.date) !== f.month)) return false;
    if (f.from && (t == null || t < new Date(f.from).getTime())) return false;
    if (f.to && (t == null || t > new Date(f.to).getTime())) return false;
    if (f.inspectorId && r.inspectorId !== f.inspectorId) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.payment && r.paymentStatus !== f.payment) return false;
    if (f.report === "sent" && !r.reportSent) return false;
    if (f.report === "notSent" && r.reportSent) return false;
    if (f.developer && (r.developerContractor ?? "").trim() !== f.developer) return false;
    if (f.city && (r.city ?? "").trim() !== f.city) return false;
    if (q) {
      const text = [r.clientName, r.address, r.city, r.apartmentNumber].filter(Boolean).join(" ").toLowerCase();
      const phoneHit = qDigits.length >= 3 && !!r.clientPhone && phoneDigits(r.clientPhone).includes(qDigits);
      if (!text.includes(q) && !phoneHit) return false;
    }
    return true;
  });
}

/** Month groups: undated first, then months newest first; rows by date and time. */
export function groupByMonth<T extends InspectionRow>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const key = r.date ? monthKey(r.date) : "none";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const sortRows = (a: T, b: T) =>
    (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0) ||
    (a.time ?? "99").localeCompare(b.time ?? "99") ||
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "none" ? -1 : b === "none" ? 1 : b.localeCompare(a)))
    .map(([key, list]) => ({ key, rows: list.sort(sortRows) }));
}
