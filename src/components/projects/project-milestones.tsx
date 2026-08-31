"use client";

import { useActionState } from "react";
import { Trash2, Flag } from "lucide-react";
import {
  createMilestone,
  deleteMilestone,
  toggleMilestone,
  type ActionState,
} from "@/lib/actions/projects";
import { formatDate, isOverdue } from "@/lib/format";
import type { Milestone } from "@prisma/client";

export function ProjectMilestones({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: Milestone[];
}) {
  const sorted = [...milestones].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Flag size={16} className="text-brand-600" />
        <h2 className="text-sm font-bold text-brand-900">
          ציר זמן ואבני דרך
        </h2>
      </div>

      {sorted.length === 0 ? (
        <p className="mb-4 text-sm text-black/40">אין עדיין אבני דרך.</p>
      ) : (
        <ol className="mb-5 flex flex-col gap-0.5">
          {sorted.map((m, i) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              isLast={i === sorted.length - 1}
            />
          ))}
        </ol>
      )}

      <MilestoneForm projectId={projectId} />
    </div>
  );
}

function MilestoneRow({
  milestone,
  isLast,
}: {
  milestone: Milestone;
  isLast: boolean;
}) {
  const overdue =
    !milestone.done && isOverdue(milestone.dueDate);

  return (
    <li className="relative flex gap-3 pb-5">
      {!isLast && (
        <span className="absolute right-[9px] top-5 h-full w-px bg-black/10" />
      )}
      <button
        onClick={() => toggleMilestone(milestone.id, !milestone.done)}
        className={`z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2 transition ${
          milestone.done
            ? "border-brand-600 bg-brand-600"
            : overdue
              ? "border-red-400"
              : "border-black/20 bg-white"
        }`}
      >
        {milestone.done && (
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
        )}
      </button>

      <div className="flex flex-1 items-center justify-between gap-2 pt-px">
        <div>
          <p
            className={`text-sm font-medium ${
              milestone.done
                ? "text-black/35 line-through"
                : "text-brand-900"
            }`}
          >
            {milestone.title}
          </p>
          {milestone.dueDate && (
            <p
              className={`text-xs ${overdue ? "font-medium text-red-500" : "text-black/40"}`}
            >
              {formatDate(milestone.dueDate)}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            if (confirm(`למחוק את אבן הדרך "${milestone.title}"?`)) {
              deleteMilestone(milestone.id);
            }
          }}
          className="rounded-md p-1.5 text-black/20 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}

const initialState: ActionState = {};

function MilestoneForm({ projectId }: { projectId: string }) {
  const action = createMilestone.bind(null, projectId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      key={state.ts ?? 0}
      action={formAction}
      className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-4"
    >
      <input
        name="title"
        required
        placeholder="אבן דרך חדשה, לדוגמה: יציקת יסודות"
        className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      />
      <input
        type="date"
        name="dueDate"
        dir="ltr"
        className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        הוספה
      </button>
      {state.error && (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}
