import "server-only";
import { google, calendar_v3 } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClientFor } from "@/lib/google/oauth";
import type { Meeting } from "@prisma/client";

function toEventBody(meeting: Meeting): calendar_v3.Schema$Event {
  return {
    summary: meeting.title,
    description: meeting.description ?? undefined,
    location: meeting.location ?? undefined,
    start: { dateTime: meeting.startTime.toISOString() },
    end: { dateTime: meeting.endTime.toISOString() },
  };
}

/**
 * Creates or updates this meeting on one partner's Google Calendar,
 * upserting the MeetingGoogleSync row that tracks the mapping. Silently
 * no-ops if that partner hasn't connected Google (push is best-effort per
 * partner - one missing connection shouldn't block saving the meeting).
 */
export async function pushMeetingToGoogle(userId: string, meeting: Meeting) {
  const authorized = await getAuthorizedClientFor(userId);
  if (!authorized) return;

  const calendar = google.calendar({ version: "v3", auth: authorized.client });
  const existing = await prisma.meetingGoogleSync.findUnique({
    where: { meetingId_userId: { meetingId: meeting.id, userId } },
  });

  try {
    const { data } = existing
      ? await calendar.events.update({
          calendarId: authorized.account.calendarId,
          eventId: existing.googleEventId,
          requestBody: toEventBody(meeting),
        })
      : await calendar.events.insert({
          calendarId: authorized.account.calendarId,
          requestBody: toEventBody(meeting),
        });

    await prisma.meetingGoogleSync.upsert({
      where: { meetingId_userId: { meetingId: meeting.id, userId } },
      create: {
        meetingId: meeting.id,
        userId,
        googleEventId: data.id!,
        googleUpdated: data.updated ? new Date(data.updated) : null,
        status: "SYNCED",
      },
      update: {
        googleEventId: data.id!,
        googleUpdated: data.updated ? new Date(data.updated) : null,
        status: "SYNCED",
      },
    });
  } catch {
    if (existing) {
      await prisma.meetingGoogleSync.update({
        where: { id: existing.id },
        data: { status: "ERROR" },
      });
    }
  }
}

/** Push to every partner who has connected their Google account. */
export async function pushMeetingToAllConnectedPartners(meeting: Meeting) {
  const accounts = await prisma.googleAccount.findMany({
    select: { userId: true },
  });
  await Promise.all(
    accounts.map(({ userId }) => pushMeetingToGoogle(userId, meeting))
  );
}

export async function deleteMeetingFromGoogleForAll(meetingId: string) {
  const syncs = await prisma.meetingGoogleSync.findMany({
    where: { meetingId },
  });
  await Promise.all(
    syncs.map(async (sync) => {
      const authorized = await getAuthorizedClientFor(sync.userId);
      if (!authorized) return;
      const calendar = google.calendar({
        version: "v3",
        auth: authorized.client,
      });
      await calendar.events
        .delete({
          calendarId: authorized.account.calendarId,
          eventId: sync.googleEventId,
        })
        .catch(() => {
          // event may already be gone on Google's side - fine either way
        });
    })
  );
}

/** Events updated on this partner's Google Calendar since `updatedMin`. */
export async function listUpdatedGoogleEvents(userId: string, updatedMin: Date) {
  const authorized = await getAuthorizedClientFor(userId);
  if (!authorized) return [];

  const calendar = google.calendar({ version: "v3", auth: authorized.client });
  const { data } = await calendar.events.list({
    calendarId: authorized.account.calendarId,
    updatedMin: updatedMin.toISOString(),
    singleEvents: true,
    orderBy: "updated",
    maxResults: 50,
  });
  return data.items ?? [];
}
