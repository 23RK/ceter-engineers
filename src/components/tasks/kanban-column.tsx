"use client";

import { useState } from "react";
import type { TaskStatus } from "@prisma/client";
import { TaskCard } from "@/components/tasks/task-card";
import type { ProjectOption, TaskWithRelations, UserOption } from "@/lib/types";

export function KanbanColumn({
  status,
  label,
  badgeClass,
  tasks,
  users,
  projects,
  onDropTask,
}: {
  status: TaskStatus;
  label: string;
  badgeClass: string;
  tasks: TaskWithRelations[];
  users: UserOption[];
  projects: ProjectOption[];
  onDropTask: (taskId: string, status: TaskStatus) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const taskId = e.dataTransfer.getData("text/plain");
        if (taskId) onDropTask(taskId, status);
      }}
      className={`flex min-w-[260px] flex-1 flex-col rounded-2xl border p-3 transition ${
        dragOver
          ? "border-brand-400 bg-brand-50"
          : "border-black/5 bg-black/[0.02]"
      }`}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
          {label}
        </span>
        <span className="text-xs font-medium text-black/30">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} users={users} projects={projects} />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-black/10 py-8 text-center text-xs text-black/30">
            אין משימות
          </div>
        )}
      </div>
    </div>
  );
}
