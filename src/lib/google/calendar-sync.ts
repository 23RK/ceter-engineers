import "server-only";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { google, type calendar_v3 } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getAuthorizedClientFor } from "@/lib/google/oauth";
import { SYNCABLE_GOOGLE_ACCOUNTS } from "@/lib/google/calendar-access";
import { env, googleErrorCode, safeErrorDetail } from "@/lib/google/env";
import { israelToday } from "@/lib/format";
import {
  classifyEvent,
  deletedHash,
  eventBodyFromMeeting,
  eventKey,
  inspectionCalendarUser,
  inspectionEventBody,
  isNewerThan,
  meetingFieldsFromEvent,
  mergeAttendees,
  SYNC_FUTURE_DAYS,
  SYNC_PAST_DAYS,
  type GEvent,
} from "@/lib/google/event-mapping";

// Two-way sync between the system calendar and the PRIMARY Google calendar
// of Ron and Guy (SPEC §2.2, decisions 1, 2 and 4):
//  - Google -> system: incremental events.list with a syncToken, triggered
//    by push notifications (events.watch), a 10-minute cron (GitHub Actions)
//    and opening the calendar. A full re-read once a week.
//  - system -> Google: meetings are written to their owner's calendar right
//    after they are saved; failures are retried by the cron.
//  - Inspections of Ron / Guy are written to their calendar (one way).
// Logs carry ids and Google's error code only - never tokens or event text.

const DAY = 24 * 60 * 60 * 1000;
const FULL_SYNC_EVERY = 7 * DAY;
const LOCK_MS = 90_000;
const CHANNEL_TTL_SECONDS = 7 * 24 * 60 * 60;
const RENEW_CHANNEL_BEFORE = 2 * DAY;

function log(message: string) {
  console.info(`[google-calendar] ${message}`);
}
function logError(message: string, e: unknown) {
  console.error(`[google-calendar] ${message}: ${safeErrorDetail(e)}`);
}

function httpStatus(e: unknown): number | null {
  const err = e as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  for (const v of [err?.response?.status, err?.status, err?.code]) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 100 && n < 600) return n;
  }
  return null;
}
const isGone = (e: unknown) => [404, 410].includes(httpStatus(e) ?? 0);

/** The message shown in Settings / the calendar when a sync fails. */
export function syncErrorMessage(e: unknown) {
  const code = googleErrorCode(e);
  const status = httpStatus(e);
  if (code === "invalid_grant" || status === 401) {
    return "החיבור ל-Google בוטל או פג. יש לחבר מחדש בהגדרות.";
  }
  if (status === 403) return "Google דחה את הבקשה (הרשאה חסרה או מכסה). אם זה חוזר, יש לחבר מחדש בהגדרות.";
  return "שגיאה בסנכרון מול Google. ננסה שוב בעוד כמה דקות (פרטים ב-Vercel ← Logs, חיפוש: google-calendar).";
}

/** A Calendar API client for this partner's own connected account, or null. */
async function calendarFor(userId: string) {
  const auth = await getAuthorizedClientFor(userId);
  if (!auth) return null;
  return { cal: google.calendar({ version: "v3", auth: auth.client }), account: auth.account };
}

/** Ron and Guy, with whether their calendar is connected. */
async function partners() {
  const users = await prisma.user.findMany({
    where: { role: "PARTNER", email: { in: [...SYNCABLE_GOOGLE_ACCOUNTS] } },
    select: { id: true, email: true, googleAccount: { select: { id: true } } },
  });
  return users.map((u) => ({ id: u.id, email: u.email!, connected: Boolean(u.googleAccount) }));
}

async function otherPartner(userId: string) {
  return (await partners()).find((p) => p.id !== userId) ?? null;
}

// ---------------------------------------------------------------------------
// Google -> system

type SyncResult = "ok" | "busy" | "not_connected" | "error";

/**
 * Brings this partner's calendar changes into the system. One sync per
 * account at a time; a notification that arrives meanwhile makes the running
 * sync go round once more.
 */
