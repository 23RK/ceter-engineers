import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/auth";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectMilestones } from "@/components/projects/project-milestones";
import { ProjectTasks } from "@/components/projects/project-tasks";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePartner();
  const { id } = await params;

  const [project, users, projects] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        milestones: true,
        tasks: { include: { assignee: true, project: true } },
      },
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

  if (!project) notFound();

  return (
    <div className="flex flex-col gap-5">
      <ProjectHeader project={project} />
      <ProjectMilestones projectId={project.id} milestones={project.milestones} />
      <ProjectTasks
        projectId={project.id}
        tasks={project.tasks}
        users={users}
        projects={projects}
      />
    </div>
  );
}
