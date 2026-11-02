"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { AlertTriangle, CalendarPlus, Plus, Trash2 } from "lucide-react";
import type { FeeModel, StageStatus } from "@prisma/client";
import {
  createPayment,
  deletePayment,
  generateRetainerPayments,
  saveFeeTerms,
  updatePayment,
  type PaymentPatch,
} from "@/lib/actions/finance";
import type { ActionState } from "@/lib/actions/tasks";
import {
  FEE_MODELS,
  feeSummary,
  paymentsDueForDoneStages,
  retainerMonths,
  type FeeTerms,
} from "@/lib/fees";
import { formatMoney, isOverdue, toDateInputValue } from "@/lib/format";

export type PaymentInfo = {
  id: string;
  title: string | null;
  amount: number;
  dueDate: Date | null;
  invoiceIssued: boolean;
  paid: boolean;
  paidAt: Date | null;
  stageId: string | null;
  order: number;
};

type StageOption = { id: string; title: string; status: StageStatus };

type Change = { id: string; patch: PaymentPatch } | { id: string; remove: true };

const localToday = () => new Date(toDateInputValue(new Date()));
const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

/** כספים (SPEC §3.5): the fee model, and the collection schedule (לוח גבייה). */
export function ProjectFinance({
  projectId,
  terms,
  feeNotes,
  payments: serverPayments,
  stages,
}: {
  projectId: string;
  terms: FeeTerms;
  feeNotes: string | null;
  payments: PaymentInfo[];
  stages: StageOption[];
}) {
  const [payments, apply] = useOptimistic(serverPayments, (state, change: Change) =>
    "remove" in change
      ? state.filter((p) => p.id !== change.id)
      : state.map((p) => {
          if (p.id !== change.id) return p;
          const c = change.patch;
          const next = { ...p };
          if ("title" in c) next.title = c.title ?? null;
          if (c.amount !== undefined) next.amount = c.amount;
          if ("dueDate" in c) next.dueDate = c.dueDate ? new Date(c.dueDate) : null;
          if (c.invoiceIssued !== undefined) next.invoiceIssued = c.invoiceIssued;
          if ("stageId" in c) next.stageId = c.stageId ?? null;
          if (c.paid !== undefined) {
            next.paid = c.paid;
            next.paidAt = c.paid ? (p.paidAt ?? localToday()) : null;
          }
          if ("paidAt" in c) next.paidAt = c.paidAt ? new Date(c.paidAt) : null;
          return next;
        })
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(change: Change, save: () => Promise<ActionState>) {
    setError(null);
    startTransition(async () => {
      apply(change);
      try {
        const res = await save();
        if (res.error) setError(res.error);
      } catch {
        setError("השינוי לא נשמר. נסו שוב.");
      }
    });
  }

  const summary = feeSummary(terms, payments);
  const alerts = paymentsDueForDoneStages(payments, stages);
  const stageTitle = (id: string | null) => stages.find((s) => s.id === id)?.title;
  const sorted = [...payments].sort((a, b) => a.order - b.order);

  return (
    <section className="flex flex-col gap-4">
      {alerts.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-1.5 font-bold">
            <AlertTriangle size={16} className="text-amber-600" />
            שלב הושלם ותשלום עדיין לא נגבה
          </p>
          <ul className="list-inside list-disc text-amber-800">
            {alerts.map((p) => (
              <li key={p.id}>
                {p.title ?? "תשלום"} ({formatMoney(p.amount)}) - השלב &quot;{stageTitle(p.stageId)}&quot; הושלם
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <SummaryBox label="שכר טרחה כולל" value={summary ? formatMoney(summary.total) : "—"} />
        <SummaryBox label="נגבה" value={summary ? formatMoney(summary.collected) : "—"} tone="good" />
        <SummaryBox label="יתרה לגבייה" value={summary ? formatMoney(summary.remaining) : "—"} />
        <SummaryBox
          label={summary && summary.unscheduled < 0 ? "בלוח יותר מהסכום" : "לא שובץ בלוח"}
          value={summary ? formatMoney(Math.abs(summary.unscheduled)) : "—"}
          tone={summary && summary.unscheduled !== 0 ? "warn" : undefined}
        />
      </div>

      <FeeTermsForm projectId={projectId} terms={terms} feeNotes={feeNotes} />

      {/* לוח גבייה */}
      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-brand-900">לוח גבייה ({payments.length})</h3>
          {terms.feeModel === "RETAINER" && (
            <RetainerButton projectId={projectId} onError={setError} />
          )}
        </div>
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {sorted.length === 0 ? (
          <p className="py-3 text-sm text-black/40">אין עדיין תשלומים בלוח.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {sorted.map((p) => (
              <PaymentRow key={p.id} payment={p} stages={stages} run={run} />
            ))}
          </ul>
        )}
        <NewPaymentForm projectId={projectId} stages={stages} />
      </div>
    </section>
  );
}

function SummaryBox({ label, value, tone }: { label: string; value: string | null; tone?: "good" | "warn" }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        tone === "warn" ? "border-amber-200 bg-amber-50" : "border-black/5 bg-white shadow-sm"
      }`}
    >
      <p className="text-xs text-black/45">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone === "good" ? "text-green-700" : "text-brand-900"}`}>{value}</p>
    </div>
  );
}

function FeeTermsForm({ projectId, terms, feeNotes }: { projectId: string; terms: FeeTerms; feeNotes: string | null }) {
  const [model, setModel] = useState<FeeModel | "">(terms.feeModel ?? "");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveFeeTerms.bind(null, projectId),
    {}
  );
  // "נשמר" until the form is changed again.
  const [changedAt, setChangedAt] = useState(0);
  const saved = !!state.ok && !pending && (state.ts ?? 0) > changedAt;

  const months =
    terms.feeStartDate && terms.feeEndDate ? retainerMonths(terms.feeStartDate, terms.feeEndDate) : null;

  return (
    <form
      action={action}
      onChange={() => setChangedAt(Date.now())}
      className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-6"
    >
      <h3 className="text-sm font-bold text-brand-900">מבנה שכר הטרחה</h3>
      <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <legend className="sr-only">מודל</legend>
        {FEE_MODELS.map((m) => (
          <label
            key={m.value}
            className="flex cursor-pointer flex-col gap-0.5 rounded-xl border border-black/10 p-3 transition has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-brand-900">
              <input
                type="radio"
                name="feeModel"
                value={m.value}
                checked={model === m.value}
                onChange={() => setModel(m.value)}
                className="accent-brand-600"
              />
              {m.label}
            </span>
            <span className="pr-5 text-xs text-black/50">{m.hint}</span>
          </label>
        ))}
      </fieldset>

      {/* key: re-mount the fields when the model changes, so defaults apply. */}
      <div key={model} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {model === "MILESTONES" && (
          <Field label="סכום כולל (₪)">
            <input name="feeTotal" inputMode="decimal" defaultValue={terms.feeTotal ?? ""} className={inputClass} />
          </Field>
        )}
        {model === "RETAINER" && (
          <>
            <Field label="סכום לחודש (₪)">
              <input name="feeMonthly" inputMode="decimal" defaultValue={terms.feeMonthly ?? ""} className={inputClass} />
            </Field>
            <div className="hidden sm:block" />
            <Field label="תאריך התחלה">
              <input type="date" name="feeStartDate" defaultValue={toDateInputValue(terms.feeStartDate)} className={inputClass} />
            </Field>
            <Field label="תאריך סיום">
              <input type="date" name="feeEndDate" defaultValue={toDateInputValue(terms.feeEndDate)} className={inputClass} />
            </Field>
            {months !== null && terms.feeModel === "RETAINER" && (
              <p className="text-xs text-black/50 sm:col-span-2">{months} חודשים לפי התאריכים השמורים.</p>
            )}
          </>
        )}
        {model === "PERCENTAGE" && (
          <>
            <Field label="אחוז (%)">
              <input name="feePercent" inputMode="decimal" defaultValue={terms.feePercent ?? ""} className={inputClass} />
            </Field>
            <Field label="עלות בנייה משוערת (₪)">
              <input name="feeConstructionCost" inputMode="decimal" defaultValue={terms.feeConstructionCost ?? ""} className={inputClass} />
            </Field>
          </>
        )}
        <div className="sm:col-span-2">
          <Field label="הערות (לא חובה)">
            <textarea name="feeNotes" rows={2} defaultValue={feeNotes ?? ""} placeholder='לדוגמה: לא כולל מע"מ' className={inputClass} />
          </Field>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !model}
          className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "שומר..." : "שמירת מבנה שכר הטרחה"}
        </button>
        {saved && <span className="text-sm text-green-700">נשמר</span>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
      {label}
      {children}
    </label>
  );
}

