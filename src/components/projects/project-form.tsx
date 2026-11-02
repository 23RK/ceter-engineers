"use client";

import { useActionState, useEffect } from "react";
import {
  createProject,
  updateProject,
  type ActionState,
} from "@/lib/actions/projects";
import { PROJECT_STATUSES } from "@/lib/constants";
import { DEPARTMENTS } from "@/lib/departments";
import { toDateInputValue } from "@/lib/format";
import type { Department, Project } from "@prisma/client";
import type { UserOption } from "@/lib/types";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function ProjectForm({
  project,
  users,
  defaultDepartment,
  onClose,
}: {
  project?: Project;
  /** The partners, for "אחראי". */
  users: UserOption[];
  /** Pre-selected when creating from a department screen. */
  defaultDepartment?: Department;
  onClose: () => void;
}) {
  const selectedDepartment = project?.department ?? defaultDepartment;
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

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-brand-900">
          מחלקה
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {DEPARTMENTS.map((d) => (
            <label
              key={d.value}
              className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-black/10 bg-white px-3 py-2 text-center text-sm font-medium text-black/60 shadow-sm transition has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/30"
            >
              <input
                type="radio"
                name="department"
                value={d.value}
                defaultChecked={selectedDepartment === d.value}
                required
                className="sr-only"
              />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">לקוח</label>
          <input
            name="client"
            defaultValue={project?.client ?? ""}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">אחראי</label>
          <select
            name="ownerId"
            defaultValue={project?.ownerId ?? ""}
            className={inputClass}
          >
            <option value="">ללא</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">כתובת</label>
          <input
            name="address"
            defaultValue={project?.address ?? ""}
            className={inputClass}
            placeholder="רחוב ומספר"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-brand-900">עיר</label>
          <input
            name="city"
            defaultValue={project?.city ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