export async function syncAccount(userId: string, opts: { full?: boolean } = {}): Promise<SyncResult> {
  const now = new Date();
  const lock = await prisma.googleAccount.updateMany({
    where: { userId, OR: [{ syncLockedUntil: null }, { syncLockedUntil: { lt: now } }] },
    data: { syncLockedUntil: new Date(now.getTime() + LOCK_MS), syncAgain: false },
  });
  if (lock.count === 0) {
    await prisma.googleAccount.updateMany({ where: { userId }, data: { syncAgain: true } });
    return (await prisma.googleAccount.count({ where: { userId } })) ? "busy" : "not_connected";
  }
  try {
    let result: SyncResult = "ok";
    for (let round = 0; round < 3; round++) {
      result = await runSync(userId, round === 0 && Boolean(opts.full));
      const again = await prisma.googleAccount.findUnique({ where: { userId }, select: { syncAgain: true } });
      if (result !== "ok" || !again?.syncAgain) break;
      await prisma.googleAccount.update({ where: { userId }, data: { syncAgain: false } });
    }
    return result;
  } finally {
    await prisma.googleAccount.updateMany({ where: { userId }, data: { syncLockedUntil: null } });
  }
}

async function runSync(userId: string, forceFull: boolean): Promise<SyncResult> {
  const g = await calendarFor(userId);
  if (!g) return "not_connected";
  const { cal, account } = g;
  const partner = await otherPartner(userId);

  const now = Date.now();
  let full =
    forceFull ||
    !account.syncToken ||
    !account.lastFullSyncAt ||
    now - account.lastFullSyncAt.getTime() > FULL_SYNC_EVERY;
  const horizon = { min: new Date(now - SYNC_PAST_DAYS * DAY), max: new Date(now + SYNC_FUTURE_DAYS * DAY) };
  const ctx = {
    userId,
    partnerEmail: partner?.email ?? null,
    partnerConnected: Boolean(partner?.connected),
    horizon,
  };

  try {
    let seen = new Set<string>();
    let pageToken: string | undefined;
    let nextSyncToken: string | null | undefined;
    let counts = { changed: 0, removed: 0 };
    for (let page = 0; page < 100; page++) {
      let res;
      try {
        res = await cal.events.list({
          calendarId: "primary",
          singleEvents: true,
          maxResults: 250,
          pageToken,
          ...(full ? { timeMin: horizon.min.toISOString() } : { syncToken: account.syncToken! }),
        });
      } catch (e) {
        // 410: the sync token expired - start over with a full read.
        if (!full && httpStatus(e) === 410) {
          log(`sync token expired, full sync: user=${userId}`);
          full = true;
          pageToken = undefined;
          seen = new Set();
          counts = { changed: 0, removed: 0 };
          page = -1;
          continue;
        }
        throw e;
      }
      for (const event of res.data.items ?? []) {
        if (event.id) seen.add(event.id);
        const outcome = await applyEvent(event, ctx);
        if (outcome === "changed") counts.changed++;
        if (outcome === "removed") counts.removed++;
      }
      pageToken = res.data.nextPageToken ?? undefined;
      nextSyncToken = res.data.nextSyncToken;
      if (!pageToken) break;
    }

    if (full) counts.removed += await reconcileAfterFullSync(userId, seen, horizon);

    await prisma.googleAccount.update({
      where: { userId },
      data: {
        syncToken: nextSyncToken ?? null,
        lastSyncedAt: new Date(),
        ...(full ? { lastFullSyncAt: new Date() } : {}),
        syncError: null,
      },
    });
    if (counts.changed || counts.removed || full) {
      log(`synced user=${userId} full=${full} changed=${counts.changed} removed=${counts.removed}`);
    }
    return "ok";
  } catch (e) {
    logError(`sync failed user=${userId}`, e);
    await prisma.googleAccount
      .update({ where: { userId }, data: { syncError: syncErrorMessage(e) } })
      .catch(() => {});
    return "error";
  }
}

type ApplyCtx = {
  userId: string;
  partnerEmail: string | null;
  partnerConnected: boolean;
  horizon: { min: Date; max: Date };
};

