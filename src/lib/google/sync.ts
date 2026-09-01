import "server-only";
import { prisma } from "@/lib/prisma";
import {
  deleteMeetingFromGoogleForAll,
  listUpdatedGoogleEvents,
} from "@/lib/google/calendar";

/**
 * Pulls recent changes from every connected partner's Google Calendar into
 * the app (last-write-wins on conflicting edits). Plain function, not a
 * Server Action - safe to call from a page's render (no revalidatePath
 * here; callers that need cache invalidation wrap this themselves).
 */
export async function pullGoogleUpdates() {
  const accounts = await prisma.googleAccount.findMany();
  if (accounts.length === 0) return;

  for (const account of accounts) {
    const since = account.lastSyncedAt ?? new Date(0);
    let events;
    try {
      events = await listUpdatedGoogleEvents(account.userId, since);
    } catch {
      continue; // token expired/revoked etc. - skip this partner this round
    }

    for (const event of events) {
      if (!event.id) continue;

      const existingSync = await prisma.meetingGoogleSync.findUnique({
        where: {
          userId_googleEventId: {
            userId: account.userId,
            googleEventId: event.id,
          },
        },
      });

      if (event.status === "cancelled") {
        if (existingSync) {
          await deleteMeetingFromGoogleForAll(existingSync.meetingId);
          await prisma.meeting.delete({
            where: { id: existingSync.meetingId },
          });
        }
        continue;
      }

      const startTime = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
          ? new Date(event.start.date)
          : null;
      const endTime = event.end?.dateTime
        ? new Date(event.end.dateTime)
        : event.end?.date
          ? new Date(event.end.date)
          : null;
      if (!startTime || !endTime) continue;

      const googleUpdated = event.updated ? new Date(event.updated) : new Date();

      if (existingSync) {
        const meeting = await prisma.meeting.findUnique({
          where: { id: existingSync.meetingId },
        });
        if (!meeting) continue;
        // Last-write-wins: only pull in Google's version if it's newer
        // than what we already have locally.
        if (meeting.updatedAt >= googleUpdated) continue;

        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            title: event.summary || meeting.title,
            description: event.description ?? null,
            location: event.location ?? null,
            startTime,
            endTime,
          },
        });
        await prisma.meetingGoogleSync.update({
          where: { id: existingSync.id },
          data: { googleUpdated, status: "SYNCED" },
        });
      } else {
        const newMeeting = await prisma.meeting.create({
          data: {
            title: event.summary || "(ללא כותרת)",
            description: event.description ?? null,
            location: event.location ?? null,
            startTime,
            endTime,
            createdById: account.userId,
          },
        });
        await prisma.meetingGoogleSync.create({
          data: {
            meetingId: newMeeting.id,
            userId: account.userId,
            googleEventId: event.id,
            googleUpdated,
            status: "SYNCED",
          },
        });
      }
    }

    await prisma.googleAccount.update({
      where: { userId: account.userId },
      data: { lastSyncedAt: new Date() },
    });
  }
}
