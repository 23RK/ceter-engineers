/** Dashboard logic (SPEC §3.6). Dates are date-only values (UTC midnight), like `israelToday()`. */

const DAY = 24 * 60 * 60 * 1000;

export const UPCOMING_DAYS = 14;

const time = (d: Date | string) => new Date(d).getTime();

/** Whole days from `date` to `today` (positive when the date has passed). */
export function daysLate(date: Date | string, today: Date) {
  return Math.round((today.getTime() - time(date)) / DAY);
}

/**
 * "מועדי יעד" split in two (SPEC §3.6): overdue first (oldest first, with
 * the days that passed), then due today through the next two weeks.
 */
export function splitDeadlines<T extends { dueDate: Date | string | null; status: string }>(
  tasks: T[],
  today: Date
) {
  const open = tasks.filter((t) => t.status !== "DONE" && t.dueDate);
  const byDate = (a: T, b: T) => time(a.dueDate!) - time(b.dueDate!);
  const end = today.getTime() + UPCOMING_DAYS * DAY;
  return {
    overdue: open
      .filter((t) => time(t.dueDate!) < today.getTime())
      .sort(byDate)
      .map((task) => ({ task, daysLate: daysLate(task.dueDate!, today) })),
    upcoming: open
      .filter((t) => time(t.dueDate!) >= today.getTime() && time(t.dueDate!) <= end)
      .sort(byDate),
  };
}

/** The first day of today's month and the first day of the next one. */
export function monthRange(today: Date) {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const next = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  return { start, next };
}

/**
 * "גבייה צפויה החודש": unpaid payments due this month, and separately the
 * unpaid ones whose date already passed before this month.
 */
export function expectedCollection<
  P extends { amount: number; paid: boolean; dueDate: Date | string | null },
>(payments: P[], today: Date) {
  const { start, next } = monthRange(today);
  const unpaid = payments.filter((p) => !p.paid && p.dueDate);
  const thisMonth = unpaid.filter(
    (p) => time(p.dueDate!) >= start.getTime() && time(p.dueDate!) < next.getTime()
  );
  const earlier = unpaid.filter((p) => time(p.dueDate!) < start.getTime());
  const sum = (list: P[]) => Math.round(list.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  return {
    thisMonth: thisMonth.sort((a, b) => time(a.dueDate!) - time(b.dueDate!)),
    thisMonthTotal: sum(thisMonth),
    earlier: earlier.sort((a, b) => time(a.dueDate!) - time(b.dueDate!)),
    earlierTotal: sum(earlier),
  };
}

/** Postpone a due date: by days from the current date (or from today if it already passed). */
export function postponedDate(dueDate: Date | string | null, today: Date, days: number) {
  const base = dueDate && time(dueDate) >= today.getTime() ? new Date(dueDate) : today;
  return new Date(base.getTime() + days * DAY).toISOString().slice(0, 10);
}
