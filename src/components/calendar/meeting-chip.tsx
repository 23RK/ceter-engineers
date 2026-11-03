"use client";

import { useTransition } from "react";
import { CloudOff, Lock, Trash2, Users } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { MeetingForm } from "@/components/calendar/meeting-form";
import { deleteMeeting } from "@/lib/actions/meetings";
import { israelDayKey, israelTime } from "@/lib/israel-time";
import type { MeetingWithCreator, UserOption } from "@/lib/types";

const NEUTRAL_COLOR = "#94a3b8"; // slate-400 - unknown/no owner

export function MeetingChip({
  meeting,
  partners,
  currentUserId,
}: {
  meeting: MeetingWithCreator;
  partners: UserOption[];
  currentUserId: string;
}) {
  return (
    <Modal
      title={meeting.readOnly ? "פרטי פגישה" : "עריכת פגישה"}
      trigger={<MeetingChipView meeting={meeting} partners={partners} />}
    >
      {(close) =>
        meeting.readOnly ? (
          <ReadOnlyMeeting meeting={meeting} partners={partners} onClose={close} />
        ) : (
          <MeetingForm meeting={meeting} partners={partners} currentUserId={currentUserId} onClose={close} />
        )
      }
    </Modal>
  );
}

function ownerOf(meeting: MeetingWithCreator) {
  return meeting.owner ?? meeting.createdBy ?? null;
}

function MeetingChipView({ meeting, partners }: { meeting: MeetingWithCreator; partners: UserOption[] }) {
  const owner = ownerOf(meeting);
  const color = owner?.color ?? NEUTRAL_COLOR;
  const partner = meeting.withPartner ? partners.find((p) => p.id !== owner?.id) : undefined;
  const [pending, startTransition] = useTransition();
  const notInGoogle = meeting.googleSyncPending && !meeting.readOnly;

  const tooltip = [
    owner ? `ביומן של ${owner.name}` : null,
    partner ? `משותפת עם ${partner.name}` : null,
    meeting.isPrivate ? "אירוע פרטי ב-Google" : null,
    notInGoogle ? "עוד לא נכתבה ליומן Google" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`group flex w-full cursor-pointer items-center gap-1.5 rounded-md border-r-[3px] px-1.5 py-1 text-right text-xs transition ${
        meeting.isPrivate
          ? "bg-black/[0.04] text-black/50 hover:bg-black/[0.07]"
          : "bg-brand-50 text-brand-800 hover:bg-brand-100"
      } ${pending ? "opacity-50" : ""}`}
      style={{ borderRightColor: color }}
      title={tooltip || undefined}
    >
      {/* On a phone the colored border alone shows the owner - no room for dots. */}
      <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full sm:inline-block" style={{ backgroundColor: color }} />
      {partner && (
        <span className="-mr-1 hidden h-1.5 w-1.5 shrink-0 rounded-full sm:inline-block" style={{ backgroundColor: partner.color }} />
      )}
      {!meeting.allDay && (
        <span className="shrink-0 font-medium" dir="ltr">
          {israelTime(meeting.startTime)}
        </span>
      )}
      {meeting.isPrivate && <Lock size={10} className="shrink-0" />}
      <span className="truncate">{meeting.title}</span>
      {partner && <Users size={10} className="hidden shrink-0 text-brand-400 sm:inline" />}
      {notInGoogle && <CloudOff size={10} className="shrink-0 text-amber-600" />}
      {!meeting.readOnly && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!confirm(`למחוק את הפגישה "${meeting.title}"?${meeting.googleEventId ? " היא תימחק גם מיומן Google." : ""}`)) return;
            startTransition(async () => {
              const res = await deleteMeeting(meeting.id);
              if (res.error) alert(res.error);
            });
          }}
          className="mr-auto shrink-0 rounded p-0.5 text-brand-400 opacity-0 transition hover:bg-brand-200 hover:text-brand-700 group-hover:opacity-100"
          title="מחיקה"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

function ReadOnlyMeeting({
  meeting,
  partners,
  onClose,
}: {
  meeting: MeetingWithCreator;
  partners: UserOption[];
  onClose: () => void;
}) {
  const owner = ownerOf(meeting);
  const partner = meeting.withPartner ? partners.find((p) => p.id !== owner?.id) : undefined;
  const day = (d: Date | string) => israelDayKey(d).split("-").reverse().join("/");
  const lastDay = new Date(new Date(meeting.endTime).getTime() - 1); // all-day ends at the next midnight
  const when = meeting.allDay
    ? `יום שלם, ${day(meeting.startTime)}${day(lastDay) !== day(meeting.startTime) ? ` עד ${day(lastDay)}` : ""}`
    : `${day(meeting.startTime)} · ${israelTime(meeting.startTime)}–${israelTime(meeting.endTime)}`;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-base font-semibold text-brand-900">{meeting.title}</p>
      <p dir="rtl" className="text-black/70">
        <bdi dir="ltr">{when}</bdi>
      </p>
      {owner && (
        <p className="text-black/60">
          ביומן של {owner.name}
          {partner ? `, משותפת עם ${partner.name}` : ""}
        </p>
      )}
      {meeting.location && <p className="text-black/70">מיקום: {meeting.location}</p>}
      {meeting.description && <p className="whitespace-pre-line text-black/70">{meeting.description}</p>}
      <p className="rounded-lg bg-black/[0.04] px-3 py-2 text-xs text-black/55">
        {meeting.isPrivate
          ? "אירוע פרטי ב-Google: מוצג כ\"תפוס\" בלבד, בלי כותרת ופרטים."
          : meeting.allDay
            ? "אירוע של יום שלם מ-Google. עריכה ומחיקה נעשות ביומן Google."
            : "הוזמנתם לפגישה הזו מבחוץ. עריכה ומחיקה נעשות ביומן Google, והשינויים יופיעו כאן."}
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-black/60 transition hover:bg-black/5"
        >
          סגירה
        </button>
      </div>
    </div>
  );
}
