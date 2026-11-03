// Google Calendar event <-> system meeting / inspection, as pure functions
// (no Google client, no database), so the sync rules are unit-tested in
// event-mapping.test.ts. SPEC §2.2 and decisions 1-2.

import type { calendar_v3 } from "googleapis";
import { fullAddress, wazeHref } from "@/lib/contacts";
import { addDaysToKey, ISRAEL_TZ, israelMidnight, parseIsraelDateTime } from "@/lib/israel-time";

export type GEvent = calendar_v3.Schema$Event;
type GAttendee = calendar_v3.Schema$EventAttendee;

/** A private Google event is stored without title or details, and shown like this. */
export const PRIVATE_TITLE = "תפוס";
export const UNTITLED = "(ללא כותרת)";

/** How far back / ahead a full sync reads events from Google. */
export const SYNC_PAST_DAYS = 60;
export const SYNC_FUTURE_DAYS = 365;

/** An inspection with a time takes this long in the calendar. */
export const INSPECTION_MINUTES = 120;

const lower = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * The same event has the same key in both partners' calendars: the iCalUID,
 * plus the original start time for one instance of a recurring event (all
 * instances share the iCalUID). Used to show a shared meeting only once.
 */
export function eventKey(e: GEvent): string | null {
  if (!e.iCalUID) return null;
  if (!e.recurringEventId) return e.iCalUID;
  const orig = e.originalStartTime?.dateTime
    ? new Date(e.originalStartTime.dateTime).toISOString()
    : e.originalStartTime?.date;
  return orig ? `${e.iCalUID}#${orig}` : e.iCalUID;
}

/** Start / end as instants. An all-day event runs from midnight to midnight in Israel. */
export function eventTimes(e: GEvent): { startTime: Date; endTime: Date; allDay: boolean } | null {
  if (e.start?.dateTime) {
    const startTime = new Date(e.start.dateTime);
    const endTime = e.end?.dateTime ? new Date(e.end.dateTime) : startTime;
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) return null;
    return { startTime, endTime, allDay: false };
  }
  if (e.start?.date) {
    const startTime = israelMidnight(e.start.date);
    const endTime = israelMidnight(e.end?.date ?? addDaysToKey(e.start.date, 1));
    if (!startTime || !endTime) return null;
    return { startTime, endTime, allDay: true };
  }
  return null;
}

export const isPrivateEvent = (e: GEvent) =>
  e.visibility === "private" || e.visibility === "confidential";

/** Event types that are not meetings and aren't shown. */
const SKIPPED_TYPES = new Set(["workingLocation", "birthday"]);

export type EventDecision =
  | "import" // create / update the meeting
  | "removed" // cancelled, or declined by this partner: remove their copy
  | "inspection" // written by the system for an inspection - never imported
  | "partner" // organized by the other (connected) partner - their sync owns it
  | "skip"; // not a meeting (working location, birthdays)

/**
 * What to do with an event read from `selfEmail`'s primary calendar. A
 * shared meeting is owned by its organizer: when the organizer is the other
 * partner and their calendar is connected, it is imported from their
 * calendar only.
 */
export function classifyEvent(
  e: GEvent,
  ctx: { partnerEmail: string | null; partnerConnected: boolean }
): EventDecision {
  if (e.extendedProperties?.private?.ceterInspectionId) return "inspection";
  if (e.status === "cancelled") return "removed";
  if (e.attendees?.some((a) => a.self && a.responseStatus === "declined")) return "removed";
  if (e.eventType && SKIPPED_TYPES.has(e.eventType)) return "skip";
  const organizer = lower(e.organizer?.email);
  if (
    ctx.partnerConnected &&
    ctx.partnerEmail &&
    !e.organizer?.self &&
    organizer === lower(ctx.partnerEmail)
  ) {
    return "partner";
  }
  return "import";
}

export type MeetingFields = {
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  isPrivate: boolean;
  readOnly: boolean;
  withPartner: boolean;
  googleUpdated: Date | null;
};

/** The meeting's fields from a Google event. A private event keeps only its time. */
export function meetingFieldsFromEvent(e: GEvent, partnerEmail: string | null): MeetingFields | null {
  const times = eventTimes(e);
  if (!times) return null;
  const isPrivate = isPrivateEvent(e);
  // Organized by someone else: editing here would only change this
  // partner's own copy, so it's edited in Google.
  const organizerIsSelf = e.organizer ? Boolean(e.organizer.self) : true;
  const partner = lower(partnerEmail);
  const updated = e.updated ? new Date(e.updated) : null;
  return {
    title: isPrivate ? PRIVATE_TITLE : e.summary?.trim() || UNTITLED,
    description: isPrivate ? null : e.description?.trim().slice(0, 5000) || null,
    location: isPrivate ? null : e.location?.trim() || null,
    ...times,
    isPrivate,
    readOnly: isPrivate || times.allDay || !organizerIsSelf,
    withPartner: Boolean(partner) && (e.attendees ?? []).some((a) => lower(a.email) === partner),
    googleUpdated: updated && !Number.isNaN(updated.getTime()) ? updated : null,
  };
}

