"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { AlarmClock, Calendar, Check, UserPlus } from "lucide-react";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { patchTask } from "@/lib/actions/tasks";
import { postponedDate, splitDeadlines, UPCOMING_DAYS } from "@/lib/dashboard";
import { taskPriorityMeta } from "@/lib/constants";
import { formatDateShort, toDateInputValue } from "@/lib/format";
import type { UserOption } from "@/lib/types";

export type DashboardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  assigneeId: string | null;
  project: { id: string; name: string } | null;
};

type Patch = { status?: TaskStatus; assigneeId?: string | null; dueDate?: string | null };

/**
 * The dashboard's task lists (SPEC §3.6): overdue (with days passed) and the
 * next two weeks, then unassigned tasks. Each row has quick actions - mark
 * done, postpone, assign - shown at once and saved in the background.
 */
export function DashboardTasks({
  tasks: serverTasks,
  users,
  today: todayIso,
}: {
  tasks: DashboardTask[];
  users: UserOption[];
  /** Today in Israel, yyyy-mm-dd (from the server, so both sides agree). */
  today: string;
}) {
  const today = useMemo(() => new Date(todayIso), [todayIso]);
  const [tasks, apply] = useOptimistic(serverTasks, (state, { id, patch }: { id: string; patch: Patch }) =>
    state.map((t) =>
      t.id !== id
        ? t
        : {
            ...t,
            ...(patch.status && { status: patch.status }),
            ...("assigneeId" in patch && { assigneeId: patch.assigneeId ?? null }),
            ...("dueDate" in patch && { dueDate: patch.dueDate ? new Date(patch.dueDate) : null }),
          }
    )
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(id: string, patch: Patch) {
    setError(null);
    startTransition(async () => {
      apply({ id, patch });
      try {
        const res = await patchTask(id, patch);
        if (res.error) setError(res.error);
      } catch {
        setError("השינוי לא נשמר. נסו שוב.");
      }
    });
  }

  const { overdue, upcoming } = useMemo(() => splitDeadlines(tasks, today), [tasks, today]);
  const unassigned = tasks.filter((t) => t.status !== "DONE" && !t.assigneeId);
  const row = (t: DashboardTask, late?: number) => (
    <TaskRow key={t.id} task={t} daysLate={late} users={users} today={today} run={run} />
  );

  return (
    <>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-2 flex items-center gap-2">
          <AlarmClock size={16} className="text-red-500" />
          <h2 className="text-sm font-bold text-brand-900">באיחור ({overdue.length})</h2>
        </div>
        {overdue.length === 0 ? (
          <p className="py-2 text-sm text-black/40">אין משימות באיחור.</p>
        ) : (
          <ul className="divide-y divide-black/5">{overdue.map(({ task, daysLate }) => row(task, daysLate))}</ul>
        )}

        <div className="mt-5 mb-2 flex items-center gap-2 border-t border-black/5 pt-4">
          <Calendar size={16} className="text-brand-600" />
          <h2 className="text-sm font-bold text-brand-900">
            בשבועיים הקרובים ({upcoming.length})
          </h2>
        </div>
        {upcoming.length === 0 ? (
          <p className="py-2 text-sm text-black/40">אין משימות עם תאריך יעד ב-{UPCOMING_DAYS} הימים הקרובים.</p>
        ) : (
          <ul className="divide-y divide-black/5">{upcoming.map((t) => row(t))}</ul>
        )}
      </section>

      <section
        className={`rounded-2xl border p-4 shadow-sm sm:p-6 ${
          unassigned.length ? "border-amber-200 bg-amber-50/60" : "border-black/5 bg-white"
        }`}
      >
        <div className="mb-2 flex items-center gap-2">
          <UserPlus size={16} className="text-amber-600" />
          <h2 className="text-sm font-bold text-brand-900">משימות ללא שיוך ({unassigned.length})</h2>
        </div>
        {unassigned.length === 0 ? (
          <p className="py-2 text-sm text-black/40">כל המשימות הפתוחות משויכות.</p>
        ) : (
          <ul className="divide-y divide-amber-200/60">{unassigned.map((t) => row(t))}</ul>
        )}
      </section>
    </>
  );
}

function TaskRow({
  task,
  daysLate,
  users,
  today,
  run,
}: {
  task: DashboardTask;
  daysLate?: number;
  users: UserOption[];
  today: Date;
  run: (id: string, patch: Patch) => void;
}) {
  const priority = taskPriorityMeta(task.priority);
  const done = task.status === "DONE";
  const unassigned = !task.assigneeId;
  const [picking, setPicking] = useState(false);
  const control =
    "min-h-9 rounded-lg border-0 bg-black/[0.04] px-2 text-xs font-medium text-brand-900 outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <li
      className={`flex flex-col gap-2 py-2.5 transition sm:flex-row sm:items-center sm:gap-3 ${
        done ? "opacity-40" : ""
      } ${unassigned ? "-mx-2 rounded-lg bg-amber-50 px-2" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          disabled={done}
          onClick={() => run(task.id, { status: "DONE" })}
          aria-label={`סימון "${task.title}" כבוצע`}
          title="סמן כבוצע"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black/15 text-transparent transition hover:border-green-500 hover:bg-green-50 hover:text-green-600"
        >
          <Check size={15} strokeWidth={3} />
        </button>
        <span className={`h-2 w-2 shrink-0 rounded-full ${priority.dot}`} title={`עדיפות ${priority.label}`} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-brand-900">{task.title}</p>
          <p className="truncate text-xs text-black/45">
            {task.project ? (
              <Link href={`/projects/${task.project.id}?tab=tasks`} className="hover:text-brand-600 hover:underline">
                {task.project.name}
              </Link>
            ) : (
              "ללא פרויקט"
            )}
            {task.dueDate && <> · {formatDateShort(task.dueDate)}</>}
          </p>
        </div>
        {daysLate !== undefined && (
          <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
            {daysLate === 1 ? "יום אחד" : `${daysLate} ימים`}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pr-11 sm:pr-0">
        {/* Postpone */}
        {picking ? (
          <input
            type="date"
            autoFocus
            defaultValue={toDateInputValue(task.dueDate)}
            onChange={(e) => {
              if (e.target.value) {
                setPicking(false);
                run(task.id, { dueDate: e.target.value });
              }
            }}
            onBlur={() => setPicking(false)}
            aria-label="תאריך יעד חדש"
            className={`${control} w-[8.5rem]`}
          />
        ) : (
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v === "pick") return setPicking(true);
              if (v) run(task.id, { dueDate: postponedDate(task.dueDate, today, Number(v)) });
            }}
            aria-label="דחיית תאריך"
            className={control}
          >
            <option value="">דחה תאריך…</option>
            <option value="1">ביום</option>
            <option value="3">ב-3 ימים</option>
            <option value="7">בשבוע</option>
            <option value="14">בשבועיים</option>
            <option value="pick">תאריך אחר…</option>
          </select>
        )}

        {/* Assign */}
        {unassigned ? (
          users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => run(task.id, { assigneeId: u.id })}
              className="flex min-h-9 items-center gap-1 rounded-lg bg-amber-100 px-2.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-200"
            >
              <UserPlus size={13} />
              {u.name}
            </button>
          ))
        ) : (
          <select
            value={task.assigneeId ?? ""}
            onChange={(e) => run(task.id, { assigneeId: e.target.value || null })}
            aria-label="שיוך לשותף"
            className={control}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
            <option value="">ללא שיוך</option>
          </select>
        )}
      </div>
    </li>
  );
}
