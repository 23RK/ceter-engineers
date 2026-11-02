"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Flag,
  LayoutList,
  Plus,
  Trash2,
} from "lucide-react";
import type { Milestone, StageStatus } from "@prisma/client";
import {
  addTemplateStages,
  createStage,
  deleteStage,
  moveStage,
  setStageStatus,
  updateStage,
} from "@/lib/actions/stages";
import type { ActionState } from "@/lib/actions/tasks";
import {
  STAGE_STATUSES,
  currentStage,
  isBeforeProjectStart,
  sortStages,
  stageStatusMeta,
  statusChanges,
} from "@/lib/stages";
import { formatDateShort, isOverdue, toDateInputValue } from "@/lib/format";

type Stage = Pick<
  Milestone,
  "id" | "title" | "status" | "dueDate" | "completedAt" | "order" | "createdAt"
>;

type Change =
  | { type: "status"; id: string; status: StageStatus }
  | { type: "update"; id: string; fields: Partial<Pick<Stage, "title" | "dueDate" | "completedAt">> }
  | { type: "move"; id: string; direction: "up" | "down" }
  | { type: "delete"; id: string }
  | { type: "add"; stage: Stage };

const localToday = () => new Date(toDateInputValue(new Date()));
const fromInput = (value: string) => (value ? new Date(value) : null);

/** The same rules as the server actions, applied instantly on screen. */
function applyChange(stages: Stage[], change: Change): Stage[] {
  switch (change.type) {
    case "status": {
      const changes = statusChanges(stages, change.id, change.status);
      return stages.map((s) => {
        const c = changes.find((x) => x.id === s.id);
        if (!c) return s;
        if (s.id !== change.id) return { ...s, status: c.status };
        return {
          ...s,
          status: c.status,
          completedAt: c.status === "DONE" ? (s.completedAt ?? localToday()) : null,
        };
      });
    }
    case "update":
      return stages.map((s) => (s.id === change.id ? { ...s, ...change.fields } : s));
    case "move": {
      const sorted = sortStages(stages);
      const from = sorted.findIndex((s) => s.id === change.id);
      const to = change.direction === "up" ? from - 1 : from + 1;
      if (from === -1 || to < 0 || to >= sorted.length) return stages;
      [sorted[from], sorted[to]] = [sorted[to], sorted[from]];
      return sorted.map((s, order) => ({ ...s, order }));
    }
    case "delete":
      return stages.filter((s) => s.id !== change.id);
    case "add":
      return [...stages, change.stage];
  }
}

export function ProjectStages({
  projectId,
  hasDepartment,
  projectStart,
  stages: serverStages,
  missingTemplateCount,
}: {
  projectId: string;
  hasDepartment: boolean;
  projectStart: Date | null;
  stages: Stage[];
  /** Template stages this project doesn't have yet. */
  missingTemplateCount: number;
}) {
  const [stages, apply] = useOptimistic(serverStages, applyChange);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /** Show the change now; if saving fails it rolls back by itself, with a message. */
  function run(change: Change | null, save: () => Promise<ActionState>) {
    setError(null);
    startTransition(async () => {
      if (change) apply(change);
      try {
        const res = await save();
        if (res.error) setError(res.error);
      } catch {
        setError("השינוי לא נשמר. נסו שוב.");
      }
    });
  }

  const sorted = sortStages(stages);
  const current = currentStage(sorted);
  const doneCount = sorted.filter((s) => s.status === "DONE").length;

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flag size={16} className="text-brand-600" />
          <h2 className="text-sm font-bold text-brand-900">שלבים ואבני דרך</h2>
        </div>
        {sorted.length > 0 && (
          <span className="text-xs font-medium text-black/45">
            {doneCount} מתוך {sorted.length} הושלמו
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="mb-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-black/10 px-4 py-6 text-center">
          <p className="text-sm text-black/45">אין עדיין שלבים בפרויקט.</p>
          {hasDepartment ? (
            missingTemplateCount > 0 && (
              <button
                type="button"
                onClick={() => run(null, () => addTemplateStages(projectId))}
                className="flex min-h-11 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                <LayoutList size={16} />
                הוספת שלבי התבנית ({missingTemplateCount})
              </button>
            )
          ) : (
            <p className="text-xs text-black/40">
              שייכו את הפרויקט למחלקה כדי להוסיף את שלבי התבנית שלה.
            </p>
          )}
        </div>
      ) : (
        <ol className="mb-4 flex flex-col">
          {sorted.map((stage, i) => (
            <StageRow
              key={stage.id}
              stage={stage}
              isCurrent={stage.id === current?.id}
              isFirst={i === 0}
              isLast={i === sorted.length - 1}
              projectStart={projectStart}
              run={run}
            />
          ))}
        </ol>
      )}

      {sorted.length > 0 && hasDepartment && missingTemplateCount > 0 && (
        <button
          type="button"
          onClick={() => run(null, () => addTemplateStages(projectId))}
          className="mb-3 flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-brand-600 hover:underline"
        >
          <LayoutList size={15} />
          הוספת {missingTemplateCount} שלבים חסרים מהתבנית
        </button>
      )}

      <AddStageForm projectId={projectId} run={run} />
    </section>
  );
}

