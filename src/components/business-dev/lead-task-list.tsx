"use client";

import { useActionState } from "react";
import { CalendarPlus, ListChecks, Trash2 } from "lucide-react";
import {
  createLeadTask,
  deleteLeadTask,
  setLeadTaskStatus,
  type ActionState,
} from "@/lib/actions/leads";
import { Modal } from "@/components/ui/modal";
import { MeetingForm } from "@/components/calendar/meeting-form";
import { TASK_STATUSES } from "@/lib/constants";
import { formatDate, formatDateShort, isOverdue } from "@/lib/format";
import type { LeadTask, Meeting, TaskStatus } from "@prisma/client";

type LeadTaskWithMeeting = LeadTask & { meeting: Meeting | null };

export function LeadTaskList({
  leadId,
  tasks,
}: {
  leadId: string;
  tasks: LeadTaskWithMeeting[];
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ListChecks size={16} className="text-brand-600" />
        <h2 className="text-sm font-bold text-brand-900">
          משימות ({tasks.length})
        </h2>
      </div>

      {tasks.length === 0 ? (
        <p className="mb-4 text-sm text-black/40">אין עדיין משימות.</p>
      ) : (
        <div className="mb-5 flex flex-col divide-y divide-black/5">
          {tasks.map((task) => (
            <LeadTaskRow key={task.id} task={task} />
          ))}
        </div>
      )}

      <LeadTaskForm leadId={leadId} />
    </div>
  );
}

function LeadTaskRow({ task }: { task: LeadTaskWithMeeting }) {
  const overdue = isOverdue(task.dueDate) && task.status !== "DONE";

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p
          className={`truncate text-sm font-medium ${
            task.status === "DONE"
              ? "text-black/35 line-through"
              : "text-brand-900"
          }`}
        >
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 text-xs">
          {task.dueDate && (
            <span
              className={overdue ? "font-medium text-red-500" : "text-black/40"}
            >
              יעד: {formatDateShort(task.dueDate)}
            </span>
          )}
          {task.meeting ? (
            <span className="text-brand-600">
              נקבעה פגישה: {formatDate(task.meeting.startTime)}
            </span>
          ) : (
            <Modal
              title="קביעת פגישה"
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-1 text-black/35 transition hover:text-brand-600"
                >
                  <CalendarPlus size={12} />
                  קביעת פגישה
                </button>
              }
            >
              {(close) => {
                const base = task.dueDate
                  ? new Date(task.dueDate)
                  : new Date();
                const defaultStart = new Date(base);
                defaultStart.setHours(9, 0, 0, 0);
                const defaultEnd = new Date(base);
                defaultEnd.setHours(10, 0, 0, 0);
                return (
                  <MeetingForm
                    forLeadTaskId={task.id}
                    defaultTitle={task.title}
                    defaultStart={defaultStart}
                    defaultEnd={defaultEnd}
                    onClose={close}
                  />
                );
              }}
            </Modal>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <select
          value={task.status}
          onChange={(e) =>
            setLeadTaskStatus(task.id, e.target.value as TaskStatus)
          }
          className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs shadow-sm outline-none focus:border-brand-500"
        >
          {TASK_STATUSES.filter((s) => s.value !== "REVIEW").map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            if (confirm(`למחוק את המשימה "${task.title}"?`)) {
              deleteLeadTask(task.id);
            }
          }}
          className="rounded-md p-1.5 text-black/20 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

const initialState: ActionState = {};

function LeadTaskForm({ leadId }: { leadId: string }) {
  const action = createLeadTask.bind(null, leadId);
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
        placeholder="משימה חדשה, לדוגמה: קביעת פגישה עם אדריכלים"
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
