"use client";

import { useActionState, useEffect } from "react";
import { createLead, updateLead, type ActionState } from "@/lib/actions/leads";
import { LEAD_STATUSES } from "@/lib/constants";
import type { Lead } from "@prisma/client";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function LeadForm({
  lead,
  onClose,
}: {
  lead?: Lead;
  onClose: () => void;
}) {
  const action = lead ? updateLead.bind(null, lead.id) : createLead;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-brand-900">
          שם לקוח / יזם
        </label>
        <input
          name="name"
          required
          defaultValue={lead?.name}
          className={inputClass}
          placeholder="לדוגמה: יזמי הרצל בע&quot;מ"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-brand-900">סטטוס</label>
        <select
          name="status"
          defaultValue={lead?.status ?? "IN_PROGRESS"}
          className={inputClass}
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-brand-900">הערות</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={lead?.notes ?? ""}
          className={inputClass}
          placeholder="פרטים נוספים (אופציונלי)"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-black/60 transition hover:bg-black/5"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "שומר..." : lead ? "עדכון הזדמנות" : "יצירת הזדמנות"}
        </button>
      </div>
    </form>
  );
}