function StageRow({
  stage,
  isCurrent,
  isFirst,
  isLast,
  projectStart,
  run,
}: {
  stage: Stage;
  isCurrent: boolean;
  isFirst: boolean;
  isLast: boolean;
  projectStart: Date | null;
  run: (change: Change | null, save: () => Promise<ActionState>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stage.title);
  // Just added, not saved yet: it has no real id to act on.
  const saving = stage.id.startsWith("new-");
  const done = stage.status === "DONE";
  const overdue = !done && isOverdue(stage.dueDate);
  const beforeStart = isBeforeProjectStart(stage.dueDate, projectStart);
  const meta = stageStatusMeta(stage.status);

  const setStatus = (status: StageStatus) =>
    run({ type: "status", id: stage.id, status }, () => setStageStatus(stage.id, status));

  function saveTitle() {
    const title = draft.trim();
    setEditing(false);
    if (!title || title === stage.title) {
      setDraft(stage.title);
      return;
    }
    run({ type: "update", id: stage.id, fields: { title } }, () =>
      updateStage(stage.id, { title })
    );
  }

  const iconButton =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-black/35 transition hover:bg-black/5 hover:text-brand-700 disabled:opacity-25 disabled:hover:bg-transparent";

  return (
    <li
      className={`relative flex gap-2 sm:gap-3 ${saving ? "pointer-events-none opacity-60" : ""}`}
      aria-busy={saving || undefined}
    >
      {!isLast && (
        <span
          aria-hidden
          className={`absolute right-[21px] top-11 bottom-0 w-px ${done ? "bg-brand-300" : "bg-black/10"}`}
        />
      )}

      {/* The circle: one tap marks the stage done (and saves the actual date). */}
      <button
        type="button"
        onClick={() => setStatus(done ? "IN_PROGRESS" : "DONE")}
        aria-label={done ? `ביטול השלמת "${stage.title}"` : `סימון "${stage.title}" כהושלם`}
        title={done ? "ביטול ההשלמה" : "סימון כהושלם"}
        className="z-10 flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${
            done
              ? "border-brand-600 bg-brand-600 text-white"
              : stage.status === "IN_PROGRESS"
                ? "border-blue-500 bg-white ring-4 ring-blue-500/15"
                : overdue
                  ? "border-red-400 bg-white"
                  : "border-black/20 bg-white hover:border-brand-500"
          }`}
        >
          {done && <Check size={14} strokeWidth={3} />}
          {stage.status === "IN_PROGRESS" && (
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          )}
        </span>
      </button>

      <div
        className={`min-w-0 flex-1 border-b border-black/5 pb-3 pt-1 lg:pb-1.5 ${isLast ? "border-b-0" : ""}`}
      >
        {/* Phones: title + actions, then the status/dates line below.
            Wide screens: everything on one line. */}
        <div className="flex flex-wrap items-start gap-x-1 lg:flex-nowrap lg:items-center lg:gap-x-3">
          <div className="order-1 min-w-0 flex-1 pt-1.5 lg:pt-0">
            {editing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setDraft(stage.title);
                    setEditing(false);
                  }
                }}
                aria-label="שם השלב"
                className="w-full rounded-lg border border-brand-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraft(stage.title);
                  setEditing(true);
                }}
                title="לחצו לשינוי שם"
                className={`text-right text-sm leading-snug ${
                  done
                    ? "text-black/40 line-through"
                    : isCurrent
                      ? "font-bold text-brand-900"
                      : "font-medium text-brand-900"
                }`}
              >
                {stage.title}
              </button>
            )}
            {isCurrent && !editing && (
              <span className="mr-2 inline-block rounded-full bg-brand-50 px-2 py-0.5 align-middle text-[11px] font-semibold text-brand-700">
                שלב נוכחי
              </span>
            )}
          </div>

          <div className="order-2 flex shrink-0 lg:order-3">
            <button
              type="button"
              disabled={isFirst}
              onClick={() =>
                run({ type: "move", id: stage.id, direction: "up" }, () =>
                  moveStage(stage.id, "up")
                )
              }
              className={iconButton}
              aria-label="הזזה למעלה"
            >
              <ChevronUp size={17} />
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={() =>
                run({ type: "move", id: stage.id, direction: "down" }, () =>
                  moveStage(stage.id, "down")
                )
              }
              className={iconButton}
              aria-label="הזזה למטה"
            >
              <ChevronDown size={17} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`למחוק את השלב "${stage.title}"?`)) {
                  run({ type: "delete", id: stage.id }, () => deleteStage(stage.id));
                }
              }}
              className={`${iconButton} hover:bg-red-50 hover:text-red-600`}
              aria-label="מחיקת שלב"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div className="order-3 mt-1 flex w-full flex-wrap items-center gap-x-3 gap-y-2 text-xs lg:order-2 lg:mt-0 lg:w-auto lg:flex-nowrap">
          <select
            value={stage.status}
            onChange={(e) => setStatus(e.target.value as StageStatus)}
            aria-label="סטטוס השלב"
            className={`min-h-8 cursor-pointer rounded-full border-0 py-1 pr-2.5 pl-6 text-xs font-medium outline-none focus:ring-2 focus:ring-brand-500/30 ${meta.badge}`}
          >
            {STAGE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <DateField
            label="מתוכנן"
            value={stage.dueDate}
            tone={overdue ? "danger" : "default"}
            onChange={(value) =>
              run(
                { type: "update", id: stage.id, fields: { dueDate: fromInput(value) } },
                () => updateStage(stage.id, { dueDate: value })
              )
            }
          />

          {(done || stage.completedAt) && (
            <DateField
              label="בפועל"
              value={stage.completedAt}
              onChange={(value) =>
                run(
                  { type: "update", id: stage.id, fields: { completedAt: fromInput(value) } },
                  () => updateStage(stage.id, { completedAt: value })
                )
              }
            />
          )}
          </div>
        </div>

        {beforeStart && (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-700">
            <AlertTriangle size={13} />
            מתוכנן לפני תחילת הפרויקט ({formatDateShort(projectStart)})
          </p>
        )}
      </div>
    </li>
  );
}

function DateField({
  label,
  value,
  tone = "default",
  onChange,
}: {
  label: string;
  value: Date | string | null;
  tone?: "default" | "danger";
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-black/45">
      {label}
      <input
        type="date"
        dir="ltr"
        value={toDateInputValue(value)}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-8 rounded-md border border-black/10 bg-white px-1.5 py-1 text-xs outline-none focus:border-brand-500 ${
          tone === "danger" ? "font-medium text-red-600" : "text-brand-900"
        }`}
      />
    </label>
  );
}

function AddStageForm({
  projectId,
  run,
}: {
  projectId: string;
  run: (change: Change | null, save: () => Promise<ActionState>) => void;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) return;
        const now = new Date();
        run(
          {
            type: "add",
            stage: {
              id: `new-${now.getTime()}`,
              title: trimmed,
              status: "NOT_STARTED",
              dueDate: fromInput(dueDate),
              completedAt: null,
              order: Number.MAX_SAFE_INTEGER,
              createdAt: now,
            },
          },
          () => createStage(projectId, trimmed, dueDate)
        );
        setTitle("");
        setDueDate("");
      }}
      className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-4"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        placeholder="שלב חדש"
        aria-label="שם השלב החדש"
        className="min-h-11 min-w-0 flex-1 basis-40 rounded-lg border border-black/10 bg-white px-3 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      />
      <input
        type="date"
        dir="ltr"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        aria-label="תאריך מתוכנן"
        className="min-h-11 rounded-lg border border-black/10 bg-white px-3 text-sm shadow-sm outline-none focus:border-brand-500"
      />
      <button
        type="submit"
        className="flex min-h-11 items-center gap-1 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        <Plus size={16} />
        הוספה
      </button>
    </form>
  );
}
