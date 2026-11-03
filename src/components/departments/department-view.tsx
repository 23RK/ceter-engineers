"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Columns3, LayoutGrid, MapPin, Rows3 } from "lucide-react";
import type { ProjectStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { ProjectCard } from "@/components/projects/project-card";
import {
  CurrentStageText,
  FeeText,
  NextMilestoneText,
  OwnerChip,
} from "@/components/projects/project-bits";
import { PROJECT_STATUSES, projectStatusMeta } from "@/lib/constants";
import {
  ARCHIVED_STATUSES,
  NO_OWNER,
  SORTS,
  citiesOf,
  filterProjects,
  isArchived,
  kanbanColumns,
  sortProjects,
  type ProjectFilters,
  type ProjectRow,
  type SortKey,
} from "@/lib/project-list";
import type { UserOption } from "@/lib/types";

export type DepartmentViewMode = "table" | "cards" | "kanban";

export type DepartmentViewState = ProjectFilters & {
  view: DepartmentViewMode;
  sort: SortKey;
};

const VIEWS: { value: DepartmentViewMode; label: string; icon: typeof Rows3 }[] = [
  { value: "table", label: "טבלה", icon: Rows3 },
  { value: "cards", label: "כרטיסים", icon: LayoutGrid },
  { value: "kanban", label: "קנבן לפי שלב", icon: Columns3 },
];

/** The current view and filters live in the URL, so back/refresh/share keep them. */
function writeUrl(state: DepartmentViewState) {
  const params = new URLSearchParams();
  if (state.view !== "table") params.set("view", state.view);
  if (state.status) params.set("status", state.status);
  if (state.owner) params.set("owner", state.owner);
  if (state.city) params.set("city", state.city);
  if (state.sort !== "created") params.set("sort", state.sort);
  if (state.archive) params.set("archive", "1");
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

export function DepartmentView({
  rows,
  users,
  templateTitles,
  initial,
}: {
  rows: ProjectRow[];
  users: UserOption[];
  templateTitles: string[];
  initial: DepartmentViewState;
}) {
  const [state, setState] = useState(initial);
  const update = (patch: Partial<DepartmentViewState>) =>
    setState((s) => ({ ...s, ...patch }));

  useEffect(() => writeUrl(state), [state]);

  const archiveCount = useMemo(() => rows.filter(isArchived).length, [rows]);
  const cities = useMemo(() => citiesOf(rows), [rows]);
  const visible = useMemo(
    () => sortProjects(filterProjects(rows, state), state.sort),
    [rows, state]
  );
  // A project moved to the archive by hand can have any status.
  const statusOptions = state.archive
    ? PROJECT_STATUSES
    : PROJECT_STATUSES.filter((s) => !ARCHIVED_STATUSES.includes(s.value));
  const filtered = !!(state.status || state.owner || state.city);

  const selectClass =
    "min-h-10 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* View switch */}
        <div
          role="tablist"
          aria-label="תצוגה"
          className="flex rounded-lg border border-black/10 bg-white p-0.5 shadow-sm"
        >
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = state.view === v.value;
            return (
              <button
                key={v.value}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => update({ view: v.value })}
                className={`flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition ${
                  active ? "bg-brand-600 text-white" : "text-black/55 hover:bg-black/5"
                }`}
              >
                <Icon size={15} />
                <span className={v.value === "kanban" ? "hidden sm:inline" : ""}>
                  {v.label}
                </span>
                {v.value === "kanban" && <span className="sm:hidden">קנבן</span>}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => update({ archive: !state.archive, status: "" })}
          aria-pressed={state.archive}
          className={`flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-sm transition ${
            state.archive
              ? "border-brand-600 bg-brand-50 text-brand-700"
              : "border-black/10 bg-white text-black/60 hover:bg-black/5"
          }`}
        >
          <Archive size={15} />
          {state.archive ? "חזרה לפרויקטים הפעילים" : `הצג ארכיון (${archiveCount})`}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="סינון לפי סטטוס"
          value={state.status}
          onChange={(e) => update({ status: e.target.value as ProjectStatus | "" })}
          className={selectClass}
        >
          <option value="">כל הסטטוסים</option>
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          aria-label="סינון לפי אחראי"
          value={state.owner}
          onChange={(e) => update({ owner: e.target.value })}
          className={selectClass}
        >
          <option value="">כל האחראים</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
          <option value={NO_OWNER}>ללא אחראי</option>
        </select>
        <select
          aria-label="סינון לפי עיר"
          value={state.city}
          onChange={(e) => update({ city: e.target.value })}
          className={selectClass}
        >
          <option value="">כל הערים</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          aria-label="מיון"
          value={state.sort}
          onChange={(e) => update({ sort: e.target.value as SortKey })}
          className={selectClass}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              מיון: {s.label}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            type="button"
            onClick={() => update({ status: "", owner: "", city: "" })}
            className="min-h-10 rounded-lg px-3 text-sm text-brand-600 hover:underline"
          >
            איפוס סינון
          </button>
        )}
        <span className="ms-auto text-xs text-black/45">
          {visible.length === 1 ? "פרויקט אחד" : `${visible.length} פרויקטים`}
          {state.archive && " בארכיון"}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 py-16 text-center text-sm text-black/40">
          {rows.length === 0
            ? 'עדיין אין פרויקטים במחלקה. לחצו על "פרויקט חדש" כדי להתחיל.'
            : state.archive
              ? "אין פרויקטים בארכיון שמתאימים לסינון."
              : "אין פרויקטים שמתאימים לסינון."}
        </div>
      ) : state.view === "kanban" ? (
        <Kanban rows={visible} templateTitles={templateTitles} />
      ) : state.view === "cards" ? (
        <CardsGrid rows={visible} />
      ) : (
        <>
          {/* Phones: a table doesn't fit - the same rows as cards (SPEC §1.2). */}
          <div className="md:hidden">
            <CardsGrid rows={visible} />
          </div>
          <div className="hidden md:block">
            <ProjectsTable rows={visible} sort={state.sort} onSort={(sort) => update({ sort })} />
          </div>
        </>
      )}
    </div>
  );
}

