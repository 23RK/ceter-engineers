import Link from "next/link";
import { after } from "next/server";
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
import { requireUser } from "@/lib/auth";
import { MonthGrid } from "@/components/calendar/month-grid";
import { AddMeetingButton } from "@/components/calendar/add-meeting-button";
import { CalendarLegend } from "@/components/calendar/calendar-legend";
import { SyncNowButton } from "@/components/calendar/sync-now-button";
import { addDaysToKey, israelDayKey, israelMidnight, israelTime } from "@/lib/israel-time";
import { calendarSyncStatus, syncStaleAccounts } from "@/lib/google/calendar-sync";
import { USER_OPTION_SELECT } from "@/lib/types";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string; who?: string }>;
}) {
  const user = await requireUser();
  const { y, m, who: whoParam } = await searchParams;

  // Opening the calendar also catches up with Google (after the page is sent).
  after(() => syncStaleAccounts().catch(() => {}));

  const todayKey = israelDayKey(new Date());
  const year = Number(y) || Number(todayKey.slice(0, 4));
  // `m` is 1-indexed in the URL for readability; Date months are 0-indexed.
  const month = m ? Number(m) - 1 : Number(todayKey.slice(5, 7)) - 1;
  const monthDate = new Date(year, month, 1);

  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  const firstKey = format(gridStart, "yyyy-MM-dd");
  const lastKey = format(gridEnd, "yyyy-MM-dd");
  const rangeStart = israelMidnight(firstKey)!;
  const rangeEnd = israelMidnight(addDaysToKey(lastKey, 1))!;

  const partners = await prisma.user.findMany({
    where: { role: "PARTNER" },
    select: { ...USER_OPTION_SELECT, googleAccount: { select: { id: true } } },
    orderBy: { name: "asc" },
  });
  // Filter (SPEC §2.2): רון / גיא / שניהם.
  const who = partners.find((p) => p.id === whoParam)?.id ?? null;

  const [meetings, inspections, syncStatus] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        startTime: { lt: rangeEnd },
        endTime: { gt: rangeStart },
        ...(who ? { OR: [{ ownerId: who }, { withPartner: true, ownerId: { not: who } }] } : {}),
      },
      orderBy: { startTime: "asc" },
      include: {
        createdBy: { select: USER_OPTION_SELECT },
        owner: { select: USER_OPTION_SELECT },
      },
    }),
    // בדק בית on the calendar, in each inspector's color (SPEC §4.3).
    prisma.inspection.findMany({
      where: {
        status: { not: "CANCELED" },
        date: {
          gte: new Date(`${firstKey}T00:00:00Z`),
          lte: new Date(`${lastKey}T00:00:00Z`),
        },
        ...(who ? { inspector: { userId: who } } : {}),
      },
      select: {
        id: true,
        date: true,
        time: true,
        clientName: true,
        city: true,
        inspector: { select: { name: true, color: true } },
      },
    }),
    calendarSyncStatus(),
  ]);

  const prevMonth = subMonths(monthDate, 1);
  const nextMonth = addMonths(monthDate, 1);
  const href = (d: Date, w: string | null = who) =>
    `/calendar?y=${d.getFullYear()}&m=${d.getMonth() + 1}${w ? `&who=${w}` : ""}`;
  const partnerOptions = partners.map((p) => ({ id: p.id, name: p.name, color: p.color }));
  const connected = partners.filter((p) => p.googleAccount);
  const lastSync = syncStatus
    .map((s) => s.lastSyncedAt)
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const errors = syncStatus.filter((s) => s.syncError);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">יומן פגישות</h1>
          <p className="text-sm text-black/50">
            היומנים הראשיים של שני השותפים מ-Google, ובדיקות בדק בית בצבע הבודק
          </p>
        </div>
        <AddMeetingButton
          defaultStart={`${todayKey}T09:00`}
          defaultEnd={`${todayKey}T10:00`}
          partners={partnerOptions}
          currentUserId={user.id}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-black/[0.04] p-1 text-xs">
          {[{ id: null, name: "שניהם" }, ...partnerOptions].map((p) => (
            <Link
              key={p.id ?? "all"}
              href={href(monthDate, p.id)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                who === p.id ? "bg-white text-brand-900 shadow-sm" : "text-black/50 hover:text-black/70"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3">
          <Link
            href={href(prevMonth)}
            className="rounded-lg border border-black/10 p-1.5 text-black/50 transition hover:bg-black/5"
          >
            <ChevronRight size={16} />
          </Link>
          <h2 className="w-40 text-center text-sm font-bold text-brand-900">
            {format(monthDate, "MMMM yyyy", { locale: he })}
          </h2>
          <Link
            href={href(nextMonth)}
            className="rounded-lg border border-black/10 p-1.5 text-black/50 transition hover:bg-black/5"
          >
            <ChevronLeft size={16} />
          </Link>
        </div>

        {connected.length > 0 ? <SyncNowButton /> : <span />}
      </div>

      <MonthGrid
        monthDate={monthDate}
        meetings={meetings}
        inspections={inspections.map((i) => ({ ...i, date: i.date! }))}
        partners={partnerOptions}
        currentUserId={user.id}
      />

      <CalendarLegend partners={partnerOptions} />

      <div className="flex flex-col gap-1 px-1 text-xs text-black/40">
        {connected.length === 0 ? (
          <p>אף יומן Google עוד לא מחובר. מחברים בהגדרות ← יומן Google.</p>
        ) : (
          <p>
            מסונכרן עם Google: {connected.map((p) => p.name).join(" ו")}
            {connected.length < partners.length &&
              ` (היומן של ${partners.filter((p) => !p.googleAccount).map((p) => p.name).join(", ")} עוד לא מחובר)`}
            {lastSync && ` · עדכון אחרון ${israelDayKey(lastSync) === todayKey ? "" : `${israelDayKey(lastSync).split("-").reverse().join("/")} `}${israelTime(lastSync)}`}
          </p>
        )}
        {errors.map((e) => (
          <p key={e.userId} className="text-red-600">
            {partners.find((p) => p.id === e.userId)?.name}: {e.syncError}
          </p>
        ))}
      </div>
    </div>
  );
}