async function applyEvent(e: GEvent, ctx: ApplyCtx): Promise<"changed" | "removed" | "none"> {
  if (!e.id) return "none";
  const decision = classifyEvent(e, ctx);

  if (decision === "removed") {
    const [m, ins] = await Promise.all([
      prisma.meeting.deleteMany({ where: { ownerId: ctx.userId, googleEventId: e.id } }),
      prisma.inspection.findFirst({
        where: { googleEventUserId: ctx.userId, googleEventId: e.id },
        select: { id: true, googleEventHash: true },
      }),
    ]);
    // Inspection event deleted in Google: not re-created until the inspection changes.
    if (ins) {
      await prisma.inspection.update({
        where: { id: ins.id },
        data: { googleEventId: null, googleEventUserId: null, googleEventHash: deletedHash(ins.googleEventHash) },
      });
    }
    return m.count > 0 ? "removed" : "none";
  }
  if (decision !== "import") return "none";

  const fields = meetingFieldsFromEvent(e, ctx.partnerEmail);
  if (!fields) return "none";
  const key = eventKey(e);
  const appMeetingId = e.extendedProperties?.private?.ceterMeetingId;

  const existing =
    (await prisma.meeting.findFirst({ where: { ownerId: ctx.userId, googleEventId: e.id } })) ??
    (key ? await prisma.meeting.findUnique({ where: { googleKey: key } }) : null) ??
    (appMeetingId ? await prisma.meeting.findUnique({ where: { id: appMeetingId } }) : null);

  if (existing) {
    const tracked = existing.ownerId === ctx.userId && existing.googleEventId === e.id;
    // Tracked in the other partner's calendar: only its organizer takes it over.
    if (existing.ownerId !== ctx.userId && existing.googleEventId && !e.organizer?.self) return "none";
    if (tracked && !isNewerThan(fields.googleUpdated, existing.googleUpdated)) return "none";
    // Edited in the system and not yet written to Google: the newer edit wins.
    if (existing.googleSyncPending && fields.googleUpdated && existing.updatedAt > fields.googleUpdated) return "none";
    await prisma.meeting.update({
      where: { id: existing.id },
      data: {
        ...fields,
        ownerId: ctx.userId,
        googleEventId: e.id,
        googleKey: key ?? existing.googleKey,
        googleSyncPending: false,
        googleSyncError: null,
      },
    });
    return "changed";
  }

  if (fields.endTime < ctx.horizon.min || fields.startTime > ctx.horizon.max) return "none";
  try {
    await prisma.meeting.create({
      data: {
        ...fields,
        ownerId: ctx.userId,
        createdById: ctx.userId,
        googleEventId: e.id,
        googleKey: key,
        fromGoogle: true,
      },
    });
    return "changed";
  } catch (err) {
    // The other partner's sync created it a moment ago (same googleKey).
    if ((err as { code?: string }).code === "P2002") return "none";
    throw err;
  }
}

/**
 * After a full read: events that are no longer in this calendar (deleted
 * while a notification was missed) are removed from the system too.
 */
async function reconcileAfterFullSync(userId: string, seen: Set<string>, horizon: { min: Date; max: Date }) {
  const linked = await prisma.meeting.findMany({
    where: {
      ownerId: userId,
      googleEventId: { not: null },
      googleSyncPending: false,
      startTime: { gte: horizon.min, lte: horizon.max },
    },
    select: { id: true, googleEventId: true },
  });
  const gone = linked.filter((m) => !seen.has(m.googleEventId!)).map((m) => m.id);
  if (gone.length) await prisma.meeting.deleteMany({ where: { id: { in: gone } } });

  const inspections = await prisma.inspection.findMany({
    where: { googleEventUserId: userId, googleEventId: { not: null }, date: { gte: horizon.min } },
    select: { id: true, googleEventId: true, googleEventHash: true },
  });
  for (const ins of inspections.filter((i) => !seen.has(i.googleEventId!))) {
    await prisma.inspection.update({
      where: { id: ins.id },
      data: { googleEventId: null, googleEventUserId: null, googleEventHash: deletedHash(ins.googleEventHash) },
    });
  }
  return gone.length;
}

/** Syncs every connected calendar that hasn't synced in the last `maxAgeMs` (opening the calendar). */
export async function syncStaleAccounts(maxAgeMs = 2 * 60_000) {
  const accounts = await prisma.googleAccount.findMany({
    where: { OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: new Date(Date.now() - maxAgeMs) } }] },
    select: { userId: true },
  });
  for (const a of accounts) await syncAccount(a.userId);
}

