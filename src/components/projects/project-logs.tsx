"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  createChangeOrder,
  createSupervisionReport,
  deleteChangeOrder,
  deleteSupervisionReport,
  updateChangeOrder,
  updateSupervisionReport,
} from "@/lib/actions/project-logs";
import type { ActionState } from "@/lib/actions/tasks";
import { formatMoney, toDateInputValue } from "@/lib/format";
import type { UserOption } from "@/lib/types";

const control =
  "min-h-9 rounded-lg border border-transparent bg-black/[0.03] px-2 text-sm outline-none focus:border-brand-400 focus:bg-white";
const input =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

/** Run a save in the background; show an error if it fails. */
function useSaver() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (fn: () => Promise<ActionState>) =>
    start(async () => {
      setError(null);
      try {
        const res = await fn();
        if (res.error) setError(res.error);
      } catch {
        setError("השינוי לא נשמר. נסו שוב.");
      }
    });
  return { pending, error, save };
}

/** A text field saved when it loses focus. */
function BlurInput({
  value,
  onSave,
  ...rest
}: { value: string; onSave: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [v, setV] = useState(value);
  return (
    <input
      {...rest}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
    />
  );
}

function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

// --- יזמים: דוחות פיקוח -------------------------------------------------

export type ReportInfo = {
  id: string;
  visitDate: Date;
  performedById: string | null;
  performedByName: string | null;
  reportSent: boolean;
  fileUrl: string | null;
  notes: string | null;
};

/** דוחות פיקוח (SPEC §3.4, יזמים בלבד): ניהול מלמעלה. */
export function SupervisionReports({
  projectId,
  reports,
  users,
}: {
  projectId: string;
  reports: ReportInfo[];
  users: UserOption[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createSupervisionReport.bind(null, projectId),
    {}
  );
  const ref = useResetOnSuccess(state);
  const [other, setOther] = useState(users.length === 0);
  const notSent = reports.filter((r) => !r.reportSent).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-brand-900">דוחות פיקוח ({reports.length})</h2>
        {notSent > 0 && <span className="text-xs font-medium text-amber-700">{notSent} לא נשלחו</span>}
      </div>

      {reports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 bg-white/60 py-8 text-center text-sm text-black/40">
          אין עדיין דוחות פיקוח.
        </p>
      ) : (
        <ul className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-white shadow-sm">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} users={users} />
          ))}
        </ul>
      )}

      <form ref={ref} action={action} className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-black/50">ביקור חדש</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-black/55">
            תאריך ביקור
            <input name="visitDate" type="date" required defaultValue={toDateInputValue(new Date())} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/55">
            מבצע
            <select
              name="performedById"
              defaultValue={users[0]?.id ?? ""}
              onChange={(e) => setOther(e.target.value === "")}
              className={input}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
              <option value="">אחר</option>
            </select>
          </label>
          {other && (
            <label className="flex flex-col gap-1 text-xs text-black/55">
              שם המבצע
              <input name="performedByName" className={input} />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs text-black/55">
            קישור לקובץ
            <input name="fileUrl" type="url" dir="ltr" placeholder="https://" className={`${input} text-right`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-black/55 sm:col-span-2 lg:col-span-3">
            הערות
            <input name="notes" className={input} />
          </label>
          <label className="flex min-h-10 items-center gap-2 self-end text-sm text-brand-900">
            <input type="checkbox" name="reportSent" className="h-4 w-4 accent-brand-600" />
            דוח נשלח
          </label>
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className="flex min-h-10 items-center justify-center gap-1.5 self-start rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          <Plus size={15} />
          הוספת ביקור
        </button>
      </form>
    </section>
  );
}

function ReportRow({ report, users }: { report: ReportInfo; users: UserOption[] }) {
  const { pending, error, save } = useSaver();
  const [sent, setSent] = useState(report.reportSent);
  const patch = (p: Parameters<typeof updateSupervisionReport>[1]) =>
    save(() => updateSupervisionReport(report.id, p));

  return (
    <li className={`flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          defaultValue={toDateInputValue(report.visitDate)}
          onChange={(e) => e.target.value && patch({ visitDate: e.target.value })}
          aria-label="תאריך ביקור"
          className={`${control} w-[8.5rem] text-xs`}
        />
        <select
          defaultValue={report.performedById ?? ""}
          onChange={(e) => patch({ performedById: e.target.value || null })}
          aria-label="מבצע"
          className={`${control} text-xs`}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
          <option value="">{report.performedByName ? `אחר: ${report.performedByName}` : "אחר"}</option>
        </select>
        <label
          className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${
            sent ? "bg-green-100 text-green-800" : "bg-amber-50 text-amber-800"
          }`}
        >
          <input
            type="checkbox"
            checked={sent}
            onChange={(e) => {
              setSent(e.target.checked);
              patch({ reportSent: e.target.checked });
            }}
            className="accent-brand-600"
          />
          {sent ? "דוח נשלח" : "דוח לא נשלח"}
        </label>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <BlurInput
          value={report.notes ?? ""}
          onSave={(notes) => patch({ notes })}
          placeholder="הערות"
          aria-label="הערות"
          className={`${control} min-w-0 flex-1`}
        />
        <BlurInput
          value={report.fileUrl ?? ""}
          onSave={(fileUrl) => patch({ fileUrl })}
          placeholder="קישור לקובץ"
          aria-label="קישור לקובץ"
          dir="ltr"
          className={`${control} w-36 text-xs`}
        />
        {report.fileUrl && (
          <a href={report.fileUrl} target="_blank" rel="noopener noreferrer" aria-label="פתיחת הדוח" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50">
            <ExternalLink size={15} />
          </a>
        )}
        <button
          type="button"
          onClick={() => confirm("למחוק את הביקור?") && save(() => deleteSupervisionReport(report.id))}
          aria-label="מחיקת ביקור"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-black/25 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={15} />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </li>
  );
}

// --- וילות: שינויים ותוספות ------------------------------------------------

export type ChangeInfo = {
  id: string;
  description: string;
  cost: number | null;
  clientApproved: boolean;
  date: Date | null;
};

/** שינויים ותוספות (SPEC §3.4, וילות בלבד). */
export function ChangeOrders({ projectId, changes }: { projectId: string; changes: ChangeInfo[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createChangeOrder.bind(null, projectId),
    {}
  );
  const ref = useResetOnSuccess(state);
  const total = changes.reduce((s, c) => s + (c.cost ?? 0), 0);
  const approved = changes.filter((c) => c.clientApproved).reduce((s, c) => s + (c.cost ?? 0), 0);

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:max-w-md">
        <div className="rounded-xl border border-black/5 bg-white p-3 shadow-sm">
          <p className="text-xs text-black/45">סה&quot;כ שינויים</p>
          <p className="mt-1 text-lg font-bold text-brand-900">{formatMoney(total)}</p>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-3 shadow-sm">
          <p className="text-xs text-black/45">אושרו על ידי הלקוח</p>
          <p className="mt-1 text-lg font-bold text-green-700">{formatMoney(approved)}</p>
        </div>
      </div>

      {changes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 bg-white/60 py-8 text-center text-sm text-black/40">
          אין עדיין שינויים ותוספות.
        </p>
      ) : (
        <ul className="divide-y divide-black/5 rounded-2xl border border-black/5 bg-white shadow-sm">
          {changes.map((c) => (
            <ChangeRow key={c.id} change={c} />
          ))}
        </ul>
      )}

      <form ref={ref} action={action} className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-black/50">שינוי או תוספת</p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_9rem_9rem_auto]">
          <input name="description" required placeholder="תיאור" aria-label="תיאור" className={`${input} col-span-2 lg:col-span-1`} />
          <input name="cost" inputMode="decimal" placeholder="עלות ₪" aria-label="עלות" className={input} />
          <input name="date" type="date" aria-label="תאריך" defaultValue={toDateInputValue(new Date())} className={input} />
          <label className="col-span-2 flex min-h-10 items-center gap-2 text-sm text-brand-900 lg:col-span-1">
            <input type="checkbox" name="clientApproved" className="h-4 w-4 accent-brand-600" />
            אושר על ידי הלקוח
          </label>
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className="flex min-h-10 items-center justify-center gap-1.5 self-start rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          <Plus size={15} />
          הוספה
        </button>
      </form>
    </section>
  );
}

