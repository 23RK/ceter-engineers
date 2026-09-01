import Link from "next/link";
import { Handshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { leadStatusMeta } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Lead } from "@prisma/client";

export function LeadCard({
  lead,
  openTasks,
  totalTasks,
}: {
  lead: Lead;
  openTasks: number;
  totalTasks: number;
}) {
  const status = leadStatusMeta(lead.status);
  const progress =
    totalTasks === 0
      ? 0
      : Math.round(((totalTasks - openTasks) / totalTasks) * 100);

  return (
    <Link
      href={`/business-dev/${lead.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Handshake size={17} />
          </div>
          <h3 className="text-sm font-bold leading-snug text-brand-900 group-hover:text-brand-600">
            {lead.name}
          </h3>
        </div>
        <Badge className={status.badge}>{status.label}</Badge>
      </div>

      {lead.notes && (
        <p className="line-clamp-2 text-xs text-black/50">{lead.notes}</p>
      )}

      <p className="text-xs text-black/35">
        עודכן לאחרונה: {formatDate(lead.updatedAt)}
      </p>

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
