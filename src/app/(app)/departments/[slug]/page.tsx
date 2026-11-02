import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { departmentBySlug } from "@/lib/departments";
import { ProjectCard } from "@/components/projects/project-card";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { UnassignedProjectsBanner } from "@/components/projects/unassigned-banner";

// Part A: the department's projects with the existing cards. The full screen
// (table / cards / kanban, filters, archive) comes in stage 2 part B.
export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser();
  const { slug } = await params;
  const department = departmentBySlug(slug);
  if (!department) notFound();

  const [projects, unassignedCount, users] = await Promise.all([
    prisma.project.findMany({
      where: { department: department.value },
      include: { tasks: { select: { status: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.count({ where: { department: null } }),
    prisma.user.findMany({
      where: { role: "PARTNER" },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">
            {department.label}
          </h1>
          <p className="text-sm text-black/50">
            {projects.length === 1
              ? "פרויקט אחד"
              : `${projects.length} פרויקטים`}
          </p>
        </div>
        <NewProjectButton department={department.value} users={users} />
      </div>

      <UnassignedProjectsBanner count={unassignedCount} />

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 py-16 text-center text-sm text-black/40">
          עדיין אין פרויקטים במחלקה. לחצו על &quot;פרויקט חדש&quot; כדי להתחיל.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              totalTasks={project.tasks.length}
              openTasks={project.tasks.filter((t) => t.status !== "DONE").length}
            />
          ))}
        </div>
      )}
    </div>
  );
}
