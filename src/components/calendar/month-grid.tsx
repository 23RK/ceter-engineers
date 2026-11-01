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
import type { MeetingWithCreator } from "@/lib/types";

const WEEKDAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export function MonthGrid({
  monthDate,
  meetings,
}: {
  monthDate: Date;
  meetings: MeetingWithCreator[];
}) {
  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const meetingsByDay = new Map<string, MeetingWithCreator[]>();
  for (const meeting of meetings) {
    const key = format(new Date(meeting.startTime), "yyyy-MM-dd");
    const list = meetingsByDay.get(key) ?? [];
    list.push(meeting);
    meetingsByDay.set(key, list);
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
          const dayMeetings = (meetingsByDay.get(key) ?? []).sort(
            (a, b) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          );
          const inMonth = isSameMonth(day, monthDate);
          const dayStart = new Date(day);
          dayStart.setHours(9, 0, 0, 0);
          const dayEnd = new Date(day);
          dayEnd.setHours(10, 0, 0, 0);

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
                  defaultStart={dayStart}
                  defaultEnd={dayEnd}
                  variant="icon"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                {dayMeetings.map((meeting) => (
                  <MeetingChip key={meeting.id} meeting={meeting} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
