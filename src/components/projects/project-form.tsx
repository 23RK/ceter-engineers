"use client";

import { useActionState, useEffect } from "react";
import {
  createProject,
  updateProject,
  type ActionState,
} from "@/lib/actions/projects";
import { PROJECT_STATUSES } from "@/lib/constants";
import { toDateInputValue } from "@/lib/format";
import type { Project } from "@prisma/client";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function ProjectForm({
  project,
  onClose,
}: {
  project?: Project;
  onClose: () => void;
}) {
  const action = project
    ? updateProject.bind(null, project.id)
    : createProject;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-brand-900">
          שם הפרויקט
        </label>
        <input
          name="name"
          required
          defaultValue={project?.name}
          className={inputClass}
          placeholder='לדוגמה: בניין מגורים - רח&quot; הרצל 12'
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">לקוח</label>
          <input
            name="client"
            defaultValue={project?.client ?? ""}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">כתובת</label>
          <input
            name="address"
            defaultValue={project?.address ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">סטטוס</label>
          <select
            name="status"
            defaultValue={project?.status ?? "PLANNING"}
            className={inputClass}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">
            תקציב (₪)
          </label>
          <input
            type="number"
            name="budget"
            min={0}
            step="1000"
            defaultValue={project?.budget ?? ""}
            className={inputClass}
            dir="ltr"
          />
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
            defaultValue={toDateInputValue(project?.startDate)}
            className={inputClass}
            dir="ltr"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">
            תאריך סיום יעד
          </label>
          <input
            type="date"
            name="endDate"
            defaultValue={toDateInputValue(project?.endDate)}
            className={inputClass}
            dir="ltr"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-brand-900">הערות</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={project?.description ?? ""}
          className={inputClass}
        />
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
          {pending ? "שומר..." : project ? "עדכון פרויקט" : "יצירת פרויקט"}
        </button>
      </div>
    </form>
  );
}
