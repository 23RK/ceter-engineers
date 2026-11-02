"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ChevronDown, Download, Printer } from "lucide-react";
import type { InspectionKind } from "@prisma/client";
import { markInspectorMonthPaid, updateInspection } from "@/lib/actions/inspections";
import { kindLabel, monthLabel, toCsv } from "@/lib/inspections";
import { formatDateShort, formatMoney, toDateInputValue } from "@/lib/format";

type Row = {
  id: string;
  date: Date | null;
  clientName: string;
  city: string | null;
  address: string | null;
  unitsCount: number;
  kind: InspectionKind;
  inspectorPay: number | null;
  inspectorPaid: boolean;
  inspectorPaidAt: Date | null;
  inspector: { id: string; name: string; color: string } | null;
  apartmentType: { name: string } | null;
};

type Change = { ids: string[]; paid: boolean };

/** Per inspector for the month: count, total, paid, balance - and the list. */
export function Payouts({ month, inspections }: { month: string; inspections: Row[] }) {
  const [rows, apply] = useOptimistic(inspections, (state, c: Change) =>
    state.map((r) => (c.ids.includes(r.id) ? { ...r, inspectorPaid: c.paid, inspectorPaidAt: c.paid ? (r.inspectorPaidAt ?? new Date()) : null } : r))
  );
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (c: Change, save: () => Promise<{ error?: string }>) => {
    setError(null);
    start(async () => {
      apply(c);
      try {
        const res = await save();
        if (res.error) setError(res.error);
      } catch {
        setError("השינוי לא נשמר. נסו שוב.");
      }
    });
  };

  const byInspector = new Map<string, { inspector: NonNullable<Row["inspector"]>; rows: Row[] }>();
  for (const r of rows) {
    if (!r.inspector) continue;
    const g = byInspector.get(r.inspector.id) ?? { inspector: r.inspector, rows: [] };
    g.rows.push(r);
    byInspector.set(r.inspector.id, g);
  }
  const groups = [...byInspector.values()].sort((a, b) => a.inspector.name.localeCompare(b.inspector.name, "he"));
  const total = (list: Row[]) => list.reduce((s, r) => s + (r.inspectorPay ?? 0), 0);
  const paid = (list: Row[]) => list.filter((r) => r.inspectorPaid).reduce((s, r) => s + (r.inspectorPay ?? 0), 0);

  function exportCsv() {
    const csv = toCsv([
      ["בודק", "תאריך", "לקוח", "עיר", "כתובת", "סוג נכס", "כמות", "סוג בדיקה", "תשלום לבודק", "שולם", "תאריך תשלום"],
      ...groups.flatMap((g) =>
        g.rows.map((r) => [
          g.inspector.name,
          r.date ? toDateInputValue(r.date) : "",
          r.clientName,
          r.city,
          r.address,
          r.apartmentType?.name,
          r.unitsCount,
          kindLabel(r.kind),
          r.inspectorPay,
          r.inspectorPaid ? "כן" : "לא",
          r.inspectorPaidAt ? toDateInputValue(r.inspectorPaidAt) : "",
        ])
      ),
    ]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `תשלומים-לבודקים-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={exportCsv} className="flex min-h-10 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-sm font-medium text-black/60 shadow-sm hover:bg-black/5">
          <Download size={15} />
          ייצוא לאקסל
        </button>
        <button type="button" onClick={() => window.print()} className="flex min-h-10 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-sm font-medium text-black/60 shadow-sm hover:bg-black/5">
          <Printer size={15} />
          הדפסה / PDF
        </button>
      </div>
      <h2 className="hidden text-lg font-bold print:block">תשלומים לבודקים: {monthLabel(month)}</h2>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 bg-white/60 py-16 text-center text-sm text-black/40">
          אין בדיקות של בודקים חיצוניים שבוצעו בחודש הזה.
        </p>
      ) : (
        groups.map((g) => {
          const t = total(g.rows);
          const p = paid(g.rows);
          const open = g.rows.filter((r) => !r.inspectorPaid).map((r) => r.id);
          return (
            <InspectorCard
              key={g.inspector.id}
              name={g.inspector.name}
              color={g.inspector.color}
              count={g.rows.length}
              total={t}
              paid={p}
              onMarkAll={
                open.length
                  ? () => {
                      if (confirm(`לסמן את כל ${open.length} הבדיקות של ${g.inspector.name} ב${monthLabel(month)} כשולמו?`)) {
                        run({ ids: open, paid: true }, () => markInspectorMonthPaid(g.inspector.id, month));
                      }
                    }
                  : null
              }
            >
              <ul className="divide-y divide-black/5">
                {g.rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-16 shrink-0 text-xs text-black/50">{formatDateShort(r.date)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-brand-900">{r.clientName}</span>
                      <span className="block truncate text-xs text-black/45">
                        {[r.address, r.city, r.apartmentType?.name, r.unitsCount > 1 ? `${r.unitsCount} דירות` : null, r.kind === "REPEAT" ? "חוזרת" : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold text-brand-900">{formatMoney(r.inspectorPay) ?? "—"}</span>
                    <label className={`flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium print:hidden ${r.inspectorPaid ? "bg-green-100 text-green-800" : "text-black/50 hover:bg-black/5"}`}>
                      <input
                        type="checkbox"
                        checked={r.inspectorPaid}
                        onChange={(e) => run({ ids: [r.id], paid: e.target.checked }, () => updateInspection(r.id, { inspectorPaid: e.target.checked }))}
                        className="accent-brand-600"
                      />
                      {r.inspectorPaid ? "שולם" : "לא שולם"}
                    </label>
                    <span className="hidden text-xs print:inline">{r.inspectorPaid ? "שולם" : "לא שולם"}</span>
                  </li>
                ))}
              </ul>
            </InspectorCard>
          );
        })
      )}
    </div>
  );
}

function InspectorCard({
  name,
  color,
  count,
  total,
  paid,
  onMarkAll,
  children,
}: {
  name: string;
  color: string;
  count: number;
  total: number;
  paid: number;
  onMarkAll: (() => void) | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const balance = Math.round((total - paid) * 100) / 100;
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm break-inside-avoid sm:p-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="flex min-w-32 items-center gap-2 text-base font-bold text-brand-900">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          {name}
        </p>
        <Stat label="בדיקות" value={String(count)} />
        <Stat label='סה"כ' value={formatMoney(total)!} />
        <Stat label="שולם" value={formatMoney(paid)!} />
        <Stat label="יתרה" value={formatMoney(balance)!} tone={balance > 0 ? "danger" : "good"} />
        <div className="ms-auto flex items-center gap-2 print:hidden">
          {onMarkAll && (
            <button type="button" onClick={onMarkAll} className="min-h-10 rounded-lg bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700">
              סמן הכל כשולם
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex min-h-10 items-center gap-1 rounded-lg border border-black/10 px-3 text-sm font-medium text-brand-900 hover:bg-black/5"
          >
            פירוט
            <ChevronDown size={15} className={`transition ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      <div className={`mt-3 border-t border-black/5 pt-2 ${open ? "" : "hidden print:block"}`}>{children}</div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "danger" }) {
  return (
    <div>
      <p className="text-xs text-black/45">{label}</p>
      <p className={`text-sm font-bold ${tone === "danger" ? "text-red-600" : tone === "good" ? "text-green-700" : "text-brand-900"}`}>{value}</p>
    </div>
  );
}
