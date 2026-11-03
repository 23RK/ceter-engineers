import { format, isPast, isToday, startOfDay } from "date-fns";
import { he } from "date-fns/locale";

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return null;
  return format(new Date(date), "d בMMMM yyyy", { locale: he });
}

export function formatDateShort(date: Date | string | null | undefined) {
  if (!date) return null;
  return format(new Date(date), "d/M/yy", { locale: he });
}

export function isOverdue(date: Date | string | null | undefined) {
  if (!date) return false;
  const d = startOfDay(new Date(date));
  return isPast(d) && !isToday(d);
}

export function toDateInputValue(date: Date | string | null | undefined) {
  if (!date) return "";
  return format(new Date(date), "yyyy-MM-dd");
}

export function toDateTimeInputValue(date: Date | string | null | undefined) {
  if (!date) return "";
  return format(new Date(date), "yyyy-MM-dd'T'HH:mm");
}

export function formatTime(date: Date | string | null | undefined) {
  if (!date) return null;
  return format(new Date(date), "HH:mm");
}

/**
 * Today's date in Israel, as a date-only value (UTC midnight) - the same
 * shape a `<input type="date">` value produces. The server runs in UTC, so
 * plain `new Date()` would still be "yesterday" just after midnight here.
 */
export function israelToday() {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
  }).format(new Date());
  return new Date(ymd);
}

/** ₪ amount for display, without agorot when it's a whole number. */
export function formatMoney(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return null;
  return `₪${amount.toLocaleString("he-IL", {
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  })}`;
}
