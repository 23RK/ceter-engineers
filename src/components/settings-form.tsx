"use client";

import { useActionState } from "react";
import { changeCredentialAction } from "@/lib/actions/auth";
import type { ActionState } from "@/lib/actions/tasks";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function SettingsForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction, pending] = useActionState(
    changeCredentialAction,
    initialState
  );

  return (
    <form
      action={formAction}
      className="flex max-w-md flex-col gap-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-sm font-bold text-brand-900">חשבון ההתחברות המשותף</h2>
        <p className="mt-1 text-xs text-black/40">
          הפרטים שבהם שני השותפים מתחברים למערכת.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-brand-900">
          סיסמה נוכחית
        </label>
        <input
          type="password"
          name="currentPassword"
          required
          autoComplete="current-password"
          dir="ltr"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-brand-900">אימייל</label>
        <input
          type="email"
          name="newEmail"
          required
          defaultValue={currentEmail}
          dir="ltr"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">
            סיסמה חדשה
          </label>
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            dir="ltr"
            placeholder="השאירו ריק כדי לא לשנות"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">
            אימות סיסמה חדשה
          </label>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            dir="ltr"
            className={inputClass}
          />
        </div>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          הפרטים עודכנו בהצלחה.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "שומר..." : "שמירת שינויים"}
      </button>
    </form>
  );
}
