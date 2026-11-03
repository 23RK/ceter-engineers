"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createProject,
  updateProject,
  type ActionState,
} from "@/lib/actions/projects";
import { PROJECT_STATUSES } from "@/lib/constants";
import { DEPARTMENTS } from "@/lib/departments";
import { formatDateShort, toDateInputValue } from "@/lib/format";
import { spreadDueDates } from "@/lib/stages";
import type { Department, Project } from "@prisma/client";
import type { UserOption } from "@/lib/types";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function ProjectForm({
  project,
  users,
  defaultDepartment,
  templates = [],
  onClose,
}: {
  project?: Project;
  /** The partners, for "אחראי". */
  users: UserOption[];
  /** Pre-selected when creating from a department screen. */
  defaultDepartment?: Department;
  /** Stage templates (new projects): to plan the stage dates up front. */
  templates?: { department: Department; title: string }[];
  onClose: () => void;
}) {
  const selectedDepartment = project?.department ?? defaultDepartment;
  // New project: the department and dates decide the proposed stage dates.
  const [dept, setDept] = useState<Department | undefined>(selectedDepartment);
  const [start, setStart] = useState(toDateInputValue(project?.startDate));
  const [end, setEnd] = useState(toDateInputValue(project?.endDate));
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
                onChange={() => setDept(d.value)}
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
            onChange={(e) => setStart(e.target.value)}
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
            onChange={(e) => setEnd(e.target.value)}
            className={inputClass}
            dir="ltr"
          />
        </div>
      </div>

      {!project && (
        <StageDatesPlanner
          titles={templates.filter((t) => t.department === dept).map((t) => t.title)}
          start={start}
          end={end}
        />
      )}

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

/**
 * New project with a start and end date: propose planned dates for the
 * template stages, spread evenly, each one editable (or none at all).
 */
function StageDatesPlanner({ titles, start, end }: { titles: string[]; start: string; end: string }) {
  const spread = spreadDueDates(start, end, titles.length);
  const key = `${start}|${end}|${titles.length}`;
  const [use, setUse] = useState(true);
  const [open, setOpen] = useState(false);
  // Edits belong to one start/end/stages combination; changing those re-proposes.
  const [edits, setEdits] = useState<{ key: string; dates: Record<number, string> }>({ key, dates: {} });
  const dates = edits.key === key ? edits.dates : {};
  if (titles.length === 0 || spread.length === 0) return null;

  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-black/10 p-3">
      <legend className="px-1 text-sm font-medium text-brand-900">תאריכים מתוכננים לשלבים</legend>
      <label className="flex items-start gap-2 text-sm text-brand-900">
        <input type="checkbox" checked={use} onChange={(e) => setUse(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
        <span>
          לפזר תאריכים באופן שווה בין ההתחלה לסיום ({titles.length} שלבים, מ-{formatDateShort(spread[0])} עד {formatDateShort(spread.at(-1))})
        </span>
      </label>
      {use && (
        <>
          <button type="button" onClick={() => setOpen((o) => !o)} className="self-start text-xs font-medium text-brand-600 hover:underline">
            {open ? "הסתרת התאריכים" : "הצגה ועריכה של התאריכים"}
          </button>
          <ol className={`flex flex-col gap-1 ${open ? "" : "hidden"}`}>
            {titles.map((title, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-5 shrink-0 text-xs text-black/40">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-brand-900">{title}</span>
                <input
                  type="date"
                  name="stageDue"
                  value={dates[i] ?? spread[i]}
                  onChange={(e) => setEdits({ key, dates: { ...dates, [i]: e.target.value } })}
                  aria-label={`תאריך מתוכנן: ${title}`}
                  className="min-h-9 rounded-lg border border-black/10 px-2 text-sm outline-none focus:border-brand-500"
                />
              </li>
            ))}
          </ol>
        </>
      )}
    </fieldset>
  );
}
