import { AlertCircle, Flag } from "lucide-react";
import { formatDateShort, formatMoney, isOverdue } from "@/lib/format";
import { stageStatusMeta } from "@/lib/stages";
import type { ProjectRow } from "@/lib/project-list";

/** Small pieces shared by the department table, cards and kanban. */

export function OwnerChip({ owner }: { owner: ProjectRow["owner"] }) {
  if (!owner) return <span className="text-black/35">ללא אחראי</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: owner.color }}
      >
        {owner.name.slice(0, 1)}
      </span>
      <span>{owner.name}</span>
    </span>
  );
}

export function CurrentStageText({ row }: { row: ProjectRow }) {
  if (row.stageCount === 0) return <span className="text-black/35">ללא שלבים</span>;
  if (!row.currentStage) {
    return <span className="font-medium text-green-700">כל השלבים הושלמו</span>;
  }
  const meta = stageStatusMeta(row.currentStage.status);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          row.currentStage.status === "IN_PROGRESS" ? "bg-blue-500" : "bg-slate-300"
        }`}
        title={meta.label}
      />
      <span className="truncate">{row.currentStage.title}</span>
      <span className="shrink-0 text-black/35">
        ({row.doneCount}/{row.stageCount})
      </span>
    </span>
  );
}

export function NextMilestoneText({ row }: { row: ProjectRow }) {
  const next = row.nextMilestone;
  if (!next) return <span className="text-black/35">—</span>;
  const overdue = isOverdue(next.dueDate);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Flag size={12} className="shrink-0 text-black/30" />
      <span className="truncate">{next.title}</span>
      {next.dueDate ? (
        <span
          className={`shrink-0 rounded px-1 ${
            overdue ? "bg-red-50 font-medium text-red-600" : "text-black/45"
          }`}
        >
          {overdue && <AlertCircle size={11} className="ml-0.5 inline" />}
          {formatDateShort(next.dueDate)}
        </span>
      ) : (
        <span className="shrink-0 text-black/30">ללא תאריך</span>
      )}
    </span>
  );
}

export function FeeText({ fee }: { fee: ProjectRow["fee"] }) {
  if (!fee || fee.total <= 0) return <span className="text-black/35">—</span>;
  const pct = Math.min(100, Math.round((fee.collected / fee.total) * 100));
  return (
    <span className="inline-flex flex-col gap-1">
      <span className="whitespace-nowrap">
        <span className="font-semibold">{formatMoney(fee.collected)}</span>
        <span className="text-black/40"> מתוך {formatMoney(fee.total)}</span>
      </span>
      <span className="h-1 w-24 overflow-hidden rounded-full bg-black/5" aria-hidden>
        <span className="block h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}
