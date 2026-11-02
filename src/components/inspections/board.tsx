"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import {
  ChevronDown,
  CircleDollarSign,
  Download,
  FileCheck2,
  MessageCircle,
  Navigation,
  Phone,
  Plus,
  Repeat,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { PaymentMethod } from "@prisma/client";
import { Modal } from "@/components/ui/modal";
import { MoreMenu } from "@/components/ui/menu";
import { CheckCell, NumberCell, SelectCell, TextCell } from "@/components/inspections/cells";
import { InspectionForm, type FormSetup } from "@/components/inspections/inspection-form";
import { createRepeatInspection, updateInspection } from "@/lib/actions/inspections";
import {
  EMPTY_FILTERS,
  INSPECTION_KINDS,
  INSPECTION_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  applyInspectionPatch,
  dayName,
  filterInspections,
  groupByMonth,
  inspectionStatusMeta,
  monthKey,
  monthLabel,
  paymentMethodLabel,
  paymentStatusMeta,
  summarize,
  toCsv,
  whatsappMessage,
  withVat,
  type InspectionFilters,
  type InspectionPatch,
  type InspectionRow,
} from "@/lib/inspections";
import { telHref, wazeHref, whatsappHref } from "@/lib/contacts";
import { formatDateShort, formatMoney, toDateInputValue } from "@/lib/format";

export type BoardSetup = Omit<FormSetup, "inspectors"> & {
  inspectors: (FormSetup["inspectors"][number] & { color: string })[];
};

type Run = (id: string, patch: InspectionPatch) => void;

const PRESETS: { value: InspectionFilters["preset"]; label: string }[] = [
  { value: "unpaid", label: "לא שולם" },
  { value: "awaitingReport", label: "ממתין לדוח" },
  { value: "thisWeek", label: "השבוע" },
  { value: "mine", label: "שלי" },
];

/** Filters live in the URL so refresh / back keep them. */
function writeUrl(f: InspectionFilters) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(f)) {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  window.history.replaceState(null, "", url.pathname + url.search);
}

/**
 * לוח בדיקות (SPEC §4.3), monday-style: a group per month with a summary
 * row; the current month open and earlier ones folded; inline editing.
 */
