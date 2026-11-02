"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/actions/auth";
import type { ActionState } from "@/lib/actions/tasks";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function ChangePasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    // key: clear the fields after a successful change
    <form key={state.ts} action={formAction} className="flex flex-col gap-4">
      {/* lets password managers attach the new password to the right account */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-brand-900">סיסמה נוכחית</label>
        <input
          type="password"
          name="currentPassword"
          required
          autoComplete="current-password"
          dir="ltr"
          className={inputClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">סיסמה חדשה</label>
          <input
            type="password"
            name="newPassword"
            required
            minLength={8}
            autoComplete="new-password"
            dir="ltr"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">אימות סיסמה חדשה</label>
          <input
            type="password"
            name="confirmPassword"
            required
            minLength={8}
            autoComplete="new-password"
            dir="ltr"
            className={inputClass}
          />
        </div>
      </div>
      <p className="text-xs text-black/40">
        לפחות 8 תווים. אחרי השינוי, מכשירים אחרים שמחוברים עם הסיסמה הישנה ינותקו.
      </p>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          הסיסמה עודכנה בהצלחה.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "שומר..." : "שינוי סיסמה"}
      </button>
    </form>
  );
}