// ---------------------------------------------------------------------------
// system -> Google: meetings

/**
 * Writes a meeting to its owner's Google calendar (create or update). Not
 * connected: stays pending and is written when they connect. Fails: stays
 * pending and the cron tries again.
 */
export async function pushMeeting(meetingId: string): Promise<"ok" | "not_connected" | "skipped" | "error"> {
  const m = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!m || !m.ownerId || m.readOnly || m.isPrivate) return "skipped";
  const g = await calendarFor(m.ownerId);
  if (!g) {
    await prisma.meeting.update({ where: { id: m.id }, data: { googleSyncPending: true } });
    return "not_connected";
  }
  const partner = await otherPartner(m.ownerId);
  const body = eventBodyFromMeeting(m);
  try {
    let saved: calendar_v3.Schema$Event | null = null;
    if (m.googleEventId) {
      try {
        const current = await g.cal.events.get({ calendarId: "primary", eventId: m.googleEventId });
        const res = await g.cal.events.patch({
          calendarId: "primary",
          eventId: m.googleEventId,
          sendUpdates: "none",
          requestBody: { ...body, attendees: mergeAttendees(current.data.attendees, partner?.email ?? null, m.withPartner) },
        });
        saved = res.data;
      } catch (e) {
        if (!isGone(e)) throw e; // deleted in Google meanwhile: write it again
      }
    }
    if (!saved) {
      const res = await g.cal.events.insert({
        calendarId: "primary",
        // A new shared meeting: Google sends the partner a normal invitation.
        sendUpdates: m.withPartner ? "all" : "none",
        requestBody: { ...body, attendees: mergeAttendees([], partner?.email ?? null, m.withPartner) },
      });
      saved = res.data;
    }
    await prisma.meeting.update({
      where: { id: m.id },
      data: {
        googleEventId: saved.id,
        googleKey: eventKey(saved) ?? m.googleKey,
        googleUpdated: saved.updated ? new Date(saved.updated) : null,
        googleSyncPending: false,
        googleSyncError: null,
      },
    });
    return "ok";
  } catch (e) {
    logError(`push meeting failed meeting=${m.id}`, e);
    await prisma.meeting.update({
      where: { id: m.id },
      data: { googleSyncPending: true, googleSyncError: syncErrorMessage(e) },
    });
    return "error";
  }
}

