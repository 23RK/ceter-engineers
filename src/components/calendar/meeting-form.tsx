"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createMeeting,
  createMeetingForLeadTask,
  updateMeeting,
  type ActionState,
} from "@/lib/actions/meetings";
import { toIsraelDateTimeInput } from "@/lib/israel-time";
import type { Meeting } from "@prisma/client";
import type { UserOption } from "@/lib/types";
import { useUndoToast } from "@/components/ui/toast";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function MeetingForm({
  meeting,
  defaultStart,
  defaultEnd,
  defaultTitle,
  forLeadTaskId,
  partners,
  currentUserId,
  onClose,
}: {
  meeting?: Meeting;
  /** A Date, or a datetime-local value ("yyyy-MM-ddTHH:mm", Israel time). */
  defaultStart?: Date | string;
  defaultEnd?: Date | string;
  defaultTitle?: string;
  forLeadTaskId?: string;
  /** Ron and Guy - for "whose calendar" and "invite the partner". */
  partners?: UserOption[];
  currentUserId?: string;
  onClose: () => void;
}) {
  const action = meeting
    ? updateMeeting.bind(null, meeting.id)
    : forLeadTaskId
      ? createMeetingForLeadTask.bind(null, forLeadTaskId)
      : createMeeting;
  const [state, formAction, pending] = useActionState(action, initialState);
  useUndoToast(state);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

  const asInput = (v: Date | string | undefined | null) =>
    typeof v === "string" ? v : toIsraelDateTimeInput(v);
  const defaultOwner = meeting?.ownerId ?? currentUserId ?? partners?.[0]?.id ?? "";
  const [ownerId, setOwnerId] = useState(defaultOwner);
  const partner = partners?.find((p) => p.id !== ownerId);

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
            defaultValue={asInput(meeting?.startTime ?? defaultStart)}
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
            defaultValue={asInput(meeting?.endTime ?? defaultEnd)}
            className={inputClass}
            dir="ltr"
          />
        </div>
      </div>

      {partners && partners.length > 1 && (
        <div className="flex flex-col gap-2 rounded-lg bg-black/[0.03] px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-sm font-medium text-brand-900">ביומן של</span>
            {partners.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="ownerId"
                  value={p.id}
                  checked={ownerId === p.id}
                  onChange={() => setOwnerId(p.id)}
                />
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </label>
            ))}
          </div>
          {partner && (
            <label className="flex items-center gap-2 text-sm text-black/70">
              <input type="checkbox" name="withPartner" defaultChecked={meeting?.withPartner ?? false} />
              להזמין גם את {partner.name} (הפגישה תופיע גם ביומן של {partner.name})
            </label>
          )}
        </div>
      )}

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
