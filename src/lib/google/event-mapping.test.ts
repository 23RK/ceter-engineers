import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyEvent,
  deletedHash,
  eventBodyFromMeeting,
  eventKey,
  eventTimes,
  inspectionCalendarUser,
  inspectionEventBody,
  isNewerThan,
  meetingFieldsFromEvent,
  mergeAttendees,
  PRIVATE_TITLE,
  type GEvent,
  type InspectionForEvent,
} from "./event-mapping";
import {
  israelDayKey,
  israelOffsetMinutes,
  israelTime,
  parseIsraelDateTime,
  toIsraelDateTimeInput,
} from "../israel-time";

const RON = "ronketerltd@gmail.com";
const GUY = "guyketerltd@gmail.com";

// ---------------------------------------------------------------- Israel time

test("Israel wall-clock times are read in Israel, not UTC (winter and summer)", () => {
  assert.equal(parseIsraelDateTime("2026-11-05T09:00")!.toISOString(), "2026-11-05T07:00:00.000Z");
  assert.equal(parseIsraelDateTime("2026-07-05T09:00")!.toISOString(), "2026-07-05T06:00:00.000Z");
  assert.equal(parseIsraelDateTime("2026-11-05")!.toISOString(), "2026-11-04T22:00:00.000Z");
  assert.equal(israelOffsetMinutes(new Date("2026-01-01T00:00:00Z")), 120);
  assert.equal(israelOffsetMinutes(new Date("2026-07-01T00:00:00Z")), 180);
});

test("invalid wall-clock values are rejected", () => {
  assert.equal(parseIsraelDateTime(""), null);
  assert.equal(parseIsraelDateTime("2026-02-31T10:00"), null);
  assert.equal(parseIsraelDateTime("tomorrow"), null);
});

test("an instant is shown in Israel time, and round-trips through the form input", () => {
  const d = new Date("2026-11-05T22:30:00Z"); // 00:30 on the 6th in Israel
  assert.equal(israelDayKey(d), "2026-11-06");
  assert.equal(israelTime(d), "00:30");
  assert.equal(toIsraelDateTimeInput(d), "2026-11-06T00:30");
  assert.equal(parseIsraelDateTime(toIsraelDateTimeInput(d))!.getTime(), d.getTime());
});

// ---------------------------------------------------------------- Keys & times

test("a shared meeting has the same key in both calendars; recurring instances differ", () => {
  const inRon: GEvent = { id: "abc", iCalUID: "abc@google.com" };
  const inGuy: GEvent = { id: "abc", iCalUID: "abc@google.com" };
  assert.equal(eventKey(inRon), eventKey(inGuy));

  const i1: GEvent = {
    iCalUID: "r@google.com",
    recurringEventId: "r",
    originalStartTime: { dateTime: "2026-11-05T09:00:00+02:00" },
  };
  const i1OtherZone: GEvent = { ...i1, originalStartTime: { dateTime: "2026-11-05T07:00:00Z" } };
  const i2: GEvent = { ...i1, originalStartTime: { dateTime: "2026-11-12T09:00:00+02:00" } };
  assert.equal(eventKey(i1), eventKey(i1OtherZone));
  assert.notEqual(eventKey(i1), eventKey(i2));
  assert.equal(eventKey({ id: "x" }), null);
});

test("all-day events run from midnight to midnight in Israel", () => {
  const t = eventTimes({ start: { date: "2026-11-05" }, end: { date: "2026-11-06" } })!;
  assert.equal(t.allDay, true);
  assert.equal(t.startTime.toISOString(), "2026-11-04T22:00:00.000Z");
  assert.equal(t.endTime.toISOString(), "2026-11-05T22:00:00.000Z");
  assert.equal(eventTimes({}), null);
});

// ---------------------------------------------------------------- Classification

const ctx = { partnerEmail: GUY, partnerConnected: true };

test("a meeting organized by the other connected partner is imported from their calendar only", () => {
  const guysMeetingInRonsCalendar: GEvent = {
    id: "e1",
    organizer: { email: GUY },
    attendees: [{ email: GUY, organizer: true }, { email: RON, self: true, responseStatus: "accepted" }],
  };
  assert.equal(classifyEvent(guysMeetingInRonsCalendar, ctx), "partner");
  // Guy hasn't connected his calendar: Ron's copy is imported (read-only).
  assert.equal(classifyEvent(guysMeetingInRonsCalendar, { partnerEmail: GUY, partnerConnected: false }), "import");
  // Ron's own meeting with Guy invited: Ron's sync imports it.
  assert.equal(
    classifyEvent({ id: "e2", organizer: { email: RON, self: true }, attendees: [{ email: GUY }] }, ctx),
    "import"
  );
});

test("cancelled, declined, inspection and non-meeting events are not imported", () => {
  assert.equal(classifyEvent({ id: "c", status: "cancelled" }, ctx), "removed");
  assert.equal(
    classifyEvent({ id: "d", organizer: { email: "client@x.com" }, attendees: [{ email: RON, self: true, responseStatus: "declined" }] }, ctx),
    "removed"
  );
  assert.equal(classifyEvent({ id: "i", extendedProperties: { private: { ceterInspectionId: "ins1" } } }, ctx), "inspection");
  assert.equal(classifyEvent({ id: "w", eventType: "workingLocation" }, ctx), "skip");
  assert.equal(classifyEvent({ id: "b", eventType: "birthday" }, ctx), "skip");
});

// ---------------------------------------------------------------- Fields

const timed = { start: { dateTime: "2026-11-05T09:00:00+02:00" }, end: { dateTime: "2026-11-05T10:00:00+02:00" } };

