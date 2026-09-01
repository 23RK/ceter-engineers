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
