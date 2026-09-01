import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { he } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/auth";
import { MonthGrid } from "@/components/calendar/month-grid";
import { AddMeetingButton } from "@/components/calendar/add-meeting-button";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  await requirePartner();
  const { y, m } = await searchParams;

  const today = new Date();
  const year = Number(y) || today.getFullYear();
  // `m` is 1-indexed in the URL for readability; Date months are 0-indexed.
  const month = m ? Number(m) - 1 : today.getMonth();
  const monthDate = new Date(year, month, 1);

  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });

  const meetings = await prisma.meeting.findMany({
    where: { startTime: { gte: gridStart, lte: gridEnd } },
    orderBy: { startTime: "asc" },
  });

  const prevMonth = subMonths(monthDate, 1);
  const nextMonth = addMonths(monthDate, 1);
  const monthHref = (d: Date) =>
    `/calendar?y=${d.getFullYear()}&m=${d.getMonth() + 1}`;

  const dayStart = new Date();
  dayStart.setHours(9, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(10, 0, 0, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">יומן פגישות</h1>
          <p className="text-sm text-black/50">
            הפגישות המשותפות של שני השותפים
          </p>
        </div>
        <AddMeetingButton defaultStart={dayStart} defaultEnd={dayEnd} />
      </div>

      <div className="flex items-center justify-center gap-3">
        <Link
          href={monthHref(prevMonth)}
          className="rounded-lg border border-black/10 p-1.5 text-black/50 transition hover:bg-black/5"
        >
          <ChevronRight size={16} />
        </Link>
        <h2 className="w-40 text-center text-sm font-bold text-brand-900">
          {format(monthDate, "MMMM yyyy", { locale: he })}
        </h2>
        <Link
          href={monthHref(nextMonth)}
          className="rounded-lg border border-black/10 p-1.5 text-black/50 transition hover:bg-black/5"
        >
          <ChevronLeft size={16} />
        </Link>
      </div>

      <MonthGrid monthDate={monthDate} meetings={meetings} />
    </div>
  );
}
