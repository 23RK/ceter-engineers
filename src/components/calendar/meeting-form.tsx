"use client";

import { useActionState, useEffect } from "react";
import {
  createMeeting,
  createMeetingForLeadTask,
  updateMeeting,
  type ActionState,
} from "@/lib/actions/meetings";
import { toDateTimeInputValue } from "@/lib/format";
import type { Meeting } from "@prisma/client";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function MeetingForm({
  meeting,
  defaultStart,
  defaultEnd,
  defaultTitle,
  forLeadTaskId,
  onClose,
}: {
  meeting?: Meeting;
  defaultStart?: Date;
  defaultEnd?: Date;
  defaultTitle?: string;
  forLeadTaskId?: string;
  onClose: () => void;
}) {
  const action = meeting
    ? updateMeeting.bind(null, meeting.id)
    : forLeadTaskId
      ? createMeetingForLeadTask.bind(null, forLeadTaskId)
      : createMeeting;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-brand-900">כותרת</label>
        <input
          name="title"
          required
          defaultValue={meeting?.title ?? defaultTitle}
          className={inputClass}
          placeholder="לדוגמה: פגישה עם קבלן שלד"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">
            התחלה
          </label>
          <input
            type="datetime-local"
            name="startTime"
            required
            defaultValue={toDateTimeInputValue(
              meeting?.startTime ?? defaultStart
            )}
            className={inputClass}
            dir="ltr"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">סיום</label>
          <input
            type="datetime-local"
            name="endTime"
            required
            defaultValue={toDateTimeInputValue(
              meeting?.endTime ?? defaultEnd
            )}
            className={inputClass}
            dir="ltr"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-brand-900">מיקום</label>
        <input
          name="location"
          defaultValue={meeting?.location ?? ""}
          className={inputClass}
          placeholder="אופציונלי"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-brand-900">תיאור</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={meeting?.description ?? ""}
          className={inputClass}
          placeholder="אופציונלי"
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
          {pending ? "שומר..." : meeting ? "עדכון פגישה" : "קביעת פגישה"}
        </button>
      </div>
    </form>
  );
}
