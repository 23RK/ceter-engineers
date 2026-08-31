"use client";

import { Plus, ListChecks } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskCard } from "@/components/tasks/task-card";
import type { ProjectOption, TaskWithRelations, UserOption } from "@/lib/types";

export function ProjectTasks({
  projectId,
  tasks,
  users,
  projects,
}: {
  projectId: string;
  tasks: TaskWithRelations[];
  users: UserOption[];
  projects: ProjectOption[];
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks size={16} className="text-brand-600" />
          <h2 className="text-sm font-bold text-brand-900">
            משימות הפרויקט ({tasks.length})
          </h2>
        </div>
        <Modal
          title="משימה חדשה"
          trigger={
            <button className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-900 transition hover:bg-black/5">
              <Plus size={14} />
              הוספת משימה
            </button>
          }
        >
          {(close) => (
            <TaskForm
              users={users}
              projects={projects}
              defaultProjectId={projectId}
              onClose={close}
            />
          )}
        </Modal>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-black/40">אין עדיין משימות בפרויקט זה.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} users={users} projects={projects} />
          ))}
        </div>
      )}
    </div>
  );
}
