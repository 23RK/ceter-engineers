"use client";

import { useActionState, useEffect } from "react";
import { createTask, updateTask, type ActionState } from "@/lib/actions/tasks";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { toDateInputValue } from "@/lib/format";
import type { ProjectOption, TaskWithRelations, UserOption } from "@/lib/types";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function TaskForm({
  task,
  users,
  projects,
  defaultProjectId,
  onClose,
}: {
  task?: TaskWithRelations;
  users: UserOption[];
  projects: ProjectOption[];
  defaultProjectId?: string;
  onClose: () => void;
}) {
  const action = task ? updateTask.bind(null, task.id) : createTask;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-brand-900">כותרת</label>
        <input
          name="title"
          required
          defaultValue={task?.title}
          className={inputClass}
          placeholder="לדוגמה: הזמנת חומרי איטום"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-brand-900">תיאור</label>
        <textarea
          name="description"
          defaultValue={task?.description ?? ""}
          rows={3}
          className={inputClass}
          placeholder="פרטים נוספים (אופציונלי)"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">סטטוס</label>
          <select
            name="status"
            defaultValue={task?.status ?? "TODO"}
            className={inputClass}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">
            עדיפות
          </label>
          <select
            name="priority"
            defaultValue={task?.priority ?? "MEDIUM"}
            className={inputClass}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">
            אחראי/ת
          </label>
          <select
            name="assigneeId"
            defaultValue={task?.assigneeId ?? ""}
            className={inputClass}
          >
            <option value="">לא משויך</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">
            פרויקט
          </label>
          <select
            name="projectId"
            defaultValue={task?.projectId ?? defaultProjectId ?? ""}
            className={inputClass}
          >
            <option value="">משימה כללית</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">
            תאריך התחלה
          </label>
          <input
            type="date"
            name="startDate"
            defaultValue={toDateInputValue(task?.startDate)}
            className={inputClass}
            dir="ltr"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">
            תאריך יעד
          </label>
          <input
            type="date"
            name="dueDate"
            defaultValue={toDateInputValue(task?.dueDate)}
            className={inputClass}
            dir="ltr"
          />
        </div>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-black/60 transition hover:bg-black/5"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "שומר..." : task ? "עדכון משימה" : "יצירת משימה"}
        </button>
      </div>
    </form>
  );
}
