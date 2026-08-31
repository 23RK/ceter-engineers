import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { TasksClient } from "@/components/tasks/tasks-client";

export default async function TasksPage() {
  await requireUser();

  const [tasks, users, projects] = await Promise.all([
    prisma.task.findMany({
      include: { assignee: true, project: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <TasksClient tasks={tasks} users={users} projects={projects} />;
}
