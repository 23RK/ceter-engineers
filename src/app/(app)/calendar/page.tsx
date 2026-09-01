import Link from "next/link";
import { ChevronRight, ChevronLeft, CircleCheck, CircleAlert } from "lucide-react";
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
import { isGoogleConfigured } from "@/lib/google/oauth";
import { pullGoogleUpdates } from "@/lib/google/sync";
import { MonthGrid } from "@/components/calendar/month-grid";
import { AddMeetingButton } from "@/components/calendar/add-meeting-button";
import { GoogleConnectCard } from "@/components/calendar/google-connect-card";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string; google_connected?: string; google_error?: string }>;
}) {
  const partner = await requirePartner();
  const { y, m, google_connected, google_error } = await searchParams;

  const googleConfigured = isGoogleConfigured();
  if (googleConfigured) {
    // Best-effort pull so the grid below reflects any changes made
    // directly in Google Calendar since the last visit.
    await pullGoogleUpdates().catch(() => {});
  }

  const today = new Date();
  const year = Number(y) || today.getFullYear();
  // `m` is 1-indexed in the URL for readability; Date months are 0-indexed.
  const month = m ? Number(m) - 1 : today.getMonth();
  const monthDate = new Date(year, month, 1);

  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });

  const [meetings, partners, googleAccounts] = await Promise.all([
    prisma.meeting.findMany({
      where: { startTime: { gte: gridStart, lte: gridEnd } },
      orderBy: { startTime: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.googleAccount.findMany(),
  ]);

  const connections = Object.fromEntries(
    googleAccounts.map((a) => [
      a.userId,
      { googleEmail: a.googleEmail, lastSyncedAt: a.lastSyncedAt },
    ])
  );

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

      {google_connected && (
        <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          <CircleCheck size={15} />
          חשבון ה-Google שלך חובר בהצלחה.
        </p>
      )}
      {google_error && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <CircleAlert size={15} />
          החיבור ל-Google נכשל ({google_error}). נסו שוב.
        </p>
      )}

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

      <GoogleConnectCard
        partners={partners}
        connections={connections}
        currentPartnerId={partner.id}
        googleConfigured={googleConfigured}
      />
    </div>
  );
}