function ChangeRow({ change }: { change: ChangeInfo }) {
  const { pending, error, save } = useSaver();
  const [approved, setApproved] = useState(change.clientApproved);
  const patch = (p: Parameters<typeof updateChangeOrder>[1]) => save(() => updateChangeOrder(change.id, p));
  return (
    <li className={`flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center ${pending ? "opacity-60" : ""}`}>
      <BlurInput
        value={change.description}
        onSave={(description) => description.trim() && patch({ description })}
        aria-label="תיאור"
        className={`${control} min-w-0 flex-1 font-medium`}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-sm text-black/40">
          ₪
          <BlurInput
            value={change.cost != null ? String(change.cost) : ""}
            onSave={(cost) => patch({ cost })}
            inputMode="decimal"
            aria-label="עלות"
            className={`${control} w-24 font-semibold text-brand-900`}
          />
        </span>
        <input
          type="date"
          defaultValue={toDateInputValue(change.date)}
          onChange={(e) => patch({ date: e.target.value || null })}
          aria-label="תאריך"
          className={`${control} w-[8.5rem] text-xs`}
        />
        <label
          className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${
            approved ? "bg-green-100 text-green-800" : "bg-amber-50 text-amber-800"
          }`}
        >
          <input
            type="checkbox"
            checked={approved}
            onChange={(e) => {
              setApproved(e.target.checked);
              patch({ clientApproved: e.target.checked });
            }}
            className="accent-brand-600"
          />
          {approved ? "אושר על ידי הלקוח" : "ממתין לאישור הלקוח"}
        </label>
        <button
          type="button"
          onClick={() => confirm("למחוק את השינוי?") && save(() => deleteChangeOrder(change.id))}
          aria-label="מחיקה"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-black/25 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={15} />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </li>
  );
}
