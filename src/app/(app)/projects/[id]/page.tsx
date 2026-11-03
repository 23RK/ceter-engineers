import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { departmentHref, departmentMeta } from "@/lib/departments";
import { missingTemplateTitles, nextMilestone } from "@/lib/stages";
import { feeProgress, paymentsDueForDoneStages } from "@/lib/fees";
import { israelToday } from "@/lib/format";
import { USER_OPTION_SELECT } from "@/lib/types";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectTabs, type ProjectTab } from "@/components/projects/project-tabs";
import { ProjectOverview } from "@/components/projects/project-overview";
import { ProjectTaskList } from "@/components/projects/project-task-list";
import { ProjectStages } from "@/components/projects/project-stages";
import { ProjectUpdates } from "@/components/projects/project-updates";
import { ProjectDocuments } from "@/components/projects/project-documents";
import { ProjectFinance } from "@/components/projects/project-finance";
import { ProjectContacts } from "@/components/projects/project-contacts";
import { ChangeOrders, SupervisionReports } from "@/components/projects/project-logs";

const FILE_SELECT = {
  id: true,
  name: true,
  url: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const;

/** The project page (SPEC §3.4): header with the stage bar and three numbers, then inner tabs. */
export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);

  // Everything in parallel - no waterfall (SPEC §1.1).
  const [project, users, projects, templates, updates, documents, allContacts, reports, changes] =
    await Promise.all([
      prisma.project.findUnique({
        where: { id },
        include: {
          milestones: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
          owner: { select: USER_OPTION_SELECT },
          tasks: { include: { assignee: { select: USER_OPTION_SELECT }, project: true } },
          payments: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
          contacts: {
            include: {
              contact: {
                include: { projects: { select: { project: { select: { id: true, name: true } } } } },
              },
            },
          },
        },
      }),
      prisma.user.findMany({
        where: { role: "PARTNER" },
        select: USER_OPTION_SELECT,
        orderBy: { name: "asc" },
      }),
      prisma.project.findMany({
        select: { id: true, name: true, status: true },
        orderBy: { name: "asc" },
      }),
      prisma.stageTemplate.findMany({
        select: { department: true, title: true },
        orderBy: { order: "asc" },
      }),
      prisma.projectUpdate.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: USER_OPTION_SELECT },
          files: { select: FILE_SELECT, orderBy: { createdAt: "asc" } },
          notifications: { select: { user: { select: { name: true } } } },
        },
      }),
      prisma.projectFile.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
        select: { ...FILE_SELECT, updateId: true, uploadedBy: { select: { name: true } } },
      }),
      prisma.contact.findMany({
        select: { id: true, name: true, company: true, phone: true, email: true, notes: true },
        orderBy: { name: "asc" },
      }),
      prisma.supervisionReport.findMany({
        where: { projectId: id },
        orderBy: { visitDate: "desc" },
      }),
      prisma.changeOrder.findMany({
        where: { projectId: id },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
    ]);

  if (!project) notFound();

  // The plain project fields, without the relations, for client components.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { milestones, tasks, payments, contacts, ...base } = project;
  const feeTerms = {
    feeModel: project.feeModel,
    feeTotal: project.feeTotal,
    feeMonthly: project.feeMonthly,
    feeStartDate: project.feeStartDate,
    feeEndDate: project.feeEndDate,
    feePercent: project.feePercent,
    feeConstructionCost: project.feeConstructionCost,
  };

  const today = israelToday().getTime();
  const openTasks = project.tasks.filter((t) => t.status !== "DONE");
  const overdueTasks = openTasks.filter((t) => t.dueDate && t.dueDate.getTime() < today).length;
  const fee = feeProgress(feeTerms, payments);
  const paymentAlerts = paymentsDueForDoneStages(project.payments, project.milestones).length;
  const next = nextMilestone(project.milestones);

  const missingTemplateCount = project.department
    ? missingTemplateTitles(
        templates.filter((t) => t.department === project.department).map((t) => t.title),
        project.milestones.map((m) => m.title)
      ).length
    : 0;

  const contactLinks = project.contacts.map((link) => ({
    id: link.id,
    role: link.role,
    roleNote: link.roleNote,
    contact: {
      id: link.contact.id,
      name: link.contact.name,
      company: link.contact.company,
      phone: link.contact.phone,
      email: link.contact.email,
      notes: link.contact.notes,
      projectNames: [
        ...new Set(
          link.contact.projects.map((p) => p.project).filter((p) => p.id !== project.id).map((p) => p.name)
        ),
      ],
    },
  }));
  const clients = contactLinks.filter((l) => l.role === "CLIENT").map((l) => l.contact);

  const isDeveloper = project.department === "DEVELOPER";
  const isVilla = project.department === "VILLA";
  const unsentReports = reports.filter((r) => !r.reportSent).length;
  const pendingChanges = changes.filter((c) => !c.clientApproved).length;
  const latest = updates[0];

  const tabs: ProjectTab[] = [
    {
      key: "overview",
      label: "סקירה",
      content: (
        <ProjectOverview
          stages={project.milestones}
          tasks={project.tasks}
          payments={project.payments}
          latestUpdate={
            latest
              ? {
                  body: latest.body,
                  createdAt: latest.createdAt,
                  author: latest.author?.name ?? null,
                  fileCount: latest.files.length,
                }
              : null
          }
          unsentReports={isDeveloper ? unsentReports : null}
          pendingChanges={isVilla ? pendingChanges : null}
        />
      ),
    },
    {
      key: "tasks",
      label: "משימות",
      count: openTasks.length,
      alert: overdueTasks > 0,
      content: (
        <ProjectTaskList projectId={project.id} tasks={project.tasks} users={users} projects={projects} />
      ),
    },
    {
      key: "stages",
      label: "שלבים ואבני דרך",
      content: (
        <ProjectStages
          projectId={project.id}
          hasDepartment={!!project.department}
          projectStart={project.startDate}
          stages={project.milestones}
          missingTemplateCount={missingTemplateCount}
        />
      ),
    },
    {
      key: "updates",
      label: "עדכונים",
      count: updates.length,
      content: (
        <ProjectUpdates
          projectId={project.id}
          users={users}
          currentUserId={user.id}
          updates={updates.map((u) => ({
            id: u.id,
            body: u.body,
            createdAt: u.createdAt,
            author: u.author,
            files: u.files,
            tagged: [...new Set(u.notifications.map((n) => n.user.name))],
          }))}
        />
      ),
    },
    {
      key: "documents",
      label: "מסמכים",
      count: documents.length,
      content: (
        <ProjectDocuments
          projectId={project.id}
          files={documents.map((d) => ({
            ...d,
            uploadedBy: d.uploadedBy?.name ?? null,
            fromUpdate: !!d.updateId,
          }))}
        />
      ),
    },
    {
      key: "finance",
      label: "כספים",
      count: paymentAlerts,
      alert: paymentAlerts > 0,
      content: (
        <ProjectFinance
          projectId={project.id}
          terms={feeTerms}
          billing={{ feeBillingDay: project.feeBillingDay, feePaymentTermsDays: project.feePaymentTermsDays }}
          feeNotes={project.feeNotes}
          payments={project.payments}
          stages={project.milestones.map((m) => ({ id: m.id, title: m.title, status: m.status }))}
        />
      ),
    },
    {
      key: "contacts",
      label: "אנשי קשר",
      count: contactLinks.length,
      content: (
        <ProjectContacts
          projectId={project.id}
          links={contactLinks}
          allContacts={allContacts}
          defaultClientName={project.client}
        />
      ),
    },
  ];
  if (isDeveloper) {
    tabs.push({
      key: "reports",
      label: "דוחות פיקוח",
      count: unsentReports,
      alert: unsentReports > 0,
      content: <SupervisionReports projectId={project.id} reports={reports} users={users} />,
    });
  }
  if (isVilla) {
    tabs.push({
      key: "changes",
      label: "שינויים ותוספות",
      count: pendingChanges,
      content: <ChangeOrders projectId={project.id} changes={changes} />,
    });
  }

  const tab = query.tab;
  return (
    <div className="flex flex-col gap-5">
      <Link
        href={departmentHref(project.department)}
        className="-mb-2 flex w-fit items-center gap-1 rounded-lg py-1 text-sm font-medium text-black/50 transition hover:text-brand-600"
      >
        <ChevronRight size={16} />
        {project.department ? departmentMeta(project.department).label : "שיוך מחלקות"}
      </Link>
      <ProjectHeader
        project={base}
        users={users}
        stages={project.milestones}
        nextMilestone={next ? { title: next.title, dueDate: next.dueDate } : null}
        overdueTasks={overdueTasks}
        fee={fee}
        clients={clients}
      />
      <ProjectTabs key={project.id} tabs={tabs} initial={typeof tab === "string" ? tab : "overview"} />
    </div>
  );
}
