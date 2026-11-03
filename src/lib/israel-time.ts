// Wall-clock times in Israel. The server runs in UTC (Vercel), so a
// "2026-11-05T09:00" from a datetime-local input must be read as 09:00 in
// Israel - not 09:00 UTC - before it is stored or sent to Google. Plain
// module: used by Server Actions, server components and client components.

export const ISRAEL_TZ = "Asia/Jerusalem";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ISRAEL_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function israelParts(date: Date) {
  const p: Record<string, string> = {};
  for (const { type, value } of partsFormatter.formatToParts(date)) p[type] = value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** Israel's offset from UTC at this instant, in minutes (120 in winter, 180 in summer). */
export function israelOffsetMinutes(date: Date) {
  const p = israelParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

/**
 * "yyyy-MM-ddTHH:mm" (or "yyyy-MM-dd", read as midnight), as a wall-clock
 * time in Israel, to the real instant. null when it can't be read.
 */
export function parseIsraelDateTime(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec((value ?? "").trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4] ?? "0", m[5] ?? "0"].map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(guess)) return null;
  // Two passes settle the offset also next to a DST change.
  let t = guess - israelOffsetMinutes(new Date(guess)) * 60_000;
  t = guess - israelOffsetMinutes(new Date(t)) * 60_000;
  const result = new Date(t);
  // Reject impossible dates like 2026-02-31.
  const back = israelParts(result);
  if (back.year !== y || back.month !== mo || back.day !== d) return null;
  return result;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "yyyy-MM-dd" of this instant in Israel. */
export function israelDayKey(date: Date | string) {
  const p = israelParts(new Date(date));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "HH:mm" of this instant in Israel. */
export function israelTime(date: Date | string) {
  const p = israelParts(new Date(date));
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** The value for a datetime-local input, in Israel time. */
export function toIsraelDateTimeInput(date: Date | string | null | undefined) {
  if (!date) return "";
  return `${israelDayKey(date)}T${israelTime(date)}`;
}

/** Midnight in Israel at the start of this "yyyy-MM-dd". */
export function israelMidnight(dayKey: string) {
  return parseIsraelDateTime(dayKey);
}

/** "yyyy-MM-dd" + n days (calendar arithmetic, no time zone involved). */
export function addDaysToKey(dayKey: string, days: number) {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
