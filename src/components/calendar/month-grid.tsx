import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { AddMeetingButton } from "@/components/calendar/add-meeting-button";
import { MeetingChip } from "@/components/calendar/meeting-chip";
import type { MeetingWithCreator, UserOption } from "@/lib/types";
import { israelDayKey } from "@/lib/israel-time";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

/** A house inspection on the calendar, in its inspector's color (SPEC §4.3). */
export type CalendarInspection = {
  id: string;
  date: Date;
  time: string | null;
  clientName: string;
  city: string | null;
  inspector: { name: string; color: string } | null;
};

const WEEKDAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export function MonthGrid({
  monthDate,
  meetings,
  inspections = [],
  partners,
  currentUserId,
}: {
  monthDate: Date;
  meetings: MeetingWithCreator[];
  inspections?: CalendarInspection[];
  partners: UserOption[];
  currentUserId: string;
}) {
  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const meetingsByDay = new Map<string, MeetingWithCreator[]>();
  // Grouped by the day in Israel (the server runs in UTC). A meeting over
  // several days (e.g. an all-day event) shows on each of them.
  for (const meeting of meetings) {
    const first = israelDayKey(meeting.startTime);
    const last = israelDayKey(new Date(new Date(meeting.endTime).getTime() - 1));
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      if (key < first || key > (last < first ? first : last)) continue;
      meetingsByDay.set(key, [...(meetingsByDay.get(key) ?? []), meeting]);
    }
  }

  // Inspection dates are date-only (UTC midnight).
  const inspectionsByDay = new Map<string, CalendarInspection[]>();
  for (const ins of inspections) {
    const key = new Date(ins.date).toISOString().slice(0, 10);
    inspectionsByDay.set(key, [...(inspectionsByDay.get(key) ?? []), ins]);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-black/5 bg-black/[0.02]">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2.5 text-center text-xs font-medium text-black/40"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          // All-day events first, then by start time.
          const dayMeetings = (meetingsByDay.get(key) ?? []).sort(
            (a, b) =>
              Number(b.allDay) - Number(a.allDay) ||
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          );
          const inMonth = isSameMonth(day, monthDate);

          return (
            <div
              key={key}
              className={`group flex min-h-[104px] flex-col gap-1 border-b border-l border-black/5 p-1.5 last:border-l-0 [&:nth-child(7n)]:border-l-0 ${
                inMonth ? "bg-white" : "bg-black/[0.015]"
              }`}
            >
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isToday(day)
                      ? "bg-brand-600 font-semibold text-white"
                      : inMonth
                        ? "text-black/60"
                        : "text-black/25"
                  }`}
                >
                  {format(day, "d")}
                </span>
                <AddMeetingButton
                  defaultStart={`${key}T09:00`}
                  defaultEnd={`${key}T10:00`}
                  variant="icon"
                  partners={partners}
                  currentUserId={currentUserId}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                {dayMeetings.map((meeting) => (
                  <MeetingChip
                    key={meeting.id}
                    meeting={meeting}
                    partners={partners}
                    currentUserId={currentUserId}
                  />
                ))}
                {(inspectionsByDay.get(key) ?? [])
                  .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"))
                  .map((ins) => {
                    const color = ins.inspector?.color ?? "#94a3b8";
                    return (
                      <Link
                        key={ins.id}
                        href={`/inspections?month=${key.slice(0, 7)}&q=${encodeURIComponent(ins.clientName)}`}
                        title={`בדק בית: ${ins.clientName}${ins.city ? `, ${ins.city}` : ""}${ins.inspector ? ` · ${ins.inspector.name}` : ""}`}
                        className="flex w-full items-center gap-1 rounded-md border-r-[3px] bg-black/[0.03] px-1.5 py-1 text-right text-xs text-brand-900 transition hover:bg-black/[0.06]"
                        style={{ borderRightColor: color }}
                      >
                        <ClipboardCheck size={11} className="shrink-0" style={{ color }} />
                        {ins.time && (
                          <span className="shrink-0 font-medium" dir="ltr">
                            {ins.time}
                          </span>
                        )}
                        <span className="truncate">{ins.clientName}</span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
