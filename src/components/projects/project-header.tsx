"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Building2,
  Calendar,
  Flag,
  ListChecks,
  MapPin,
  Navigation,
  Pencil,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import type { Milestone, Project } from "@prisma/client";
import { Modal } from "@/components/ui/modal";
import { MoreMenu } from "@/components/ui/menu";
import { Badge } from "@/components/ui/badge";
import { ProjectForm } from "@/components/projects/project-form";
import { StageBar } from "@/components/projects/stage-bar";
import { openProjectTab, TabLink } from "@/components/projects/project-tabs";
import {
  ContactCardModal,
  ContactLinks,
  type ContactInfo,
} from "@/components/contacts/contact-card";
import { deleteProject, setProjectArchived } from "@/lib/actions/projects";
import { projectStatusMeta } from "@/lib/constants";
import { departmentMeta } from "@/lib/departments";
import { fullAddress, wazeHref } from "@/lib/contacts";
import { isArchived } from "@/lib/project-list";
import { formatDate, formatDateShort, formatMoney, isOverdue } from "@/lib/format";
import type { UserOption } from "@/lib/types";
import { useActionResult } from "@/components/ui/toast";

type Stage = Pick<
  Milestone,
  "id" | "title" | "status" | "order" | "createdAt" | "dueDate" | "completedAt"
>;

