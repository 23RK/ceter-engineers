import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { departmentBySlug } from "@/lib/departments";
import { isSortKey, toProjectRow } from "@/lib/project-list";
import { feeProgress } from "@/lib/fees";
import { PROJECT_STATUSES } from "@/lib/constants";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { UnassignedProjectsBanner } from "@/components/projects/unassigned-banner";
import {
  DepartmentView,
  type DepartmentViewState,
} from "@/components/departments/department-view";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** The department screen (SPEC §3.2): table / cards / kanban, filters, archive. */
export default async function DepartmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const department = departmentBySlug(slug);
  if (!department) notFound();

  const [projects, unassignedCount, users, templates] = await Promise.all([
    prisma.project.findMany({
      where: { department: department.value },
      select: {
        id: true,
        name: true,
        client: true,
        city: true,
        status: true,
        archivedAt: true,
        createdAt: true,
        owner: { select: { id: true, name: true, color: true } },
        milestones: {
          select: {
            id: true,
            title: true,
            status: true,
            order: true,
            dueDate: true,
            createdAt: true,
          },
        },
        feeModel: true,
        feeTotal: true,
        feeMonthly: true,
        feeStartDate: true,
        feeEndDate: true,
        feePercent: true,
        feeConstructionCost: true,
        payments: { select: { amount: true, paid: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.count({ where: { department: null } }),
    prisma.user.findMany({
      where: { role: "PARTNER" },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    // Both departments (tiny): the kanban uses this one's, the new-project form either.
    prisma.stageTemplate.findMany({
      select: { department: true, title: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const rows = projects.map(
    ({
      payments,
      feeModel,
      feeTotal,
      feeMonthly,
      feeStartDate,
      feeEndDate,
      feePercent,
      feeConstructionCost,
      ...p
    }) =>
      toProjectRow(
        p,
        feeProgress(
          { feeModel, feeTotal, feeMonthly, feeStartDate, feeEndDate, feePercent, feeConstructionCost },
          payments
        )
      )
  );
  const activeCount = rows.filter(
    (r) => !r.archivedAt && r.status !== "DONE" && r.status !== "CANCELED"
  ).length;

  const view = one(query.view);
  const status = one(query.status);
  const sort = one(query.sort);
  const initial: DepartmentViewState = {
    view: view === "cards" || view === "kanban" ? view : "table",
    status: PROJECT_STATUSES.some((s) => s.value === status)
      ? (status as DepartmentViewState["status"])
      : "",
    owner: one(query.owner),
    city: one(query.city),
    sort: isSortKey(sort) ? sort : "created",
    archive: one(query.archive) === "1",
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">{department.label}</h1>
          <p className="text-sm text-black/50">
            {activeCount === 1 ? "פרויקט פעיל אחד" : `${activeCount} פרויקטים פעילים`}
          </p>
        </div>
        <NewProjectButton department={department.value} users={users} templates={templates} />
      </div>

      <UnassignedProjectsBanner count={unassignedCount} />

      <DepartmentView
        key={department.value}
        rows={rows}
        users={users}
        templateTitles={templates.filter((t) => t.department === department.value).map((t) => t.title)}
        initial={initial}
      />
    </div>
  );
}
