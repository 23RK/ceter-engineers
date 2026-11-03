import type { ProjectStatus, StageStatus } from "@prisma/client";
import { PROJECT_STATUSES } from "@/lib/constants";
import { currentStage, nextMilestone } from "@/lib/stages";

/**
 * One project as the department screen shows it (SPEC §3.2). Built on the
 * server from the project + its stages, so the client gets only what it shows.
 */
export type ProjectRow = {
  id: string;
  name: string;
  client: string | null;
  city: string | null;
  status: ProjectStatus;
  archivedAt: Date | null;
  createdAt: Date;
  owner: { id: string; name: string; color: string } | null;
  currentStage: { title: string; status: StageStatus } | null;
  stageCount: number;
  doneCount: number;
  nextMilestone: { title: string; dueDate: Date | null } | null;
  /** שכר טרחה: collected out of the total, or null when no fee is set. */
  fee: { collected: number; total: number } | null;
};

type StageInput = {
  id: string;
  title: string;
  status: StageStatus;
  order: number;
  dueDate: Date | null;
  createdAt: Date;
};

export function toProjectRow(
  project: Omit<
    ProjectRow,
    "currentStage" | "stageCount" | "doneCount" | "nextMilestone" | "fee"
  > & { milestones: StageInput[] },
  fee: ProjectRow["fee"] = null
): ProjectRow {
  const { milestones, ...rest } = project;
  const current = currentStage(milestones);
  const next = nextMilestone(milestones);
  return {
    ...rest,
    currentStage: current ? { title: current.title, status: current.status } : null,
    stageCount: milestones.length,
    doneCount: milestones.filter((m) => m.status === "DONE").length,
    nextMilestone: next ? { title: next.title, dueDate: next.dueDate } : null,
    fee,
  };
}

/**
 * The archive (SPEC §3.2): completed projects move there by themselves, and
 * so do canceled ones and ones moved there by hand ("העבר לארכיון").
 */
export const ARCHIVED_STATUSES: ProjectStatus[] = ["DONE", "CANCELED"];

export function isArchived(project: {
  status: ProjectStatus;
  archivedAt: Date | string | null;
}) {
  return !!project.archivedAt || ARCHIVED_STATUSES.includes(project.status);
}

export const NO_OWNER = "none";

export type ProjectFilters = {
  status: ProjectStatus | "";
  /** A partner id, NO_OWNER, or "" for everyone. */
  owner: string;
  city: string;
  archive: boolean;
};

export function filterProjects(rows: ProjectRow[], f: ProjectFilters) {
  return rows.filter((r) => {
    if (isArchived(r) !== f.archive) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.owner === NO_OWNER ? r.owner : f.owner && r.owner?.id !== f.owner) {
      return false;
    }
    if (f.city && (r.city ?? "").trim() !== f.city) return false;
    return true;
  });
}

export const SORTS = [
  { value: "created", label: "החדשים ראשונים" },
  { value: "name", label: "שם" },
  { value: "milestone", label: "אבן דרך קרובה" },
  { value: "city", label: "עיר" },
  { value: "owner", label: "אחראי" },
  { value: "status", label: "סטטוס" },
] as const;

export type SortKey = (typeof SORTS)[number]["value"];

export function isSortKey(value: unknown): value is SortKey {
  return SORTS.some((s) => s.value === value);
}

const collator = new Intl.Collator("he");
const statusRank = (s: ProjectStatus) =>
  PROJECT_STATUSES.findIndex((x) => x.value === s);

/** Empty values always go last, whatever the direction. */
function compareMaybe<T>(
  a: T | null | undefined,
  b: T | null | undefined,
  cmp: (a: T, b: T) => number
) {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return cmp(a as T, b as T);
}

export function sortProjects(rows: ProjectRow[], key: SortKey) {
  const byName = (a: ProjectRow, b: ProjectRow) => collator.compare(a.name, b.name);
  const time = (d: Date | string) => new Date(d).getTime();
  const cmp: Record<SortKey, (a: ProjectRow, b: ProjectRow) => number> = {
    created: (a, b) => time(b.createdAt) - time(a.createdAt),
    name: byName,
    milestone: (a, b) =>
      compareMaybe(a.nextMilestone?.dueDate, b.nextMilestone?.dueDate, (x, y) =>
        time(x) - time(y)
      ) || byName(a, b),
    city: (a, b) =>
      compareMaybe(a.city?.trim(), b.city?.trim(), collator.compare) || byName(a, b),
    owner: (a, b) =>
      compareMaybe(a.owner?.name, b.owner?.name, collator.compare) || byName(a, b),
    status: (a, b) => statusRank(a.status) - statusRank(b.status) || byName(a, b),
  };
  return [...rows].sort(cmp[key]);
}

/** Distinct cities for the filter, sorted. */
export function citiesOf(rows: ProjectRow[]) {
  return [...new Set(rows.map((r) => r.city?.trim()).filter(Boolean) as string[])].sort(
    collator.compare
  );
}

export type KanbanColumn = {
  key: string;
  title: string;
  /** Visual hint: a template stage, another stage name, or a special column. */
  kind: "stage" | "custom" | "none" | "done";
  projects: ProjectRow[];
};

/**
 * Kanban by current stage (SPEC §3.2). Columns follow the department's
 * template order; a current stage that isn't in the template gets its own
 * column after them; then "all stages done" and "no stages". Only columns
 * with projects are returned.
 */
export function kanbanColumns(rows: ProjectRow[], templateTitles: string[]) {
  const columns = new Map<string, KanbanColumn>();
  const norm = (t: string) => t.trim();
  for (const title of templateTitles) {
    columns.set(`stage:${norm(title)}`, {
      key: `stage:${norm(title)}`,
      title,
      kind: "stage",
      projects: [],
    });
  }
  const custom: KanbanColumn[] = [];
  const done: KanbanColumn = { key: "done", title: "כל השלבים הושלמו", kind: "done", projects: [] };
  const none: KanbanColumn = { key: "none", title: "ללא שלבים", kind: "none", projects: [] };

  for (const row of rows) {
    if (row.stageCount === 0) {
      none.projects.push(row);
    } else if (!row.currentStage) {
      done.projects.push(row);
    } else {
      const key = `stage:${norm(row.currentStage.title)}`;
      let column = columns.get(key);
      if (!column) {
        column = { key, title: row.currentStage.title, kind: "custom", projects: [] };
        columns.set(key, column);
        custom.push(column);
      }
      column.projects.push(row);
    }
  }

  const templateColumns = [...columns.values()].filter((c) => c.kind === "stage");
  return [...templateColumns, ...custom, done, none].filter(
    (c) => c.projects.length > 0
  );
}
