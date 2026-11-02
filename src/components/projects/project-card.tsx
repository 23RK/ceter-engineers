import Link from "next/link";
import { Archive, Building2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { projectStatusMeta } from "@/lib/constants";
import type { ProjectRow } from "@/lib/project-list";
import {
  CurrentStageText,
  FeeText,
  NextMilestoneText,
  OwnerChip,
} from "@/components/projects/project-bits";

/** A project on the department screen (SPEC §3.2) - no task progress bar. */
export function ProjectCard({
  row,
  compact = false,
}: {
  row: ProjectRow;
  /** Kanban: the stage is the column, so it isn't repeated. */
  compact?: boolean;
}) {
  const status = projectStatusMeta(row.status);

  return (
    <Link
      href={`/projects/${row.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          {!compact && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Building2 size={17} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-snug text-brand-900 group-hover:text-brand-600">
              {row.name}
            </h3>
            {(row.client || row.city) && (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-black/50">
                {row.client && <span>{row.client}</span>}
                {row.city && (
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin size={11} />
                    {row.city}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge className={status.badge}>{status.label}</Badge>
          {row.archivedAt && (
            <span className="inline-flex items-center gap-1 text-[11px] text-black/40">
              <Archive size={11} />
              בארכיון
            </span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs text-brand-900">
        {!compact && (
          <>
            <dt className="text-black/40">שלב נוכחי</dt>
            <dd className="min-w-0">
              <CurrentStageText row={row} />
            </dd>
          </>
        )}
        <dt className="text-black/40">אבן דרך הבאה</dt>
        <dd className="min-w-0">
          <NextMilestoneText row={row} />
        </dd>
        <dt className="text-black/40">שכר טרחה</dt>
        <dd>
          <FeeText fee={row.fee} />
        </dd>
        <dt className="text-black/40">אחראי</dt>
        <dd>
          <OwnerChip owner={row.owner} />
        </dd>
      </dl>
    </Link>
  );
}
