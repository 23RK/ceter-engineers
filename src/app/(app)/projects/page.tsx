import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ProjectCard } from "@/components/projects/project-card";
import { NewProjectButton } from "@/components/projects/new-project-button";

export default async function ProjectsPage() {
  await requireUser();

  const projects = await prisma.project.findMany({
    include: {
      tasks: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">פרויקטים</h1>
          <p className="text-sm text-black/50">
            מעקב אחר כל פרויקטי הבנייה והפיקוח
          </p>
        </div>
        <NewProjectButton />
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 py-16 text-center text-sm text-black/40">
          עדיין אין פרויקטים. לחצו על &quot;פרויקט חדש&quot; כדי להתחיל.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const totalTasks = project.tasks.length;
            const openTasks = project.tasks.filter(
              (t) => t.status !== "DONE"
            ).length;
            return (
              <ProjectCard
                key={project.id}
                project={project}
                totalTasks={totalTasks}
                openTasks={openTasks}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
