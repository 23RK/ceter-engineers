import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  Handshake,
  House,
  Wallet,
  Activity as ActivityIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { UnassignedProjectsBanner } from "@/components/projects/unassigned-banner";
import { DashboardTasks } from "@/components/dashboard/dashboard-tasks";
import { PROJECT_STATUSES } from "@/lib/constants";
import { DEPARTMENTS } from "@/lib/departments";
import { isArchived } from "@/lib/project-list";
import { expectedCollection, monthRange, splitDeadlines } from "@/lib/dashboard";
import { USER_OPTION_SELECT } from "@/lib/types";
import {
  formatDate,
  formatDateShort,
  formatMoney,
  formatTime,
  isOverdue,
  israelToday,
} from "@/lib/format";

export default async function DashboardPage() {
  const user = await requireUser();
  const today = israelToday();
  const { next: nextMonth } = monthRange(today);

  const [
    openTasks,
    projects,
    unpaidPayments,
    activities,
    projectStatusCounts,
    users,
    upcomingMeetings,
    openLeadsCount,
    urgentLeadTasks,
    unassignedProjectsCount,
    monthInspections,
    unpaidInspections,
  ] = await Promise.all([
    // All open tasks (a small table): the lists, counts and workload come from it.
    prisma.task.findMany({
      where: { status: { not: "DONE" } },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        assigneeId: true,
        project: { select: { id: true, name: true, department: true } },
      },
    }),
    prisma.project.findMany({
      select: { department: true, status: true, archivedAt: true },
    }),
    prisma.payment.findMany({
      where: { paid: false, dueDate: { lt: nextMonth } },
      select: {
        id: true,
        title: true,
        amount: true,
        paid: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.project.groupBy({ by: ["status"], _count: true }),
    prisma.user.findMany({
      where: { role: "PARTNER" },
      select: USER_OPTION_SELECT,
      orderBy: { name: "asc" },
    }),
    prisma.meeting.findMany({
      where: { startTime: { gte: new Date() } },
      orderBy: { startTime: "asc" },
      take: 5,
    }),
    prisma.lead.count({
      where: { status: { in: ["IN_PROGRESS", "PENDING"] } },
    }),
    prisma.leadTask.findMany({
      where: { status: { not: "DONE" }, dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      take: 4,
      include: { lead: { select: { id: true, name: true } } },
    }),
    prisma.project.count({ where: { department: null } }),
    // בדק בית this month (SPEC §3.6).
    prisma.inspection.findMany({
      where: {
        status: { not: "CANCELED" },
        date: { gte: monthRange(today).start, lt: nextMonth },
      },
      select: { status: true, reportSent: true },
    }),
    // Open debt from בדק בית: carried out and not (fully) paid.
    prisma.inspection.findMany({
      where: { status: { in: ["DONE", "REPORT_SENT", "COMPLETED"] }, paymentStatus: { not: "PAID" } },
      select: { id: true, clientName: true, date: true, price: true, amountPaid: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const isLate = (d: Date | null) => !!d && d.getTime() < today.getTime();
  const departmentCards = DEPARTMENTS.map((d) => ({
    ...d,
    activeProjects: projects.filter((p) => p.department === d.value && !isArchived(p)).length,
    overdueTasks: openTasks.filter((t) => t.project?.department === d.value && isLate(t.dueDate)).length,
  }));
  const otherOverdue = openTasks.filter(
    (t) => !t.project?.department && isLate(t.dueDate)
  ).length;
  const collection = expectedCollection(unpaidPayments, today);
  const inspectionDebt = unpaidInspections
    .map((i) => ({ ...i, owed: Math.max(0, (i.price ?? 0) - i.amountPaid) }))
    .filter((i) => i.owed > 0);
  const inspectionDebtTotal = inspectionDebt.reduce((s, i) => s + i.owed, 0);
  const expectedTotal = collection.thisMonthTotal + collection.earlierTotal + inspectionDebtTotal;
  const awaitingReport = monthInspections.filter((i) => i.status === "DONE" && !i.reportSent).length;

  const workloadByUser = users.map((u) => {
    const tasks = openTasks.filter((t) => t.assigneeId === u.id);
    return {
      user: u,
      total: tasks.length,
      overdue: tasks.filter((t) => isLate(t.dueDate)).length,
    };
  });

  // Only what the lists need: overdue, the next two weeks, and unassigned.
  const { overdue, upcoming } = splitDeadlines(openTasks, today);
  const listed = new Set([
    ...overdue.map((o) => o.task.id),
    ...upcoming.map((t) => t.id),
    ...openTasks.filter((t) => !t.assigneeId).map((t) => t.id),
  ]);
  const listTasks = openTasks
    .filter((t) => listed.has(t.id))
    .map((t) => ({ ...t, project: t.project && { id: t.project.id, name: t.project.name } }));

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

      <UnassignedProjectsBanner count={unassignedProjectsCount} />

      {/* Cards per department (SPEC §3.6) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
        {departmentCards.map((d) => (
          <Link
            key={d.value}
            href={`/departments/${d.slug}`}
            className="group flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-sm font-bold text-brand-900 group-hover:text-brand-600">
              {d.value === "VILLA" ? <House size={16} /> : <Building2 size={16} />}
              {d.label}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-2xl font-bold text-brand-900">{d.activeProjects}</p>
                <p className="text-xs text-black/50">פרויקטים פעילים</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${d.overdueTasks ? "text-red-600" : "text-brand-900"}`}>
                  {d.overdueTasks}
                </p>
                <p className="text-xs text-black/50">משימות באיחור</p>
              </div>
            </div>
          </Link>
        ))}
        <Link
          href={`/inspections?month=${today.toISOString().slice(0, 7)}`}
          className="group flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition hover:shadow-md"
        >
          <p className="flex items-center gap-2 text-sm font-bold text-brand-900 group-hover:text-brand-600">
            <ClipboardCheck size={16} />
            בדק בית
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-2xl font-bold text-brand-900">{monthInspections.length}</p>
              <p className="text-xs text-black/50">בדיקות החודש</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${awaitingReport ? "text-amber-600" : "text-brand-900"}`}>
                {awaitingReport}
              </p>
              <p className="text-xs text-black/50">ממתינות לדוח</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <DashboardTasks tasks={listTasks} users={users} today={today.toISOString().slice(0, 10)} />
          {otherOverdue > 0 && (
            <p className="-mt-3 text-xs text-black/45">
              {otherOverdue === 1 ? "משימה אחת באיחור" : `${otherOverdue} משימות באיחור`} בלי פרויקט או בפרויקט בלי מחלקה (לא נספרו בכרטיסי המחלקות).
            </p>
          )}

          {/* Upcoming meetings */}
          <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays size={16} className="text-brand-600" />
              <h2 className="text-sm font-bold text-brand-900">
                פגישות קרובות
              </h2>
            </div>
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-black/40">
                אין פגישות קרובות ביומן.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-black/5">
                {upcomingMeetings.map((meeting) => (
                  <Link
                    key={meeting.id}
                    href="/calendar"
                    className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-70"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-brand-900">
                        {meeting.title}
                      </p>
                      {meeting.location && (
                        <p className="truncate text-xs text-black/40">
                          {meeting.location}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-black/40">
                      {formatDateShort(meeting.startTime)} ·{" "}
                      {formatTime(meeting.startTime)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          {/* גבייה צפויה (replaces "אבני דרך החודש", SPEC §3.6): one card, by source */}
          <section id="collection" className="scroll-mt-20 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <Wallet size={16} className="text-brand-600" />
              <h2 className="text-sm font-bold text-brand-900">גבייה צפויה</h2>
            </div>
            <p className="text-2xl font-bold text-brand-900">{formatMoney(expectedTotal)}</p>
            <p className="mb-3 text-xs text-black/45">החודש, כולל מה שבאיחור. ללא מע&quot;מ בבדק בית.</p>

            <dl className="mb-3 flex flex-col gap-1.5 rounded-xl bg-black/[0.02] p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-black/60">שכר טרחה, פרויקטים, החודש ({collection.thisMonth.length})</dt>
                <dd className="font-semibold text-brand-900">{formatMoney(collection.thisMonthTotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-black/60">שכר טרחה, באיחור מחודשים קודמים ({collection.earlier.length})</dt>
                <dd className={`font-semibold ${collection.earlierTotal ? "text-red-600" : "text-brand-900"}`}>
                  {formatMoney(collection.earlierTotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-black/60">
                  <Link href="/inspections?preset=unpaid" className="hover:text-brand-600 hover:underline">
                    בדק בית: בוצעו ולא שולמו ({inspectionDebt.length})
                  </Link>
                </dt>
                <dd className={`font-semibold ${inspectionDebtTotal ? "text-amber-700" : "text-brand-900"}`}>
                  {formatMoney(inspectionDebtTotal)}
                </dd>
              </div>
            </dl>

            {collection.thisMonth.length + collection.earlier.length + inspectionDebt.length === 0 ? (
              <p className="text-sm text-black/40">אין תשלומים פתוחים.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-black/5">
                {[...collection.earlier, ...collection.thisMonth].map((p) => {
                  const late = isLate(p.dueDate);
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/projects/${p.project.id}?tab=finance`}
                        className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-70"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-brand-900">
                            {p.title ?? "תשלום"} · {formatMoney(p.amount)}
                          </p>
                          <p className="truncate text-xs text-black/40">פרויקט: {p.project.name}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-medium ${late ? "text-red-600" : "text-black/40"}`}>
                          {formatDateShort(p.dueDate)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
                {inspectionDebt.slice(0, 5).map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/inspections?q=${encodeURIComponent(i.clientName)}`}
                      className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-brand-900">
                          {i.clientName} · {formatMoney(i.owed)}
                        </p>
                        <p className="truncate text-xs text-black/40">בדק בית</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-black/40">{formatDateShort(i.date)}</span>
                    </Link>
                  </li>
                ))}
                {inspectionDebt.length > 5 && (
                  <li className="pt-2">
                    <Link href="/inspections?preset=unpaid" className="text-xs font-medium text-brand-600 hover:underline">
                      ועוד {inspectionDebt.length - 5} בדיקות שלא שולמו
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </section>

          {/* Partner workload */}
          <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-brand-900">
              עומס עבודה לפי שותף
            </h2>
            <div className="flex flex-col gap-3">
              {workloadByUser.map(({ user: u, total, overdue: late }) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-xl border border-black/5 p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.name.slice(0, 1)}
                    </span>
                    <span className="text-sm font-medium text-brand-900">{u.name}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-brand-900">{total} משימות</p>
                    {late > 0 && <p className="text-xs font-medium text-red-500">{late} באיחור</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

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

          {/* Business dev summary */}
          <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Handshake size={16} className="text-brand-600" />
                <h2 className="text-sm font-bold text-brand-900">
                  פיתוח עסקי
                </h2>
              </div>
              <span className="text-xs font-medium text-black/40">
                {openLeadsCount} הזדמנויות פתוחות
              </span>
            </div>
            {urgentLeadTasks.length === 0 ? (
              <p className="text-sm text-black/40">
                אין משימות דחופות בפיתוח עסקי.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-black/5">
                {urgentLeadTasks.map((task) => {
                  const overdue = isOverdue(task.dueDate);
                  return (
                    <Link
                      key={task.id}
                      href={`/business-dev/${task.lead.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-brand-900">
                          {task.title}
                        </p>
                        <p className="truncate text-xs text-black/40">
                          {task.lead.name}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-medium ${overdue ? "text-red-600" : "text-black/40"}`}
                      >
                        {formatDateShort(task.dueDate)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
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