test("a private event keeps only its time and shows as busy", () => {
  const f = meetingFieldsFromEvent(
    { ...timed, summary: "רופא", description: "secret", location: "בית", visibility: "private", organizer: { self: true } },
    GUY
  )!;
  assert.equal(f.title, PRIVATE_TITLE);
  assert.equal(f.description, null);
  assert.equal(f.location, null);
  assert.equal(f.isPrivate, true);
  assert.equal(f.readOnly, true);
});

test("a regular event: title, details, partner invited, editable when organized by the partner themself", () => {
  const f = meetingFieldsFromEvent(
    {
      ...timed,
      summary: " פגישה עם יזם ",
      location: "תל אביב",
      updated: "2026-11-03T10:00:00.000Z",
      organizer: { email: RON, self: true },
      attendees: [{ email: "GuyKeterLtd@gmail.com" }],
    },
    GUY
  )!;
  assert.equal(f.title, "פגישה עם יזם");
  assert.equal(f.location, "תל אביב");
  assert.equal(f.startTime.toISOString(), "2026-11-05T07:00:00.000Z");
  assert.equal(f.withPartner, true);
  assert.equal(f.readOnly, false);
  assert.equal(f.googleUpdated!.toISOString(), "2026-11-03T10:00:00.000Z");
});

test("an invitation from someone outside is read-only (edits would change only one copy)", () => {
  const f = meetingFieldsFromEvent({ ...timed, summary: "x", organizer: { email: "client@x.com" } }, GUY)!;
  assert.equal(f.readOnly, true);
  assert.equal(f.withPartner, false);
});

test("newer Google changes win; equal or older ones are ignored", () => {
  const a = new Date("2026-11-03T10:00:00Z");
  const b = new Date("2026-11-03T10:05:00Z");
  assert.equal(isNewerThan(b, a), true);
  assert.equal(isNewerThan(a, a), false);
  assert.equal(isNewerThan(a, b), false);
  assert.equal(isNewerThan(a, null), true);
});

test("inviting / un-inviting the partner keeps everyone else", () => {
  const existing = [{ email: "client@x.com", responseStatus: "accepted" }, { email: GUY, responseStatus: "accepted" }];
  assert.deepEqual(mergeAttendees(existing, GUY, false), [{ email: "client@x.com", responseStatus: "accepted" }]);
  assert.deepEqual(mergeAttendees(existing, GUY, true), existing);
  assert.deepEqual(mergeAttendees([{ email: "client@x.com" }], GUY, true), [{ email: "client@x.com" }, { email: GUY }]);
  assert.deepEqual(mergeAttendees(undefined, GUY, true), [{ email: GUY }]);
});

test("a meeting from the system is written with Israel time and its id", () => {
  const body = eventBodyFromMeeting({
    id: "m1",
    title: "פגישה",
    description: null,
    location: null,
    startTime: new Date("2026-11-05T07:00:00Z"),
    endTime: new Date("2026-11-05T08:00:00Z"),
  });
  assert.equal(body.start!.dateTime, "2026-11-05T07:00:00.000Z");
  assert.equal(body.start!.timeZone, "Asia/Jerusalem");
  assert.equal(body.extendedProperties!.private!.ceterMeetingId, "m1");
});

// ---------------------------------------------------------------- Inspections

const inspection: InspectionForEvent = {
  id: "ins1",
  date: new Date("2026-11-05T00:00:00Z"),
  time: "10:30",
  kind: "REGULAR",
  status: "SCHEDULED",
  clientName: "דנה כהן",
  clientPhone: "050-1234567",
  city: "חיפה",
  address: "הרצל 5",
  apartmentNumber: "12",
  unitsCount: 1,
  apartmentTypeName: "4 חדרים",
  notes: null,
  inspectorUserId: "user-ron",
};

test("an inspection of Ron / Guy goes to their calendar with address, phone and Waze", () => {
  const { body } = inspectionEventBody(inspection, "https://ceter-engineers.vercel.app")!;
  assert.equal(body.summary, "בדק בית: דנה כהן – חיפה");
  assert.equal(body.location, "הרצל 5, דירה 12, חיפה");
  assert.match(body.description!, /כתובת: הרצל 5, דירה 12, חיפה/);
  assert.match(body.description!, /טלפון: 050-1234567/);
  assert.match(body.description!, /Waze: https:\/\/waze\.com\/ul\?q=/);
  assert.equal(body.start!.dateTime, "2026-11-05T08:30:00.000Z"); // 10:30 in Israel
  assert.equal(body.end!.dateTime, "2026-11-05T10:30:00.000Z"); // two hours
  assert.equal(body.extendedProperties!.private!.ceterInspectionId, "ins1");
});

test("an inspection without a time is an all-day event", () => {
  const { body } = inspectionEventBody({ ...inspection, time: null }, null)!;
  assert.equal(body.start!.date, "2026-11-05");
  assert.equal(body.end!.date, "2026-11-06");
  assert.equal(body.start!.dateTime, null);
});

test("the hash changes only when the event changes", () => {
  const a = inspectionEventBody(inspection, null)!.hash;
  assert.equal(inspectionEventBody({ ...inspection }, null)!.hash, a);
  assert.notEqual(inspectionEventBody({ ...inspection, time: "11:00" }, null)!.hash, a);
  assert.notEqual(deletedHash(a), a);
});

test("only a dated, not-canceled inspection of Ron / Guy belongs in a Google calendar", () => {
  assert.equal(inspectionCalendarUser(inspection), "user-ron");
  assert.equal(inspectionCalendarUser({ ...inspection, inspectorUserId: null }), null); // freelancer
  assert.equal(inspectionCalendarUser({ ...inspection, date: null }), null);
  assert.equal(inspectionCalendarUser({ ...inspection, status: "CANCELED" }), null);
  assert.equal(inspectionEventBody({ ...inspection, date: null }, null), null);
});
