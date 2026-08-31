"use client";

import { useMemo, useState, useTransition } from "react";
import { useOptimistic } from "react";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { KanbanColumn } from "@/components/tasks/kanban-column";
import { Modal } from "@/components/ui/modal";
import { TaskForm } from "@/components/tasks/task-form";
import { setTaskStatus } from "@/lib/actions/tasks";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { ProjectOption, TaskWithRelations, UserOption } from "@/lib/types";

export function TasksClient({
  tasks,
  users,
  projects,
}: {
  tasks: TaskWithRelations[];
  users: UserOption[];
  projects: ProjectOption[];
}) {
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "">("");
  const [, startTransition] = useTransition();

  const [optimisticTasks, moveTask] = useOptimistic(
    tasks,
    (state, { taskId, status }: { taskId: string; status: TaskStatus }) =>
      state.map((t) => (t.id === taskId ? { ...t, status } : t))
  );

  const filtered = useMemo(() => {
    return optimisticTasks.filter((t) => {
      if (assigneeFilter && t.assigneeId !== assigneeFilter) return false;
      if (projectFilter && t.projectId !== projectFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [optimisticTasks, assigneeFilter, projectFilter, priorityFilter]);

  function handleDrop(taskId: string, status: TaskStatus) {
    startTransition(async () => {
      moveTask({ taskId, status });
      await setTaskStatus(taskId, status);
    });
  }

  const selectClass =
    "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">משימות</h1>
          <p className="text-sm text-black/50">
            לוח המשימות המשותף של השותפים
          </p>
        </div>

        <Modal
          title="משימה חדשה"
          trigger={
            <button className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
              <Plus size={16} />
              משימה חדשה
            </button>
          }
        >
          {(close) => (
            <TaskForm users={users} projects={projects} onClose={close} />
          )}
        </Modal>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">כל האחראים</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">כל הפרויקטים</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as TaskPriority | "")
          }
          className={selectClass}
        >
          <option value="">כל העדיפויות</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {(assigneeFilter || projectFilter || priorityFilter) && (
          <button
            onClick={() => {
              setAssigneeFilter("");
              setProjectFilter("");
              setPriorityFilter("");
            }}
            className="rounded-lg px-3 py-2 text-sm text-brand-600 hover:underline"
          >
            נקה סינון
          </button>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {TASK_STATUSES.map((s) => (
          <KanbanColumn
            key={s.value}
            status={s.value}
            label={s.label}
            badgeClass={s.badge}
            tasks={filtered.filter((t) => t.status === s.value)}
            users={users}
            projects={projects}
            onDropTask={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}