function RetainerButton({ projectId, onError }: { projectId: string; onError: (e: string | null) => void }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          onError(null);
          const res = await generateRetainerPayments(projectId);
          if (res.error) onError(res.error);
        })
      }
      className="flex min-h-10 items-center gap-1.5 rounded-lg border border-black/10 px-3 text-sm font-medium text-brand-900 hover:bg-black/5 disabled:opacity-50"
    >
      <CalendarPlus size={15} />
      {pending ? "יוצר..." : "יצירת תשלום לכל חודש"}
    </button>
  );
}

function PaymentRow({
  payment,
  stages,
  run,
}: {
  payment: PaymentInfo;
  stages: StageOption[];
  run: (change: Change, save: () => Promise<ActionState>) => void;
}) {
  const patch = (p: PaymentPatch) => run({ id: payment.id, patch: p }, () => updatePayment(payment.id, p));
  const overdue = !payment.paid && isOverdue(payment.dueDate);
  const stage = stages.find((s) => s.id === payment.stageId);
  const stageDoneUnpaid = !payment.paid && stage?.status === "DONE";
  const [title, setTitle] = useState(payment.title ?? "");
  const [amount, setAmount] = useState(String(payment.amount));
  const control =
    "min-h-9 rounded-lg border border-transparent bg-black/[0.03] px-2 text-sm outline-none focus:border-brand-400 focus:bg-white";

  return (
    <li className={`flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:gap-2 ${stageDoneUnpaid ? "bg-amber-50/50" : ""}`}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== (payment.title ?? "") && patch({ title })}
          placeholder="תיאור התשלום"
          aria-label="תיאור"
          className={`${control} min-w-0 flex-1`}
        />
        <span className="flex items-center gap-1">
          <span className="text-sm text-black/40">₪</span>
          <input
            value={amount}
            inputMode="decimal"
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => {
              const n = Number(amount.replace(/[,\s₪]/g, ""));
              if (!Number.isFinite(n) || n <= 0) return setAmount(String(payment.amount));
              if (n !== payment.amount) patch({ amount: n });
            }}
            aria-label="סכום"
            className={`${control} w-28 font-semibold`}
          />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="flex items-center gap-1 text-xs text-black/45">
          יעד
          <input
            type="date"
            value={toDateInputValue(payment.dueDate)}
            onChange={(e) => patch({ dueDate: e.target.value || null })}
            aria-label="תאריך יעד"
            className={`${control} w-[8.5rem] text-xs ${overdue ? "bg-red-50 font-semibold text-red-600" : ""}`}
          />
        </label>
        <select
          value={payment.stageId ?? ""}
          onChange={(e) => patch({ stageId: e.target.value || null })}
          aria-label="שלב מקושר"
          className={`${control} max-w-44 text-xs ${stageDoneUnpaid ? "bg-amber-100 text-amber-900" : ""}`}
        >
          <option value="">ללא שלב</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.status === "DONE" ? "✓ " : ""}
              {s.title}
            </option>
          ))}
        </select>
        <Toggle label="חשבונית הוצאה" checked={payment.invoiceIssued} onChange={(v) => patch({ invoiceIssued: v })} />
        <Toggle label="שולם" checked={payment.paid} onChange={(v) => patch({ paid: v })} tone="good" />
        {payment.paid && (
          <input
            type="date"
            value={toDateInputValue(payment.paidAt)}
            onChange={(e) => patch({ paidAt: e.target.value || null })}
            aria-label="תאריך תשלום"
            className={`${control} w-[8.5rem] text-xs`}
          />
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm(`למחוק את התשלום ${payment.title ? `"${payment.title}"` : ""} (${formatMoney(payment.amount)})?`)) {
              run({ id: payment.id, remove: true }, () => deletePayment(payment.id));
            }
          }}
          aria-label="מחיקת תשלום"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-black/25 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  tone,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tone?: "good";
}) {
  return (
    <label
      className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${
        checked
          ? tone === "good"
            ? "bg-green-100 text-green-800"
            : "bg-brand-50 text-brand-700"
          : "bg-black/[0.03] text-black/50"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-brand-600" />
      {label}
    </label>
  );
}

function NewPaymentForm({ projectId, stages }: { projectId: string; stages: StageOption[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createPayment.bind(null, projectId),
    {}
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="mt-3 flex flex-col gap-2 rounded-xl bg-black/[0.02] p-3">
      <p className="text-xs font-semibold text-black/50">תשלום חדש</p>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_8rem_9rem_12rem_auto]">
        <input name="title" placeholder="תיאור (לדוגמה: מקדמה)" aria-label="תיאור" className={`${inputClass} col-span-2 lg:col-span-1`} />
        <input name="amount" required inputMode="decimal" placeholder="סכום ₪" aria-label="סכום" className={inputClass} />
        <input name="dueDate" type="date" aria-label="תאריך יעד" className={inputClass} />
        <select name="stageId" aria-label="שלב מקושר" className={`${inputClass} col-span-2 lg:col-span-1`} defaultValue="">
          <option value="">ללא שלב מקושר</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="col-span-2 flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 lg:col-span-1"
        >
          <Plus size={15} />
          הוספה
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
