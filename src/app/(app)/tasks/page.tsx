import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { TasksClient } from "@/components/tasks/tasks-client";
import { USER_OPTION_SELECT } from "@/lib/types";

export default async function TasksPage() {
  const user = await requireUser();

  const [tasks, users, projects] = await Promise.all([
    prisma.task.findMany({
      include: { assignee: { select: USER_OPTION_SELECT }, project: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({
      where: { role: "PARTNER" },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <TasksClient
      tasks={tasks}
      users={users}
      projects={projects}
      currentUserId={user.id}
    />
  );
}