export function InspectionsBoard({
  rows: serverRows,
  setup,
  developers,
  myInspectorId,
  today: todayIso,
  initialFilters,
  loadedFrom,
}: {
  rows: InspectionRow[];
  setup: BoardSetup;
  developers: string[];
  myInspectorId: string | null;
  today: string;
  initialFilters: InspectionFilters;
  /** First month loaded ("yyyy-mm"), or null when everything is loaded. */
  loadedFrom: string | null;
}) {
  const today = useMemo(() => new Date(todayIso), [todayIso]);
  const ctx = useMemo(
    () => ({ rates: setup.rates, tiers: setup.tiers, inspectors: setup.inspectors, today }),
    [setup, today]
  );
  const [rows, apply] = useOptimistic(serverRows, (state, { id, patch }: { id: string; patch: InspectionPatch }) =>
    state.map((r) => (r.id === id ? applyInspectionPatch(r, patch, ctx) : r))
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(
    Object.entries(initialFilters).some(([k, v]) => v && k !== "preset" && k !== "q")
  );
  const update = (p: Partial<InspectionFilters>) => setFilters((f) => ({ ...f, ...p }));
  useEffect(() => writeUrl(filters), [filters]);

  const run: Run = (id, patch) => {
    setError(null);
    startTransition(async () => {
      apply({ id, patch });
      try {
        const res = await updateInspection(id, patch);
        if (res.error) setError(res.error);
      } catch {
        setError("השינוי לא נשמר. נסו שוב.");
      }
    });
  };

  const visible = filterInspections(rows, filters, { today, myInspectorId });
  const groups = groupByMonth(visible);
  const filtering = Object.values(filters).some(Boolean);
  const currentMonth = monthKey(today);
  const isOwner = (id: string | null) =>
    setup.inspectors.find((i) => i.id === id)?.employmentType === "OWNER";
  const cities = [...new Set(rows.map((r) => r.city?.trim()).filter(Boolean) as string[])].sort();
  const months = [...new Set(rows.filter((r) => r.date).map((r) => monthKey(r.date!)))].sort().reverse();

  function exportCsv() {
    const insp = (id: string | null) => setup.inspectors.find((i) => i.id === id)?.name ?? "";
    const type = (id: string | null) => setup.apartmentTypes.find((t) => t.id === id)?.name ?? "";
    const csv = toCsv([
      ["תאריך", "יום", "שעה", "בודק", "סטטוס", "סוג בדיקה", "לקוח", "טלפון", "מייל", "עיר", "כתובת", "דירה", "סוג נכס", "כמות", "יזם/קבלן", 'מחיר (ללא מע"מ)', 'מחיר כולל מע"מ', "תשלום", "שולם (₪)", "אמצעי תשלום", "תאריך תשלום", "דוח נשלח", "תשלום לבודק", "שולם לבודק", "הערות"],
      ...groups.flatMap((g) =>
        g.rows.map((r) => [
          r.date ? toDateInputValue(r.date) : "",
          r.date ? dayName(r.date) : "",
          r.time,
          insp(r.inspectorId),
          inspectionStatusMeta(r.status).label,
          INSPECTION_KINDS.find((k) => k.value === r.kind)?.label,
          r.clientName,
          r.clientPhone,
          r.clientEmail,
          r.city,
          r.address,
          r.apartmentNumber,
          type(r.apartmentTypeId),
          r.unitsCount,
          r.developerContractor,
          r.price,
          r.price != null ? withVat(r.price, setup.vatRate) : "",
          paymentStatusMeta(r.paymentStatus).label,
          r.amountPaid,
          r.paymentMethod ? paymentMethodLabel(r.paymentMethod) : "",
          r.paidAt ? toDateInputValue(r.paidAt) : "",
          r.reportSent ? "כן" : "לא",
          r.inspectorPay,
          r.inspectorPaid ? "כן" : "לא",
          r.notes,
        ])
      ),
    ]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `בדק-בית-${filters.month || todayIso}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const select =
    "min-h-10 rounded-lg border border-black/10 bg-white px-3 text-sm shadow-sm outline-none focus:border-brand-500";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Modal
          title="בדיקה חדשה"
          trigger={
            <button className="flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
              <Plus size={16} />
              בדיקה חדשה
            </button>
          }
        >
          {(close) => <InspectionForm setup={setup} developers={developers} onDone={close} />}
        </Modal>
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-black/30" />
          <input
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="חיפוש: שם, טלפון או כתובת"
            aria-label="חיפוש"
            className={`${select} w-full pr-9`}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          aria-expanded={showFilters}
          className={`flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-sm ${
            showFilters ? "border-brand-500 bg-brand-50 text-brand-700" : "border-black/10 bg-white text-black/60"
          }`}
        >
          <SlidersHorizontal size={15} />
          סינון
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="flex min-h-10 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-sm font-medium text-black/60 shadow-sm hover:bg-black/5"
          title="ייצוא התצוגה המסוננת לקובץ שנפתח באקסל"
        >
          <Download size={15} />
          ייצוא לאקסל
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={filters.preset === p.value}
            onClick={() => update({ preset: filters.preset === p.value ? "" : p.value })}
            className={`min-h-9 rounded-full border px-3.5 text-sm font-medium transition ${
              filters.preset === p.value
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-black/10 bg-white text-black/60 hover:bg-black/5"
            }`}
          >
            {p.label}
          </button>
        ))}
        {filtering && (
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="min-h-9 px-2 text-sm text-brand-600 hover:underline">
            איפוס
          </button>
        )}
        <span className="ms-auto text-xs text-black/45">
          {visible.length === 1 ? "בדיקה אחת" : `${visible.length} בדיקות`}
        </span>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-black/5 bg-white p-3 shadow-sm sm:grid-cols-3 lg:grid-cols-5">
          <select aria-label="חודש" value={filters.month} onChange={(e) => update({ month: e.target.value })} className={select}>
            <option value="">כל החודשים</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-black/50">
            מ-
            <input type="date" value={filters.from} onChange={(e) => update({ from: e.target.value })} aria-label="מתאריך" className={`${select} w-full`} />
          </label>
          <label className="flex items-center gap-1 text-xs text-black/50">
            עד
            <input type="date" value={filters.to} onChange={(e) => update({ to: e.target.value })} aria-label="עד תאריך" className={`${select} w-full`} />
          </label>
          <select aria-label="בודק" value={filters.inspectorId} onChange={(e) => update({ inspectorId: e.target.value })} className={select}>
            <option value="">כל הבודקים</option>
            {setup.inspectors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <select aria-label="סטטוס" value={filters.status} onChange={(e) => update({ status: e.target.value as InspectionFilters["status"] })} className={select}>
            <option value="">כל הסטטוסים</option>
            {INSPECTION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select aria-label="תשלום" value={filters.payment} onChange={(e) => update({ payment: e.target.value as InspectionFilters["payment"] })} className={select}>
            <option value="">כל מצבי התשלום</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select aria-label="דוח" value={filters.report} onChange={(e) => update({ report: e.target.value as InspectionFilters["report"] })} className={select}>
            <option value="">דוח: הכל</option>
            <option value="sent">דוח נשלח</option>
            <option value="notSent">דוח לא נשלח</option>
          </select>
          <select aria-label="יזם / קבלן" value={filters.developer} onChange={(e) => update({ developer: e.target.value })} className={select}>
            <option value="">כל היזמים / קבלנים</option>
            {developers.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select aria-label="עיר" value={filters.city} onChange={(e) => update({ city: e.target.value })} className={select}>
            <option value="">כל הערים</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 py-16 text-center text-sm text-black/40">
          {rows.length === 0 ? 'עדיין אין בדיקות. לחצו על "בדיקה חדשה" כדי להתחיל.' : "אין בדיקות שמתאימות לסינון."}
        </div>
      ) : (
        groups.map((g) => (
          <MonthGroup
            key={g.key}
            label={g.key === "none" ? "ללא תאריך" : monthLabel(g.key)}
            defaultOpen={filtering || g.key === "none" || g.key >= currentMonth}
            rows={g.rows}
            summary={summarize(g.rows.map((r) => ({ ...r, isOwner: isOwner(r.inspectorId) })))}
            setup={setup}
            run={run}
          />
        ))
      )}

      {loadedFrom && (
        <a href="?range=all" className="self-center text-sm font-medium text-brand-600 hover:underline">
          מוצגים חודשים מ{monthLabel(loadedFrom)}. להצגת כל ההיסטוריה
        </a>
      )}
      <datalist id="developers-board">
        {developers.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
    </div>
  );
}

function MonthGroup({
  label,
  defaultOpen,
  rows,
  summary,
  setup,
  run,
}: {
  label: string;
  defaultOpen: boolean;
  rows: InspectionRow[];
  summary: ReturnType<typeof summarize>;
  setup: BoardSetup;
  run: Run;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [prevDefault, setPrevDefault] = useState(defaultOpen);
  if (prevDefault !== defaultOpen) {
    setPrevDefault(defaultOpen);
    setOpen(defaultOpen);
  }
  const vat = (n: number) => `${formatMoney(withVat(n, setup.vatRate))} כולל מע"מ`;

  return (
    <section className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-b border-black/5 bg-black/[0.02] px-4 py-3 text-right"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-brand-900">
          <ChevronDown size={16} className={`transition ${open ? "" : "-rotate-90"}`} />
          {label}
        </span>
        {/* The group's summary row (SPEC §4.3) */}
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/55">
          <span>
            <b className="text-brand-900">{summary.count}</b> בדיקות
          </span>
          <span title={vat(summary.revenue)}>
            הכנסות <b className="text-brand-900">{formatMoney(summary.revenue)}</b>
          </span>
          <span>
            לבודקים <b className="text-brand-900">{formatMoney(summary.toInspectors)}</b>
          </span>
          <span>
            רווח <b className="text-green-700">{formatMoney(summary.profit)}</b>
          </span>
          <span>
            לא שולם <b className={summary.unpaid ? "text-red-600" : "text-brand-900"}>{formatMoney(summary.unpaid)}</b>
          </span>
        </span>
      </button>

      {open && (
        <>
          {/* Wide screens: the table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-max min-w-full text-sm">
              <thead className="text-xs text-black/45">
                <tr className="border-b border-black/5">
                  {["תאריך", "שעה", "בודק", "סטטוס", "לקוח", "טלפון", "עיר", "כתובת", "דירה", "סוג נכס", "כמות", "יזם/קבלן", "מחיר", "תשלום", "אמצעי", "דוח", "לבודק", "הערות", ""].map((h, i) => (
                    <th key={i} className={`px-1.5 py-2 text-right font-medium whitespace-nowrap ${i === 0 ? "sticky right-0 z-10 bg-white" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map((r) => (
                  <TableRow key={r.id} row={r} setup={setup} run={run} />
                ))}
              </tbody>
            </table>
          </div>
          {/* Phones and tablets: cards */}
          <ul className="divide-y divide-black/5 lg:hidden">
            {rows.map((r) => (
              <CardRow key={r.id} row={r} setup={setup} run={run} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function StatusSelect({ row, run }: { row: InspectionRow; run: Run }) {
  const meta = inspectionStatusMeta(row.status);
  return (
    <select
      value={row.status}
      aria-label="סטטוס"
      onChange={(e) => run(row.id, { status: e.target.value as InspectionRow["status"] })}
      className={`min-h-8 cursor-pointer rounded-full border-0 py-1 pr-2.5 pl-6 text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500/30 ${meta.badge}`}
    >
      {INSPECTION_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

function PaymentCell({ row, run }: { row: InspectionRow; run: Run }) {
  const meta = paymentStatusMeta(row.paymentStatus);
  return (
    <div className="flex items-center gap-1">
      <select
        value={row.paymentStatus}
        aria-label="מצב תשלום"
        onChange={(e) => run(row.id, { paymentStatus: e.target.value as InspectionRow["paymentStatus"] })}
        className={`min-h-8 min-w-[5.5rem] cursor-pointer rounded-md border-0 px-1.5 text-xs font-semibold outline-none ${meta.badge}`}
      >
        {PAYMENT_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {row.paymentStatus === "PARTIAL" && (
        <NumberCell value={row.amountPaid} onSave={(v) => run(row.id, { amountPaid: v ?? 0 })} label="סכום ששולם" className="w-20 text-xs" />
      )}
    </div>
  );
}

/** Quick actions (SPEC §4.3): paid, report sent, WhatsApp, repeat inspection, Waze. */
function RowActions({ row, setup, run }: { row: InspectionRow; setup: BoardSetup; run: Run }) {
  const [paying, setPaying] = useState(false);
  const [, start] = useTransition();
  const waze = wazeHref(row.address, row.city);
  const wa = (type: "reminder" | "report" | "payment") =>
    whatsappHref(row.clientPhone, whatsappMessage(type, row, setup.vatRate));
  const btn = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition";
  return (
    <div className="flex items-center gap-1">
      {row.paymentStatus !== "PAID" && row.status !== "CANCELED" && (
        <button type="button" onClick={() => setPaying(true)} title="סמן שולם" aria-label="סמן שולם" className={`${btn} text-green-700 hover:bg-green-50`}>
          <CircleDollarSign size={17} />
        </button>
      )}
      {!row.reportSent && row.status !== "CANCELED" && (
        <button type="button" onClick={() => run(row.id, { reportSent: true })} title="סמן דוח נשלח" aria-label="סמן דוח נשלח" className={`${btn} text-purple-700 hover:bg-purple-50`}>
          <FileCheck2 size={17} />
        </button>
      )}
      {waze && (
        <a href={waze} target="_blank" rel="noopener noreferrer" title="Waze" aria-label="ניווט ב-Waze" className={`${btn} text-sky-700 hover:bg-sky-50`}>
          <Navigation size={16} />
        </a>
      )}
      <MoreMenu
        items={[
          ...(row.clientPhone
            ? [
                { label: "וואטסאפ: תזכורת לבדיקה", icon: <MessageCircle size={15} />, onSelect: () => window.open(wa("reminder")!, "_blank") },
                { label: "וואטסאפ: הדוח נשלח", icon: <MessageCircle size={15} />, onSelect: () => window.open(wa("report")!, "_blank") },
                { label: "וואטסאפ: תזכורת תשלום", icon: <MessageCircle size={15} />, onSelect: () => window.open(wa("payment")!, "_blank") },
              ]
            : []),
          {
            label: "צור בדיקה חוזרת",
            icon: <Repeat size={15} />,
            onSelect: () => start(async () => void (await createRepeatInspection(row.id))),
          },
        ]}
      />
      <Modal title={`סימון תשלום: ${row.clientName}`} open={paying} onOpenChange={setPaying}>
        {(close) => (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-black/60">
              {row.price != null ? (
                <>
                  {formatMoney(row.price)} ({formatMoney(withVat(row.price, setup.vatRate))} כולל מע&quot;מ). באיזה אמצעי שולם?
                </>
              ) : (
                "לבדיקה אין מחיר. באיזה אמצעי שולם?"
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    close();
                    run(row.id, { paymentStatus: "PAID", paymentMethod: m.value as PaymentMethod });
                  }}
                  className="min-h-11 rounded-lg border border-black/10 text-sm font-semibold text-brand-900 hover:border-green-500 hover:bg-green-50"
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TableRow({ row, setup, run }: { row: InspectionRow; setup: BoardSetup; run: Run }) {
  const set = (patch: InspectionPatch) => run(row.id, patch);
  const inspector = setup.inspectors.find((i) => i.id === row.inspectorId);
  const canceled = row.status === "CANCELED";
  return (
    <tr className={`group align-middle ${canceled ? "opacity-50" : ""} hover:bg-brand-50/30`}>
      <td className="sticky right-0 z-10 bg-white px-1.5 py-1 group-hover:bg-brand-50">
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={toDateInputValue(row.date)}
            onChange={(e) => set({ date: e.target.value || null })}
            aria-label="תאריך"
            className="min-h-9 w-[8.2rem] rounded-md border border-transparent bg-transparent px-1 text-sm outline-none hover:bg-black/[0.04] focus:border-brand-400"
          />
          <span className="w-10 text-xs text-black/45">{row.date ? dayName(row.date) : ""}</span>
        </div>
      </td>
      <td className="px-1 py-1">
        <TextCell value={row.time} onSave={(v) => set({ time: v })} label="שעה" type="time" className="w-[6.2rem]" />
      </td>
      <td className="px-1 py-1">
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: inspector?.color ?? "#cbd5e1" }} />
          <SelectCell
            value={row.inspectorId}
            options={setup.inspectors.filter((i) => i.active || i.id === row.inspectorId).map((i) => ({ value: i.id, label: i.name }))}
            onSave={(v) => set({ inspectorId: v })}
            label="בודק"
            empty="—"
            className="w-28"
          />
        </div>
      </td>
      <td className="px-1 py-1">
        <StatusSelect row={row} run={run} />
      </td>
      <td className="px-1 py-1">
        <TextCell value={row.clientName} onSave={(v) => v && set({ clientName: v })} label="לקוח" className="w-36 font-semibold" />
        {row.kind === "REPEAT" && <span className="mr-1.5 text-[10px] font-semibold text-amber-700">חוזרת</span>}
      </td>
      <td className="px-1 py-1">
        <div className="flex items-center">
          <TextCell value={row.clientPhone} onSave={(v) => set({ clientPhone: v })} label="טלפון" dir="ltr" type="tel" className="w-28" />
          {telHref(row.clientPhone) && (
            <a href={telHref(row.clientPhone)!} aria-label="התקשרות" className="flex h-8 w-7 items-center justify-center text-black/30 hover:text-brand-600">
              <Phone size={13} />
            </a>
          )}
        </div>
      </td>
      <td className="px-1 py-1">
        <TextCell value={row.city} onSave={(v) => set({ city: v })} label="עיר" className="w-24" />
      </td>
      <td className="px-1 py-1">
        <TextCell value={row.address} onSave={(v) => set({ address: v })} label="כתובת" className="w-36" />
      </td>
      <td className="px-1 py-1">
        <TextCell value={row.apartmentNumber} onSave={(v) => set({ apartmentNumber: v })} label="דירה" className="w-14" />
      </td>
      <td className="px-1 py-1">
        <SelectCell
          value={row.apartmentTypeId}
          options={setup.apartmentTypes.filter((t) => t.active || t.id === row.apartmentTypeId).map((t) => ({ value: t.id, label: t.name }))}
          onSave={(v) => set({ apartmentTypeId: v })}
          label="סוג נכס"
          empty="—"
          className="w-28"
        />
      </td>
      <td className="px-1 py-1">
        <NumberCell value={row.unitsCount} onSave={(v) => set({ unitsCount: v ?? 1 })} label="כמות" min={1} integer className="w-12" />
      </td>
      <td className="px-1 py-1">
        <TextCell value={row.developerContractor} onSave={(v) => set({ developerContractor: v })} label="יזם / קבלן" list="developers-board" className="w-32" />
      </td>
      <td className="px-1 py-1" title={row.price != null ? `${formatMoney(withVat(row.price, setup.vatRate))} כולל מע"מ` : undefined}>
        <NumberCell value={row.price} onSave={(v) => set({ price: v })} label='מחיר ללא מע"מ' className="w-20 font-semibold" />
      </td>
      <td className="px-1 py-1">
        <PaymentCell row={row} run={run} />
      </td>
      <td className="px-1 py-1">
        <SelectCell value={row.paymentMethod} options={PAYMENT_METHODS} onSave={(v) => set({ paymentMethod: v })} label="אמצעי תשלום" empty="—" className="w-24 text-xs" />
      </td>
      <td className="px-1 py-1">
        <CheckCell checked={row.reportSent} onSave={(v) => set({ reportSent: v })} label="דוח נשלח" text={row.reportSent ? formatDateShort(row.reportSentAt) ?? "נשלח" : "לא"} tone="purple" />
      </td>
      <td className="px-1 py-1">
        {inspector?.employmentType === "OWNER" ? (
          <span className="px-1.5 text-xs text-black/35">בעלים</span>
        ) : (
          <div className="flex items-center gap-0.5">
            <NumberCell value={row.inspectorPay} onSave={(v) => set({ inspectorPay: v })} label="תשלום לבודק" className="w-16" />
            <CheckCell checked={row.inspectorPaid} onSave={(v) => set({ inspectorPaid: v })} label="שולם לבודק" text={row.inspectorPaid ? "שולם" : ""} tone="green" />
          </div>
        )}
      </td>
      <td className="px-1 py-1">
        <TextCell value={row.notes} onSave={(v) => set({ notes: v })} label="הערות" className="w-40" />
      </td>
      <td className="px-1 py-1">
        <RowActions row={row} setup={setup} run={run} />
      </td>
    </tr>
  );
}

/** Phones: the key details, quick actions, and the rest in "פרטים מלאים". */
function CardRow({ row, setup, run }: { row: InspectionRow; setup: BoardSetup; run: Run }) {
  const inspector = setup.inspectors.find((i) => i.id === row.inspectorId);
  const type = setup.apartmentTypes.find((t) => t.id === row.apartmentTypeId);
  const tel = telHref(row.clientPhone);
  const pay = paymentStatusMeta(row.paymentStatus);
  return (
    <li className={`flex flex-col gap-2 px-4 py-3 ${row.status === "CANCELED" ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-black/50">
            {row.date ? `${dayName(row.date)} ${formatDateShort(row.date)}` : "ללא תאריך"}
            {row.time && ` · ${row.time}`}
          </p>
          <p className="truncate text-sm font-bold text-brand-900">
            {row.clientName}
            {row.kind === "REPEAT" && <span className="mr-1.5 text-[11px] font-semibold text-amber-700">חוזרת</span>}
          </p>
          <p className="truncate text-xs text-black/50">
            {[row.address, row.apartmentNumber && `דירה ${row.apartmentNumber}`, row.city].filter(Boolean).join(", ") || "—"}
          </p>
        </div>
        <StatusSelect row={row} run={run} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-black/55">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: inspector?.color ?? "#cbd5e1" }} />
          {inspector?.name ?? "ללא בודק"}
        </span>
        {type && (
          <span>
            {type.name}
            {row.unitsCount > 1 && ` × ${row.unitsCount}`}
          </span>
        )}
        <span className="font-semibold text-brand-900">{formatMoney(row.price) ?? "ללא מחיר"}</span>
        <span className={`rounded px-1.5 py-0.5 font-semibold ${pay.badge}`}>{pay.label}</span>
        <span className={row.reportSent ? "font-semibold text-purple-700" : ""}>{row.reportSent ? "דוח נשלח" : "דוח לא נשלח"}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {tel && (
            <a href={tel} aria-label="התקשרות" className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Phone size={15} />
            </a>
          )}
          <Modal
            title={`פרטים: ${row.clientName}`}
            trigger={
              <button type="button" className="min-h-9 rounded-lg border border-black/10 px-3 text-xs font-semibold text-brand-900">
                פרטים מלאים
              </button>
            }
          >
            {() => <DetailsEditor row={row} setup={setup} run={run} />}
          </Modal>
        </div>
        <RowActions row={row} setup={setup} run={run} />
      </div>
    </li>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5 text-xs font-medium text-black/50">
      {label}
      <span className="rounded-lg border border-black/10">{children}</span>
    </label>
  );
}

/** Every field, edited in place (phones; the table shows them inline). */
function DetailsEditor({ row, setup, run }: { row: InspectionRow; setup: BoardSetup; run: Run }) {
  const set = (patch: InspectionPatch) => run(row.id, patch);
  const inspector = setup.inspectors.find((i) => i.id === row.inspectorId);
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <F label="תאריך">
        <input type="date" value={toDateInputValue(row.date)} onChange={(e) => set({ date: e.target.value || null })} aria-label="תאריך" className="min-h-9 w-full bg-transparent px-1.5 text-sm outline-none" />
      </F>
      <F label="שעה">
        <TextCell value={row.time} onSave={(v) => set({ time: v })} label="שעה" type="time" />
      </F>
      <F label="בודק">
        <SelectCell value={row.inspectorId} options={setup.inspectors.filter((i) => i.active || i.id === row.inspectorId).map((i) => ({ value: i.id, label: i.name }))} onSave={(v) => set({ inspectorId: v })} label="בודק" empty="—" />
      </F>
      <F label="סוג בדיקה">
        <SelectCell value={row.kind} options={INSPECTION_KINDS} onSave={(v) => v && set({ kind: v })} label="סוג בדיקה" />
      </F>
      <F label="לקוח">
        <TextCell value={row.clientName} onSave={(v) => v && set({ clientName: v })} label="לקוח" />
      </F>
      <F label="טלפון">
        <TextCell value={row.clientPhone} onSave={(v) => set({ clientPhone: v })} label="טלפון" dir="ltr" type="tel" />
      </F>
      <div className="col-span-2">
        <F label="מייל">
          <TextCell value={row.clientEmail} onSave={(v) => set({ clientEmail: v })} label="מייל" dir="ltr" type="email" />
        </F>
      </div>
      <F label="עיר">
        <TextCell value={row.city} onSave={(v) => set({ city: v })} label="עיר" />
      </F>
      <F label="דירה">
        <TextCell value={row.apartmentNumber} onSave={(v) => set({ apartmentNumber: v })} label="דירה" />
      </F>
      <div className="col-span-2">
        <F label="כתובת">
          <TextCell value={row.address} onSave={(v) => set({ address: v })} label="כתובת" />
        </F>
      </div>
      <F label="סוג נכס">
        <SelectCell value={row.apartmentTypeId} options={setup.apartmentTypes.filter((t) => t.active || t.id === row.apartmentTypeId).map((t) => ({ value: t.id, label: t.name }))} onSave={(v) => set({ apartmentTypeId: v })} label="סוג נכס" empty="—" />
      </F>
      <F label="כמות">
        <NumberCell value={row.unitsCount} onSave={(v) => set({ unitsCount: v ?? 1 })} label="כמות" min={1} integer />
      </F>
      <div className="col-span-2">
        <F label="יזם / קבלן">
          <TextCell value={row.developerContractor} onSave={(v) => set({ developerContractor: v })} label="יזם / קבלן" list="developers-board" />
        </F>
      </div>
      <F label='מחיר (ללא מע"מ)'>
        <NumberCell value={row.price} onSave={(v) => set({ price: v })} label="מחיר" />
      </F>
      <F label="תשלום">
        <PaymentCell row={row} run={run} />
      </F>
      <F label="אמצעי תשלום">
        <SelectCell value={row.paymentMethod} options={PAYMENT_METHODS} onSave={(v) => set({ paymentMethod: v })} label="אמצעי תשלום" empty="—" />
      </F>
      <F label="דוח נשלח">
        <CheckCell checked={row.reportSent} onSave={(v) => set({ reportSent: v })} label="דוח נשלח" text={row.reportSent ? "נשלח" : "לא נשלח"} tone="purple" />
      </F>
      {inspector?.employmentType !== "OWNER" && (
        <>
          <F label="תשלום לבודק">
            <NumberCell value={row.inspectorPay} onSave={(v) => set({ inspectorPay: v })} label="תשלום לבודק" />
          </F>
          <F label="שולם לבודק">
            <CheckCell checked={row.inspectorPaid} onSave={(v) => set({ inspectorPaid: v })} label="שולם לבודק" text={row.inspectorPaid ? "שולם" : "לא שולם"} tone="green" />
          </F>
        </>
      )}
      <div className="col-span-2">
        <F label="הערות">
          <TextCell value={row.notes} onSave={(v) => set({ notes: v })} label="הערות" />
        </F>
      </div>
    </div>
  );
}