function CardsGrid({ rows }: { rows: ProjectRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <ProjectCard key={row.id} row={row} />
      ))}
    </div>
  );
}

function ProjectsTable({
  rows,
  sort,
  onSort,
}: {
  rows: ProjectRow[];
  sort: SortKey;
  onSort: (sort: SortKey) => void;
}) {
  const th = (label: string, key?: SortKey) => (
    <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold text-black/45">
      {key ? (
        <button
          type="button"
          onClick={() => onSort(key)}
          className={`hover:text-brand-700 ${sort === key ? "text-brand-700" : ""}`}
        >
          {label}
          {sort === key && " ↓"}
        </button>
      ) : (
        label
      )}
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="border-b border-black/5 bg-black/[0.02]">
          <tr>
            {th("שם", "name")}
            {th("לקוח")}
            {th("עיר", "city")}
            {th("אחראי", "owner")}
            {th("שלב נוכחי")}
            {th("אבן הדרך הבאה", "milestone")}
            {th("שכר טרחה (נגבה / סה״כ)")}
            {th("סטטוס", "status")}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = projectStatusMeta(row.status);
            return (
              <tr
                key={row.id}
                className="group border-b border-black/5 text-brand-900 last:border-b-0 hover:bg-brand-50/40"
              >
                <td className="max-w-56 px-3 py-3">
                  <Link
                    href={`/projects/${row.id}`}
                    className="font-semibold group-hover:text-brand-600"
                  >
                    {row.name}
                  </Link>
                  {row.archivedAt && (
                    <span className="mr-1.5 inline-flex items-center gap-0.5 align-middle text-[11px] text-black/40">
                      <Archive size={11} />
                      בארכיון
                    </span>
                  )}
                </td>
                <td className="max-w-40 truncate px-3 py-3 text-black/60">{row.client ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-3 text-black/60">
                  {row.city ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} className="text-black/30" />
                      {row.city}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3 text-xs">
                  <OwnerChip owner={row.owner} />
                </td>
                <td className="max-w-52 px-3 py-3 text-xs">
                  <CurrentStageText row={row} />
                </td>
                <td className="max-w-60 px-3 py-3 text-xs">
                  <NextMilestoneText row={row} />
                </td>
                <td className="px-3 py-3 text-xs">
                  <FeeText fee={row.fee} />
                </td>
                <td className="px-3 py-3">
                  <Badge className={status.badge}>{status.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Kanban({ rows, templateTitles }: { rows: ProjectRow[]; templateTitles: string[] }) {
  const columns = kanbanColumns(rows, templateTitles);
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      {columns.map((column) => (
        <section
          key={column.key}
          className="flex w-[82vw] max-w-72 shrink-0 snap-start flex-col gap-2.5 rounded-2xl bg-black/[0.03] p-3 sm:w-72"
        >
          <header className="flex items-center justify-between gap-2 px-1">
            <h3
              className={`text-sm font-bold ${
                column.kind === "done"
                  ? "text-green-700"
                  : column.kind === "none"
                    ? "text-black/45"
                    : "text-brand-900"
              }`}
            >
              {column.title}
              {column.kind === "custom" && (
                <span className="mr-1 text-[11px] font-normal text-black/40">(לא מהתבנית)</span>
              )}
            </h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-black/50">
              {column.projects.length}
            </span>
          </header>
          {column.projects.map((row) => (
            <ProjectCard key={row.id} row={row} compact />
          ))}
        </section>
      ))}
    </div>
  );
}
