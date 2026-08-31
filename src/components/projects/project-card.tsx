import Link from "next/link";
import { Building2, MapPin, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { projectStatusMeta } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Project } from "@prisma/client";

export function ProjectCard({
  project,
  openTasks,
  totalTasks,
}: {
  project: Project;
  openTasks: number;
  totalTasks: number;
}) {
  const status = projectStatusMeta(project.status);
  const progress =
    totalTasks === 0 ? 0 : Math.round(((totalTasks - openTasks) / totalTasks) * 100);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Building2 size={17} />
          </div>
          <h3 className="text-sm font-bold leading-snug text-brand-900 group-hover:text-brand-600">
            {project.name}
          </h3>
        </div>
        <Badge className={status.badge}>{status.label}</Badge>
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-black/50">
        {project.client && <p>לקוח: {project.client}</p>}
        {project.address && (
          <p className="flex items-center gap-1">
            <MapPin size={12} />
            {project.address}
          </p>
        )}
        {project.endDate && (
          <p className="flex items-center gap-1">
            <Calendar size={12} />
            יעד לסיום: {formatDate(project.endDate)}
          </p>
        )}
      </div>

      {totalTasks > 0 && (
        <div className="mt-1">
          <div className="mb-1 flex items-center justify-between text-xs text-black/40">
            <span>התקדמות משימות</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}