/** Is the incoming Google version newer than what the meeting has? */
export function isNewerThan(eventUpdated: Date | null, meetingGoogleUpdated: Date | null) {
  if (!eventUpdated || !meetingGoogleUpdated) return true;
  return eventUpdated.getTime() > meetingGoogleUpdated.getTime();
}

/**
 * The attendee list after adding / removing the other partner. Everyone
 * else invited in Google is kept as is.
 */
export function mergeAttendees(
  existing: GAttendee[] | null | undefined,
  partnerEmail: string | null,
  withPartner: boolean
): GAttendee[] {
  const partner = lower(partnerEmail);
  const others = (existing ?? []).filter((a) => !partner || lower(a.email) !== partner);
  const current = (existing ?? []).find((a) => partner && lower(a.email) === partner);
  if (!withPartner || !partner) return others;
  return [...others, current ?? { email: partner }];
}

/** The event written to the owner's calendar for a meeting created / edited in the system. */
export function eventBodyFromMeeting(m: {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
}): GEvent {
  return {
    summary: m.title,
    description: m.description ?? "",
    location: m.location ?? "",
    start: { dateTime: m.startTime.toISOString(), timeZone: ISRAEL_TZ, date: null },
    end: { dateTime: m.endTime.toISOString(), timeZone: ISRAEL_TZ, date: null },
    extendedProperties: { private: { ceterMeetingId: m.id } },
  };
}

export type InspectionForEvent = {
  id: string;
  date: Date | null; // date only (UTC midnight)
  time: string | null; // "HH:mm"
  kind: "REGULAR" | "REPEAT";
  status: string;
  clientName: string;
  clientPhone: string | null;
  city: string | null;
  address: string | null;
  apartmentNumber: string | null;
  unitsCount: number;
  apartmentTypeName: string | null;
  notes: string | null;
  inspectorUserId: string | null; // Ron's / Guy's user when they are the inspector
};

/** Whose calendar the inspection belongs in: Ron / Guy as inspector, with a date, not canceled. */
export function inspectionCalendarUser(ins: Pick<InspectionForEvent, "date" | "status" | "inspectorUserId">) {
  return ins.date && ins.status !== "CANCELED" && ins.inspectorUserId ? ins.inspectorUserId : null;
}

/** Small, stable hash (FNV-1a) of what is written, to skip edits that don't change the event. */
export function hashText(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0") + `-${text.length}`;
}

/**
 * The calendar event for an inspection of Ron / Guy (SPEC §4.3): address,
 * phone and a Waze link in the description. With a time it is a 2-hour
 * event, without one an all-day event. null when there is no date.
 */
export function inspectionEventBody(ins: InspectionForEvent, appUrl: string | null): { body: GEvent; hash: string } | null {
  if (!ins.date) return null;
  const day = ins.date.toISOString().slice(0, 10);
  const address = [ins.address?.trim(), ins.apartmentNumber?.trim() ? `דירה ${ins.apartmentNumber.trim()}` : ""]
    .filter(Boolean)
    .join(", ");
  const full = fullAddress(address || null, ins.city);
  const waze = wazeHref(ins.address, ins.city);

  const lines = [
    `כתובת: ${full ?? "לא הוזנה"}`,
    `טלפון: ${ins.clientPhone?.trim() || "לא הוזן"}`,
    ...(waze ? [`Waze: ${waze}`] : []),
    ...(ins.apartmentTypeName ? [`סוג נכס: ${ins.apartmentTypeName}${ins.unitsCount > 1 ? ` (${ins.unitsCount} יחידות)` : ""}`] : []),
    ...(ins.notes?.trim() ? [`הערות: ${ins.notes.trim()}`] : []),
    "",
    `נוצר אוטומטית ממערכת כתר הנדסה. שינויים נעשים במערכת${appUrl ? `: ${appUrl}/inspections?month=${day.slice(0, 7)}` : ""}`,
  ];

  let start: calendar_v3.Schema$EventDateTime;
  let end: calendar_v3.Schema$EventDateTime;
  const startAt = ins.time ? parseIsraelDateTime(`${day}T${ins.time}`) : null;
  if (startAt) {
    const endAt = new Date(startAt.getTime() + INSPECTION_MINUTES * 60_000);
    start = { dateTime: startAt.toISOString(), timeZone: ISRAEL_TZ, date: null };
    end = { dateTime: endAt.toISOString(), timeZone: ISRAEL_TZ, date: null };
  } else {
    start = { date: day, dateTime: null, timeZone: null };
    end = { date: addDaysToKey(day, 1), dateTime: null, timeZone: null };
  }

  const body: GEvent = {
    summary: `בדק בית${ins.kind === "REPEAT" ? " (חוזרת)" : ""}: ${ins.clientName}${ins.city?.trim() ? ` – ${ins.city.trim()}` : ""}`,
    location: full ?? "",
    description: lines.join("\n"),
    start,
    end,
    extendedProperties: { private: { ceterInspectionId: ins.id } },
  };
  return { body, hash: hashText(JSON.stringify(body)) };
}

/** Marks an inspection event that was deleted in Google: not re-created until the inspection changes. */
export const deletedHash = (hash: string | null) => `deleted:${hash ?? ""}`;