/** Removes a meeting's event from its owner's calendar. false = Google refused (try again). */
export async function deleteMeetingEvent(ownerId: string, googleEventId: string): Promise<boolean> {
  const g = await calendarFor(ownerId);
  if (!g) return true; // not connected any more - nothing we can remove
  try {
    await g.cal.events.delete({ calendarId: "primary", eventId: googleEventId, sendUpdates: "none" });
    return true;
  } catch (e) {
    if (isGone(e)) return true;
    logError(`delete event failed user=${ownerId}`, e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// system -> Google: inspections of Ron / Guy (one way)

/**
 * Makes the inspection's Google event match the inspection: created in the
 * inspector's (Ron / Guy) calendar, updated when it changes, moved when the
 * inspector changes, removed when canceled / undated / given to a freelancer.
 */
export async function syncInspectionEvent(inspectionId: string): Promise<"ok" | "error"> {
  const ins = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { inspector: { select: { userId: true } }, apartmentType: { select: { name: true } } },
  });
  if (!ins) return "ok";
  const target = inspectionCalendarUser({ date: ins.date, status: ins.status, inspectorUserId: ins.inspector?.userId ?? null });
  try {
    // Moved away from a calendar (other inspector / canceled / no date).
    if (ins.googleEventId && ins.googleEventUserId && ins.googleEventUserId !== target) {
      const g = await calendarFor(ins.googleEventUserId);
      if (g) {
        try {
          await g.cal.events.delete({ calendarId: "primary", eventId: ins.googleEventId, sendUpdates: "none" });
        } catch (e) {
          if (!isGone(e)) throw e;
        }
      }
      await prisma.inspection.update({
        where: { id: ins.id },
        data: { googleEventId: null, googleEventUserId: null, googleEventHash: null, googleSyncPending: false },
      });
      ins.googleEventId = null;
      ins.googleEventHash = null;
    }
    if (!target) {
      if (ins.googleSyncPending) {
        await prisma.inspection.update({ where: { id: ins.id }, data: { googleSyncPending: false } });
      }
      return "ok";
    }

    const built = inspectionEventBody(
      {
        id: ins.id,
        date: ins.date,
        time: ins.time,
        kind: ins.kind,
        status: ins.status,
        clientName: ins.clientName,
        clientPhone: ins.clientPhone,
        city: ins.city,
        address: ins.address,
        apartmentNumber: ins.apartmentNumber,
        unitsCount: ins.unitsCount,
        apartmentTypeName: ins.apartmentType?.name ?? null,
        notes: ins.notes,
        inspectorUserId: target,
      },
      env("APP_URL").replace(/\/$/, "") || null
    );
    if (!built) return "ok";
    if (ins.googleEventId && ins.googleEventHash === built.hash && !ins.googleSyncPending) return "ok";
    // Deleted in Google by its owner, and unchanged since: leave it deleted.
    if (!ins.googleEventId && ins.googleEventHash === deletedHash(built.hash)) return "ok";

    const g = await calendarFor(target);
    if (!g) return "ok"; // written when they connect (the cron picks it up)

    let saved: calendar_v3.Schema$Event | null = null;
    if (ins.googleEventId) {
      try {
        saved = (
          await g.cal.events.update({
            calendarId: "primary",
            eventId: ins.googleEventId,
            sendUpdates: "none",
            requestBody: built.body,
          })
        ).data;
      } catch (e) {
        if (!isGone(e)) throw e;
      }
    }
    if (!saved) {
      saved = (await g.cal.events.insert({ calendarId: "primary", sendUpdates: "none", requestBody: built.body })).data;
    }
    await prisma.inspection.update({
      where: { id: ins.id },
      data: { googleEventId: saved.id, googleEventUserId: target, googleEventHash: built.hash, googleSyncPending: false },
    });
    return "ok";
  } catch (e) {
    logError(`inspection event failed inspection=${ins.id}`, e);
    await prisma.inspection.update({ where: { id: ins.id }, data: { googleSyncPending: true } }).catch(() => {});
    return "error";
  }
}

/** Removes an inspection's event (its inspection was undone). Best-effort. */
export async function removeInspectionEvent(userId: string, eventId: string) {
  const g = await calendarFor(userId);
  if (!g) return;
  try {
    await g.cal.events.delete({ calendarId: "primary", eventId, sendUpdates: "none" });
  } catch (e) {
    if (!isGone(e)) logError(`remove inspection event failed user=${userId}`, e);
  }
}

/** Never lets a Google problem break saving in the system. */
export async function syncInspectionEventSafely(inspectionId: string) {
  try {
    await syncInspectionEvent(inspectionId);
  } catch (e) {
    logError(`inspection event crashed inspection=${inspectionId}`, e);
  }
}

// ---------------------------------------------------------------------------
// Push notifications (events.watch)

/**
 * Where Google sends notifications: the production site only. Preview
 * deployments sit behind Vercel's login, so Google couldn't reach them.
 */
function webhookAddress() {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return null;
  const url = env("APP_URL").replace(/\/$/, "");
  return url.startsWith("https://") ? `${url}/api/google/webhook` : null;
}

/** Opens a notification channel, or renews it when it is about to expire. */
export async function ensureWatch(userId: string): Promise<"ok" | "renewed" | "skipped" | "error"> {
  const address = webhookAddress();
  if (!address) return "skipped";
  const g = await calendarFor(userId);
  if (!g) return "skipped";
  const { account, cal } = g;
  if (account.channelId && account.channelExpiresAt && account.channelExpiresAt.getTime() - Date.now() > RENEW_CHANNEL_BEFORE) {
    return "ok";
  }
  try {
    const id = randomUUID();
    const token = randomBytes(24).toString("hex");
    const res = await cal.events.watch({
      calendarId: "primary",
      requestBody: { id, type: "web_hook", address, token, params: { ttl: String(CHANNEL_TTL_SECONDS) } },
    });
    await prisma.googleAccount.update({
      where: { userId },
      data: {
        channelId: id,
        channelResourceId: res.data.resourceId ?? null,
        channelToken: token,
        channelExpiresAt: res.data.expiration ? new Date(Number(res.data.expiration)) : new Date(Date.now() + CHANNEL_TTL_SECONDS * 1000),
      },
    });
    if (account.channelId && account.channelResourceId) {
      await cal.channels
        .stop({ requestBody: { id: account.channelId, resourceId: account.channelResourceId } })
        .catch(() => {});
    }
    log(`watch channel ${account.channelId ? "renewed" : "opened"}: user=${userId}`);
    return "renewed";
  } catch (e) {
    logError(`watch failed user=${userId}`, e);
    return "error";
  }
}

/** Closes the notification channel (before disconnecting). Best-effort. */
export async function stopWatch(userId: string) {
  const g = await calendarFor(userId).catch(() => null);
  if (!g?.account.channelId || !g.account.channelResourceId) return;
  await g.cal.channels
    .stop({ requestBody: { id: g.account.channelId, resourceId: g.account.channelResourceId } })
    .catch(() => {});
}

/** The account a notification is for, if its channel id and token match. */
export async function accountForNotification(channelId: string, token: string) {
  const account = await prisma.googleAccount.findFirst({
    where: { channelId },
    select: { userId: true, channelToken: true },
  });
  if (!account?.channelToken) return null;
  const a = Buffer.from(account.channelToken);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b) ? account.userId : null;
}

