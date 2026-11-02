import { test } from "node:test";
import assert from "node:assert/strict";
import { expectedCollection, postponedDate, splitDeadlines } from "./dashboard";

const today = new Date("2026-11-10");
const task = (id: string, dueDate: string | null, status = "TODO") => ({ id, dueDate, status });

test("deadlines: overdue (oldest first, days late) and the next two weeks", () => {
  const { overdue, upcoming } = splitDeadlines(
    [
      task("late2", "2026-11-08"),
      task("late9", "2026-11-01"),
      task("today", "2026-11-10"),
      task("in14", "2026-11-24"),
      task("in15", "2026-11-25"),
      task("done", "2026-11-01", "DONE"),
      task("nodate", null),
    ],
    today
  );
  assert.deepEqual(
    overdue.map((o) => [o.task.id, o.daysLate]),
    [
      ["late9", 9],
      ["late2", 2],
    ]
  );
  assert.deepEqual(upcoming.map((t) => t.id), ["today", "in14"]);
});

test("expected collection this month, and earlier unpaid payments", () => {
  const p = (amount: number, dueDate: string | null, paid = false) => ({ amount, dueDate, paid });
  const c = expectedCollection(
    [
      p(1000, "2026-11-01"),
      p(2000, "2026-11-30"),
      p(5000, "2026-11-15", true),
      p(700, "2026-10-20"),
      p(900, "2026-12-01"),
      p(100, null),
    ],
    today
  );
  assert.equal(c.thisMonthTotal, 3000);
  assert.equal(c.thisMonth.length, 2);
  assert.equal(c.earlierTotal, 700);
});

test("postpone counts from the due date, or from today when it already passed", () => {
  assert.equal(postponedDate("2026-11-12", today, 7), "2026-11-19");
  assert.equal(postponedDate("2026-11-01", today, 1), "2026-11-11");
  assert.equal(postponedDate(null, today, 7), "2026-11-17");
});
