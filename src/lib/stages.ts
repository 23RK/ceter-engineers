import type { StageStatus } from "@prisma/client";

export const STAGE_STATUSES: {
  value: StageStatus;
  label: string;
  badge: string;
}[] = [
  { value: "NOT_STARTED", label: "לא התחיל", badge: "bg-slate-100 text-slate-600" },
  { value: "IN_PROGRESS", label: "בביצוע", badge: "bg-blue-100 text-blue-700" },
  { value: "DONE", label: "הושלם", badge: "bg-green-100 text-green-700" },
];

export function stageStatusMeta(status: StageStatus) {
  return STAGE_STATUSES.find((s) => s.value === status)!;
}

export function isStageStatus(value: unknown): value is StageStatus {
  return STAGE_STATUSES.some((s) => s.value === value);
}

type StageLike = {
  id: string;
  status: StageStatus;
  order: number;
  dueDate?: Date | string | null;
};

export function sortStages<T extends { order: number; createdAt?: Date | string }>(
  stages: T[]
) {
  return [...stages].sort(
    (a, b) =>
      a.order - b.order ||
      new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
  );
}

/** Where the project is: the first stage in progress, else the first not done. */
export function currentStage<T extends StageLike>(stages: T[]): T | null {
  const sorted = sortStages(stages);
  return (
    sorted.find((s) => s.status === "IN_PROGRESS") ??
    sorted.find((s) => s.status !== "DONE") ??
    null
  );
}

/** אבן הדרך הבאה: the first stage (by order) that isn't done yet. */
export function nextMilestone<T extends StageLike>(stages: T[]): T | null {
  return sortStages(stages).find((s) => s.status !== "DONE") ?? null;
}

/**
 * The status changes caused by setting one stage's status.
 *
 * Marking a stage "הושלם" also starts the stage after it: the next stage in
 * order that isn't done moves to "בביצוע" - but only if it hasn't started
 * (one already in progress is left alone). Any other change, including
 * un-completing a stage, touches only that stage.
 */
export function statusChanges(
  stages: StageLike[],
  stageId: string,
  status: StageStatus
): { id: string; status: StageStatus }[] {
  const sorted = sortStages(stages);
  const index = sorted.findIndex((s) => s.id === stageId);
  if (index === -1) return [];

  const changes = [{ id: stageId, status }];
  if (status === "DONE" && sorted[index].status !== "DONE") {
    const next = sorted.slice(index + 1).find((s) => s.status !== "DONE");
    if (next?.status === "NOT_STARTED") {
      changes.push({ id: next.id, status: "IN_PROGRESS" });
    }
  }
  return changes;
}

/** SPEC §3.4 validation: a stage planned before the project starts. */
export function isBeforeProjectStart(
  dueDate: Date | string | null | undefined,
  projectStart: Date | string | null | undefined
) {
  if (!dueDate || !projectStart) return false;
  return new Date(dueDate).getTime() < new Date(projectStart).getTime();
}

/** Template stage titles the project doesn't have yet (so adding never duplicates). */
export function missingTemplateTitles(
  templateTitles: string[],
  stageTitles: string[]
) {
  const have = new Set(stageTitles.map((t) => t.trim()));
  return templateTitles.filter((t) => !have.has(t.trim()));
}
