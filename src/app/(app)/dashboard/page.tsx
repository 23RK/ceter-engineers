import Link from "next/link";
import { endOfMonth, startOfDay } from "date-fns";
import {
  ListChecks,
  AlarmClock,
  Building2,
  Flag,
  Calendar,
  Activity as ActivityIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { taskPriorityMeta, PROJECT_STATUSES } from "@/lib/constants";
import { formatDate, formatDateShort, isOverdue } from "@/lib/format";

export default async function DashboardPage() {
  const user = await requireUser();
  const today = startOfDay(new Date());
  const monthEnd = endOfMonth(today);

  const [
    openTasksCount,
    overdueTasksCount,
    activeProjectsCount,
    milestonesDueCount,
    openTasks,
    upcomingTasks,
    activities,
    projectStatusCounts,
    users,
  ] = await Promise.all([
    prisma.task.count({ where: { status: { not: "DONE" } } }),
    prisma.task.count({
      where: { status: { not: "DONE" }, dueDate: { lt: today } },
    }),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.milestone.count({
      where: { done: false, dueDate: { gte: today, lte: monthEnd } },
    }),
    prisma.task.findMany({
      where: { status: { not: "DONE" } },
      include: { assignee: true },
    }),
    prisma.task.findMany({
      where: { status: { not: "DONE" }, dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      take: 6,
      include: { assignee: true, project: true },
    }),
    prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: true, project: true },
    }),
    prisma.project.groupBy({ by: ["status"], _count: true }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  const workloadByUser = users.map((u) => {
    const tasks = openTasks.filter((t) => t.assigneeId === u.id);
    return {
      user: u,
      total: tasks.length,
      overdue: tasks.filter((t) => isOverdue(t.dueDate)).length,
    };
  });

  const unassignedCount = openTasks.filter((t) => !t.assigneeId).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-brand-900">
          שלום, {user.name.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-black/50">
          סיכום מצב הפרויקטים והמשימות של כתר הנדסה
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<ListChecks size={20} />}
          label="משימות פתוחות"
          value={openTasksCount}
        />
        <StatCard
          icon={<AlarmClock size={20} />}
          label="משימות באיחור"
          value={overdueTasksCount}
          tone={overdueTasksCount > 0 ? "danger" : "default"}
        />
        <StatCard
          icon={<Building2 size={20} />}
          label="פרויקטים פעילים"
          value={activeProjectsCount}
        />
        <StatCard
          icon={<Flag size={20} />}
          label="אבני דרך החודש"
          value={milestonesDueCount}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* Partner workload */}
          <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-brand-900">
              עומס עבודה לפי שותף
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {workloadByUser.map(({ user: u, total, overdue }) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-xl border border-black/5 p-4"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.name.slice(0, 1)}
                    </span>
                    <span className="text-sm font-medium text-brand-900">
                      {u.name}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-brand-900">
                      {total} משימות
                    </p>
                    {overdue > 0 && (
                      <p className="text-xs font-medium text-red-500">
                        {overdue} באיחור
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {unassignedCount > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-dashed border-black/10 p-4 text-black/40">
                  <span className="text-sm">ללא שיוך</span>
                  <span className="text-sm font-bold">
                    {unassignedCount} משימות
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Upcoming deadlines */}
          <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Calendar size={16} className="text-brand-600" />
              <h2 className="text-sm font-bold text-brand-900">
                מועדי יעד קרובים
              </h2>
            </div>
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-black/40">אין משימות עם תאריך יעד קרוב.</p>
            ) : (
              <div className="flex flex-col divide-y divide-black/5">
                {upcomingTasks.map((task) => {
                  const overdue = isOverdue(task.dueDate);
                  const priority = taskPriorityMeta(task.priority);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${priority.dot}`} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-brand-900">
                            {task.title}
                          </p>
                          {task.project && (
                            <p className="truncate text-xs text-black/40">
                              {task.project.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-medium ${overdue ? "text-red-600" : "text-black/40"}`}
                      >
                        {formatDateShort(task.dueDate)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          {/* Projects by status */}
          <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-brand-900">
              פרויקטים לפי סטטוס
            </h2>
            <div className="flex flex-col gap-2.5">
              {PROJECT_STATUSES.map((s) => {
                const count =
                  projectStatusCounts.find((p) => p.status === s.value)
                    ?._count ?? 0;
                return (
                  <div
                    key={s.value}
                    className="flex items-center justify-between"
                  >
                    <Badge className={s.badge}>{s.label}</Badge>
                    <span className="text-sm font-semibold text-brand-900">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Activity feed */}
          <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ActivityIcon size={16} className="text-brand-600" />
              <h2 className="text-sm font-bold text-brand-900">
                פעילות אחרונה
              </h2>
            </div>
            {activities.length === 0 ? (
              <p className="text-sm text-black/40">אין פעילות עדיין.</p>
            ) : (
              <ol className="flex flex-col gap-3.5">
                {activities.map((a) => (
                  <li key={a.id} className="text-sm">
                    <p className="text-black/70">{a.message}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-black/35">
                      <span>{formatDate(a.createdAt)}</span>
                      {a.project && (
                        <>
                          <span>·</span>
                          <Link
                            href={`/projects/${a.project.id}`}
                            className="hover:text-brand-600 hover:underline"
                          >
                            {a.project.name}
                          </Link>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
