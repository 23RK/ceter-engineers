"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Lightbulb, Pencil, X } from "lucide-react";
import type { Department } from "@prisma/client";
import { renameProject, setProjectDepartment } from "@/lib/actions/projects";
import { DEPARTMENTS, departmentMeta } from "@/lib/departments";
import { useActionResult } from "@/components/ui/toast";
import { useSyncedState } from "@/lib/use-synced-state";

export type AssignRowProject = {
  id: string;
  name: string;
  client: string | null;
  address: string | null;
  department: Department | null;
  suggestion: Department | null;
  genericName: boolean;
};

/**
 * One project on the "שיוך מחלקות" screen: assign / change its department
 * and fix its name. Both update on screen immediately and roll back with a
 * message if saving fails (SPEC §1.1).
 */
export function DepartmentAssignRow({ project }: { project: AssignRowProject }) {
  const onResult = useActionResult();
  const [department, setDepartment] = useSyncedState(project.department);
  const [name, setName] = useSyncedState(project.name);
  const [draft, setDraft] = useSyncedState(project.name);
  const [editing, setEditing] = useState(project.genericName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function assign(next: Department) {
    if (next === department) return;
    const prev = department;
    setDepartment(next);
    setError(null);
    startTransition(async () => {
      try {
        const res = onResult(await setProjectDepartment(project.id, next));
        if (res.error) throw new Error(res.error);
      } catch {
        setDepartment(prev);
        setError("השיוך לא נשמר. נסו שוב.");
      }
    });
  }

  function saveName() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("יש להזין שם פרויקט");
      return;
    }
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    const prev = name;
    setName(trimmed);
    setEditing(false);
    setError(null);
    startTransition(async () => {
      try {
        const res = onResult(await renameProject(project.id, trimmed));
        if (res.error) throw new Error(res.error);
      } catch {
        setName(prev);
        setDraft(prev);
        setEditing(true);
        setError("השם לא נשמר. נסו שוב.");
      }
    });
  }

  const details = [project.client, project.address].filter(Boolean).join(" · ");
  const stillGeneric = project.genericName && name === project.name;

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveName();
            }}
            className="flex items-center gap-1.5"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="שם הפרויקט"
              placeholder="שם אמיתי, לדוגמה: בניין מגורים - הרצל 12"
              className="min-h-11 w-full min-w-0 rounded-lg border border-black/10 bg-white px-3 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
            <button
              type="submit"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-700"
              aria-label="שמירת שם"
            >
              <Check size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(name);
                setEditing(false);
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-black/40 transition hover:bg-black/5"
              aria-label="ביטול"
            >
              <X size={18} />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-1">
            <Link
              href={`/projects/${project.id}`}
              className="truncate text-sm font-bold text-brand-900 hover:text-brand-600"
            >
              {name}
            </Link>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 rounded-lg p-2 text-black/35 transition hover:bg-black/5 hover:text-brand-600"
              aria-label="שינוי שם"
              title="שינוי שם"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}

        {details && <p className="mt-0.5 truncate text-xs text-black/45">{details}</p>}

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {stillGeneric && (
            <span className="font-medium text-amber-700">
              השם הוא סוג הפרויקט. כדאי לתת לו שם אמיתי.
            </span>
          )}
          {!department && project.suggestion && (
            <span className="flex items-center gap-1 text-black/50">
              <Lightbulb size={12} className="text-amber-500" />
              הצעה: {departmentMeta(project.suggestion).short}
            </span>
          )}
          {error && <span className="font-medium text-red-600">{error}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div
          role="group"
          aria-label="מחלקה"
          className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-black/[0.04] p-1 sm:w-48 sm:flex-none"
        >
          {DEPARTMENTS.map((d) => {
            const active = department === d.value;
            const suggested = !department && project.suggestion === d.value;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => assign(d.value)}
                disabled={pending && active}
                aria-pressed={active}
                className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${
                  active
                    ? "bg-brand-600 text-white shadow-sm"
                    : suggested
                      ? "bg-white text-brand-700 ring-1 ring-brand-300"
                      : "text-black/55 hover:bg-white"
                }`}
              >
                {d.short}
              </button>
            );
          })}
        </div>
        <Link
          href={`/projects/${project.id}`}
          className="hidden rounded-lg p-2 text-black/30 transition hover:bg-black/5 hover:text-brand-600 sm:block"
          aria-label="לדף הפרויקט"
        >
          <ChevronLeft size={18} />
        </Link>
      </div>
    </li>
  );
}
