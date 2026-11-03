"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { Modal } from "@/components/ui/modal";
import { TaskForm } from "@/components/tasks/task-form";
import { deleteTask, patchTask } from "@/lib/actions/tasks";
import { TASK_STATUSES, taskPriorityMeta, taskStatusMeta } from "@/lib/constants";
import { isOverdue, toDateInputValue } from "@/lib/format";
import type { ProjectOption, TaskWithRelations, UserOption } from "@/lib/types";
import type { ActionState } from "@/lib/actions/tasks";
import { useActionResult } from "@/components/ui/toast";

type Patch = { status?: TaskStatus; assigneeId?: string | null; dueDate?: string | null };
type Change = { id: string; patch: Patch } | { id: string; remove: true };

const time = (d: Date | string | null) => (d ? new Date(d).getTime() : Infinity);

/** Open tasks first, by due date (no date last); then done ones. */
function sortTasks(tasks: TaskWithRelations[]) {
  return [...tasks].sort(
    (a, b) =>
      Number(a.status === "DONE") - Number(b.status === "DONE") ||
      time(a.dueDate) - time(b.dueDate) ||
      a.title.localeCompare(b.title, "he")
  );
}

/**
 * The project's tasks as a compact list - one row per task (SPEC §3.4), with
 * status, assignee and date edited in place. Changes show at once and roll
 * back with a message if saving fails.
 */
export function ProjectTaskList({
  projectId,
  tasks: serverTasks,
  users,
  projects,
}: {
  projectId: string;
  tasks: TaskWithRelations[];
  users: UserOption[];
  projects: ProjectOption[];
}) {
  const [tasks, apply] = useOptimistic(serverTasks, (state, change: Change) =>
    "remove" in change
      ? state.filter((t) => t.id !== change.id)
      : state.map((t) => {
          if (t.id !== change.id) return t;
          const p = change.patch;
          return {
            ...t,
            ...(p.status && { status: p.status }),
            ...("assigneeId" in p && {
              assigneeId: p.assigneeId ?? null,
              assignee: (users.find((u) => u.id === p.assigneeId) as TaskWithRelations["assignee"]) ?? null,
            }),
            ...("dueDate" in p && { dueDate: p.dueDate ? new Date(p.dueDate) : null }),
          };
        })
  );
  const [, startTransition] = useTransition();
  const onResult = useActionResult();
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  function run(change: Change, save: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      apply(change);
      try {
        const res = onResult((await save()) as ActionState | undefined);
        if (res?.error) setError(res.error);
      } catch {
        setError("השינוי לא נשמר. נסו שוב.");
      }
    });
  }

  const sorted = sortTasks(tasks);
  const open = sorted.filter((t) => t.status !== "DONE");
  const done = sorted.filter((t) => t.status === "DONE");

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-brand-900">
          משימות פתוחות ({open.length})
        </h2>
        <Modal
          title="משימה חדשה"
          trigger={
            <button className="flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
              <Plus size={15} />
              משימה
            </button>
          }
        >
          {(close) => (
            <TaskForm users={users} projects={projects} defaultProjectId={projectId} onClose={close} />
          )}
        </Modal>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {open.length === 0 ? (
        <p className="py-4 text-sm text-black/40">אין משימות פתוחות.</p>
      ) : (
        <ul className="divide-y divide-black/5">
          {open.map((task) => (
            <TaskRow key={task.id} task={task} users={users} projects={projects} run={run} />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <div className="mt-3 border-t border-black/5 pt-2">
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="flex min-h-10 items-center gap-1 text-sm font-medium text-black/50 hover:text-brand-700"
          >
            <ChevronDown size={16} className={`transition ${showDone ? "rotate-180" : ""}`} />
            הושלמו ({done.length})
          </button>
          {showDone && (
            <ul className="divide-y divide-black/5">
              {done.map((task) => (
                <TaskRow key={task.id} task={task} users={users} projects={projects} run={run} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function TaskRow({
  task,
  users,
  projects,
  run,
}: {
  task: TaskWithRelations;
  users: UserOption[];
  projects: ProjectOption[];
  run: (change: Change, save: () => Promise<unknown>) => void;
}) {
  const priority = taskPriorityMeta(task.priority);
  const status = taskStatusMeta(task.status);
  const done = task.status === "DONE";
  const overdue = !done && isOverdue(task.dueDate);
  const patch = (p: Patch) => run({ id: task.id, patch: p }, () => patchTask(task.id, p));

  const control =
    "min-h-9 rounded-lg border-0 bg-black/[0.03] px-2 text-xs outline-none focus:ring-2 focus:ring-brand-500/30";

  return (
    <li className="flex flex-col gap-2 py-2.5 lg:flex-row lg:items-center lg:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${priority.dot}`} title={`עדיפות ${priority.label}`} />
        <Modal
          title="עריכת משימה"
          trigger={
            <button
              type="button"
              className={`min-w-0 truncate text-right text-sm ${done ? "text-black/40 line-through" : "font-medium text-brand-900 hover:text-brand-600"}`}
            >
              {task.title}
            </button>
          }
        >
          {(close) => <TaskForm task={task} users={users} projects={projects} onClose={close} />}
        </Modal>
        {task.priority === "URGENT" && !done && (
          <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">דחוף</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pr-4 lg:pr-0">
        <select
          value={task.status}
          onChange={(e) => patch({ status: e.target.value as TaskStatus })}
          aria-label="סטטוס"
          className={`${control} font-medium ${status.badge}`}
        >
          {TASK_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={task.assigneeId ?? ""}
          onChange={(e) => patch({ assigneeId: e.target.value || null })}
          aria-label="אחראי"
          className={`${control} ${task.assigneeId ? "" : "font-semibold text-amber-700"}`}
        >
          <option value="">ללא שיוך</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={toDateInputValue(task.dueDate)}
          onChange={(e) => patch({ dueDate: e.target.value || null })}
          aria-label="תאריך יעד"
          className={`${control} w-[8.5rem] ${overdue ? "bg-red-50 font-semibold text-red-600" : ""}`}
        />
        <button
          type="button"
          onClick={() => {
            if (confirm(`למחוק את המשימה "${task.title}"?`)) {
              run({ id: task.id, remove: true }, () => deleteTask(task.id));
            }
          }}
          aria-label="מחיקת משימה"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-black/25 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}