export function ProjectHeader({
  project,
  users,
  stages,
  nextMilestone,
  overdueTasks,
  fee,
  clients,
}: {
  project: Project & { owner: UserOption | null };
  users: UserOption[];
  stages: Stage[];
  nextMilestone: { title: string; dueDate: Date | null } | null;
  overdueTasks: number;
  fee: { collected: number; total: number } | null;
  /** Contacts linked as לקוח (SPEC §3.4: the client links to a contact card). */
  clients: (ContactInfo & { projectNames: string[] })[];
}) {
  const onResult = useActionResult();
  const status = projectStatusMeta(project.status);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivePending, startArchive] = useTransition();
  const archivedByHand = !!project.archivedAt;
  const inArchive = isArchived(project);
  const address = fullAddress(project.address, project.city);
  const waze = wazeHref(project.address, project.city);
  const nextOverdue = isOverdue(nextMilestone?.dueDate);

  function toggleArchive() {
    setError(null);
    startArchive(async () => {
      const res = onResult(await setProjectArchived(project.id, !archivedByHand));
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-6">
      {/* Name, status, department, owner + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 sm:flex">
            <Building2 size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-snug text-brand-900 sm:text-xl">
              {project.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge className={status.badge}>{status.label}</Badge>
              {project.department ? (
                <Badge className={departmentMeta(project.department).badge}>
                  {departmentMeta(project.department).short}
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800">ללא מחלקה</Badge>
              )}
              {inArchive && (
                <Badge className="bg-slate-100 text-slate-600">
                  <Archive size={12} />
                  בארכיון
                </Badge>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.03] px-2.5 py-1 text-xs text-brand-900">
                <UserRound size={12} className="text-black/40" />
                אחראי: <span className="font-semibold">{project.owner?.name ?? "—"}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="hidden min-h-10 items-center gap-1.5 rounded-lg border border-black/10 px-3.5 text-sm font-medium text-brand-900 transition hover:bg-black/5 sm:flex"
          >
            <Pencil size={14} />
            עריכה
          </button>
          <MoreMenu
            items={[
              { label: "עריכת פרטי הפרויקט", icon: <Pencil size={15} />, onSelect: () => setEditOpen(true) },
              archivedByHand
                ? { label: "החזרה מהארכיון", icon: <ArchiveRestore size={15} />, onSelect: toggleArchive }
                : { label: "העבר לארכיון", icon: <Archive size={15} />, onSelect: toggleArchive },
              { label: "מחיקה לצמיתות", icon: <Trash2 size={15} />, danger: true, onSelect: () => setDeleteOpen(true) },
            ]}
          />
        </div>
      </div>

      {(error || archivePending) && (
        <p className={`rounded-lg px-3 py-2 text-sm ${error ? "bg-red-50 text-red-700" : "bg-black/[0.03] text-black/50"}`}>
          {error ?? "שומר..."}
        </p>
      )}
      {inArchive && !archivedByHand && (
        <p className="rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-black/50">
          הפרויקט בארכיון כי הסטטוס שלו &quot;{status.label}&quot;. שינוי הסטטוס יחזיר אותו לרשימה הפעילה.
        </p>
      )}

      <div className="border-t border-black/5 pt-4">
        <StageBar stages={stages} />
      </div>

      {/* The three numbers (SPEC §3.4) */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatButton
          onClick={() => openProjectTab("stages")}
          icon={<Flag size={15} />}
          label="אבן הדרך הבאה"
          tone={nextOverdue ? "danger" : "default"}
        >
          {nextMilestone ? (
            <>
              <span className="block truncate">{nextMilestone.title}</span>
              <span className={`text-xs font-medium ${nextOverdue ? "text-red-600" : "text-black/45"}`}>
                {nextMilestone.dueDate ? formatDateShort(nextMilestone.dueDate) : "ללא תאריך"}
                {nextOverdue && " · באיחור"}
              </span>
            </>
          ) : (
            <span className="text-black/40">—</span>
          )}
        </StatButton>
        <StatButton
          onClick={() => openProjectTab("tasks")}
          icon={<ListChecks size={15} />}
          label="משימות באיחור"
          tone={overdueTasks > 0 ? "danger" : "default"}
        >
          <span className="text-xl">{overdueTasks}</span>
        </StatButton>
        <StatButton
          onClick={() => openProjectTab("finance")}
          icon={<Wallet size={15} />}
          label="שכר טרחה שנגבה"
        >
          {fee ? (
            <>
              <span>
                {formatMoney(fee.collected)}
                <span className="text-sm font-normal text-black/45"> מתוך {formatMoney(fee.total)}</span>
              </span>
              <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-black/5">
                <span
                  className="block h-full rounded-full bg-green-500"
                  style={{ width: `${Math.min(100, Math.round((fee.collected / fee.total) * 100))}%` }}
                />
              </span>
            </>
          ) : (
            <span className="text-sm font-normal text-black/40">לא הוגדר</span>
          )}
        </StatButton>
      </div>

      {/* Client and address */}
      <div className="grid grid-cols-1 gap-3 border-t border-black/5 pt-4 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-1.5 text-xs text-black/40">
            <UserRound size={13} />
            לקוח
          </p>
          {clients.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {clients.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <ContactCardModal
                    contact={c}
                    projectNames={c.projectNames}
                    trigger={
                      <button type="button" className="min-w-0 text-right text-sm font-semibold text-brand-700 hover:underline">
                        {c.name}
                        {c.company && <span className="font-normal text-black/45"> · {c.company}</span>}
                      </button>
                    }
                  />
                  <ContactLinks contact={c} size="sm" />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-medium text-brand-900">{project.client ?? "—"}</span>
              <TabLink tab="contacts" className="text-xs font-medium text-brand-600 hover:underline">
                {project.client ? "קישור לכרטיס איש קשר" : "הוספת לקוח"}
              </TabLink>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-1.5 text-xs text-black/40">
            <MapPin size={13} />
            כתובת
          </p>
          {address ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-brand-900">{address}</span>
              {waze && (
                <a
                  href={waze}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-sky-50 px-3 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  <Navigation size={14} />
                  Waze
                </a>
              )}
            </div>
          ) : (
            <span className="text-sm text-black/40">—</span>
          )}
        </div>
      </div>

      {/* Other details */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-black/50">
        <span className="inline-flex items-center gap-1">
          <Calendar size={12} />
          התחלה: {formatDate(project.startDate) ?? "—"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar size={12} />
          יעד לסיום: {formatDate(project.endDate) ?? "—"}
        </span>
        {project.budget != null && (
          <span className="inline-flex items-center gap-1">
            <Wallet size={12} />
            תקציב: {formatMoney(project.budget)}
          </span>
        )}
      </div>
      {project.description && (
        <p className="whitespace-pre-line text-sm text-black/60">{project.description}</p>
      )}

      <Modal title="עריכת פרויקט" open={editOpen} onOpenChange={setEditOpen}>
        {(close) => <ProjectForm project={project} users={users} onClose={close} />}
      </Modal>
      <Modal title="מחיקת פרויקט לצמיתות" open={deleteOpen} onOpenChange={setDeleteOpen}>
        {(close) => <DeleteProjectForm project={project} onCancel={close} onArchive={() => { close(); toggleArchive(); }} />}
      </Modal>
    </div>
  );
}

function StatButton({
  icon,
  label,
  tone = "default",
  onClick,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "default" | "danger";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded-xl border p-3 text-right transition hover:shadow-sm ${
        tone === "danger" ? "border-red-200 bg-red-50/60" : "border-black/5 bg-black/[0.02] hover:bg-black/[0.04]"
      }`}
    >
      <span className={`mb-1 flex items-center gap-1.5 text-xs ${tone === "danger" ? "text-red-600" : "text-black/45"}`}>
        {icon}
        {label}
      </span>
      <span className="block text-base font-bold text-brand-900">{children}</span>
    </button>
  );
}

/**
 * Second confirmation for a full delete (SPEC §3.4): the first was choosing
 * "מחיקה לצמיתות" in the ⋯ menu; here the name must be typed exactly.
 */
function DeleteProjectForm({
  project,
  onCancel,
  onArchive,
}: {
  project: Project;
  onCancel: () => void;
  onArchive: () => void;
}) {
  const onResult = useActionResult();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const matches = typed.trim() === project.name.trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <p>
          המחיקה סופית ולא ניתן לשחזר אותה. יימחקו גם כל המשימות, השלבים, העדכונים, המסמכים, לוח הגבייה ושאר הנתונים של הפרויקט.
        </p>
      </div>
      {!project.archivedAt && (
        <p className="text-sm text-black/60">
          רוצים רק להוציא אותו מהרשימה?{" "}
          <button type="button" onClick={onArchive} className="font-semibold text-brand-600 hover:underline">
            העבר לארכיון במקום
          </button>
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-sm text-brand-900">
        <span>
          לאישור, הקלידו את שם הפרויקט: <span className="font-bold">{project.name}</span>
        </span>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!matches || pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = onResult(await deleteProject(project.id, typed));
              if (res?.error) setError(res.error);
            })
          }
          className="flex min-h-10 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 size={14} />
          {pending ? "מוחק..." : "מחיקה לצמיתות"}
        </button>
        <button type="button" onClick={onCancel} className="min-h-10 rounded-lg px-4 text-sm text-black/60 hover:bg-black/5">
          ביטול
        </button>
      </div>
    </div>
  );
}