// ---------------------------------------------------------------------------
// The 10-minute cron (GitHub Actions) and "sync now"

export async function runScheduledSync({ deadline }: { deadline: number }) {
  const summary = { accounts: 0, synced: 0, errors: 0, watch: [] as string[], meetings: 0, inspections: 0 };
  const accounts = await prisma.googleAccount.findMany({ select: { userId: true } });
  summary.accounts = accounts.length;

  for (const { userId } of accounts) {
    summary.watch.push(await ensureWatch(userId));
    const r = await syncAccount(userId);
    if (r === "ok") summary.synced++;
    if (r === "error") summary.errors++;
  }

  // Meetings that still have to be written to Google (failed, or saved before connecting).
  const pending = await prisma.meeting.findMany({
    where: {
      googleSyncPending: true,
      readOnly: false,
      ownerId: { in: accounts.map((a) => a.userId) },
      endTime: { gte: new Date(Date.now() - DAY) },
    },
    select: { id: true },
    orderBy: { startTime: "asc" },
    take: 25,
  });
  for (const m of pending) {
    if (Date.now() > deadline) break;
    if ((await pushMeeting(m.id)) === "ok") summary.meetings++;
  }

  // Inspections of Ron / Guy from today on that aren't in their calendar yet, or failed.
  const connectedUsers = accounts.map((a) => a.userId);
  const inspections = await prisma.inspection.findMany({
    where: {
      OR: [
        { googleSyncPending: true },
        {
          googleEventId: null,
          googleEventHash: null,
          status: { not: "CANCELED" },
          date: { gte: israelToday() },
          inspector: { userId: { in: connectedUsers } },
        },
      ],
    },
    select: { id: true },
    orderBy: { date: "asc" },
    take: 25,
  });
  for (const i of inspections) {
    if (Date.now() > deadline) break;
    if ((await syncInspectionEvent(i.id)) === "ok") summary.inspections++;
  }
  return summary;
}

/** The sync status per partner, for Settings and the calendar. */
export async function calendarSyncStatus() {
  const accounts = await prisma.googleAccount.findMany({
    select: {
      userId: true,
      lastSyncedAt: true,
      syncError: true,
      channelExpiresAt: true,
    },
  });
  const pendingMeetings = await prisma.meeting.groupBy({
    by: ["ownerId"],
    where: { googleSyncPending: true, readOnly: false, endTime: { gte: new Date() } },
    _count: true,
  });
  return accounts.map((a) => ({
    userId: a.userId,
    lastSyncedAt: a.lastSyncedAt,
    syncError: a.syncError,
    pushActive: Boolean(a.channelExpiresAt && a.channelExpiresAt > new Date()),
    pendingMeetings: pendingMeetings.find((p) => p.ownerId === a.userId)?._count ?? 0,
  }));
}
