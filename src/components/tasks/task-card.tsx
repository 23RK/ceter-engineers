"use client";

import { Calendar, Trash2 } from "lucide-react";
import { deleteTask } from "@/lib/actions/tasks";
import { taskPriorityMeta } from "@/lib/constants";
import { formatDateShort, isOverdue } from "@/lib/format";
import type { ProjectOption, TaskWithRelations, UserOption } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { TaskForm } from "@/components/tasks/task-form";

export function TaskCard({
  task,
  users,
  projects,
}: {
  task: TaskWithRelations;
  users: UserOption[];
  projects: ProjectOption[];
}) {
  return (
    <Modal
      title="עריכת משימה"
      trigger={<TaskCardView task={task} />}
    >
      {(close) => (
        <TaskForm
          task={task}
          users={users}
          projects={projects}
          onClose={close}
        />
      )}
    </Modal>
  );
}

function TaskCardView({ task }: { task: TaskWithRelations }) {
  const priority = taskPriorityMeta(task.priority);
  const overdue = isOverdue(task.dueDate) && task.status !== "DONE";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group cursor-pointer rounded-xl border border-black/5 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-brand-900">
          {task.title}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`למחוק את המשימה "${task.title}"?`)) {
              deleteTask(task.id);
            }
          }}
          className="shrink-0 rounded-md p-1 text-black/20 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {task.project && (
        <p className="mt-1.5 truncate text-xs text-brand-500">
          {task.project.name}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
          <span className="text-xs text-black/50">{priority.label}</span>
        </div>

        {task.dueDate && (
          <span
            className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs ${
              overdue
                ? "bg-red-50 font-medium text-red-600"
                : "text-black/40"
            }`}
          >
            <Calendar size={11} />
            {formatDateShort(task.dueDate)}
          </span>
        )}
      </div>

      {task.assignee && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-black/5 pt-2.5">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: task.assignee.color }}
          >
            {task.assignee.name.slice(0, 1)}
          </span>
          <span className="text-xs text-black/50">
            {task.assignee.name}
          </span>
        </div>
      )}
    </div>
  );
}
