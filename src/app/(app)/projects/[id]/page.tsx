import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { departmentHref, departmentMeta } from "@/lib/departments";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectStages } from "@/components/projects/project-stages";
import { missingTemplateTitles } from "@/lib/stages";
import { ProjectTasks } from "@/components/projects/project-tasks";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [project, users, projects, templates] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        milestones: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
        owner: { select: { id: true, name: true, color: true } },
        tasks: { include: { assignee: true, project: true } },
      },
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
    // Both departments' templates (tiny) - so this runs in parallel with the
    // project query instead of waiting for its department.
    prisma.stageTemplate.findMany({
      select: { department: true, title: true },
      orderBy: { order: "asc" },
    }),
  ]);

  if (!project) notFound();

  const missingTemplateCount = project.department
    ? missingTemplateTitles(
        templates
          .filter((t) => t.department === project.department)
          .map((t) => t.title),
        project.milestones.map((m) => m.title)
      ).length
    : 0;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={departmentHref(project.department)}
        className="-mb-2 flex w-fit items-center gap-1 rounded-lg py-1 text-sm font-medium text-black/50 transition hover:text-brand-600"
      >
        <ChevronRight size={16} />
        {project.department
          ? departmentMeta(project.department).label
          : "שיוך מחלקות"}
      </Link>
      <ProjectHeader project={project} users={users} />
      <ProjectStages
        projectId={project.id}
        hasDepartment={!!project.department}
        projectStart={project.startDate}
        stages={project.milestones}
        missingTemplateCount={missingTemplateCount}
      />
      <ProjectTasks
        projectId={project.id}
        tasks={project.tasks}
        users={users}
        projects={projects}
      />
    </div>
  );
}
