"use client";

import { Building2, MapPin, Wallet, Calendar, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { ProjectForm } from "@/components/projects/project-form";
import { deleteProject } from "@/lib/actions/projects";
import { projectStatusMeta } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Project } from "@prisma/client";

export function ProjectHeader({ project }: { project: Project }) {
  const status = projectStatusMeta(project.status);

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Building2 size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-brand-900">
                {project.name}
              </h1>
              <Badge className={status.badge}>{status.label}</Badge>
            </div>
            {project.client && (
              <p className="mt-1 text-sm text-black/50">
                לקוח: {project.client}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Modal
            title="עריכת פרויקט"
            trigger={
              <button className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3.5 py-2 text-sm font-medium text-brand-900 transition hover:bg-black/5">
                <Pencil size={14} />
                עריכה
              </button>
            }
          >
            {(close) => <ProjectForm project={project} onClose={close} />}
          </Modal>
          <button
            onClick={() => {
              if (
                confirm(
                  `למחוק את הפרויקט "${project.name}"? פעולה זו תמחק גם את כל המשימות ואבני הדרך המשויכות.`
                )
              ) {
                deleteProject(project.id);
              }
            }}
            className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <Trash2 size={14} />
            מחיקה
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-black/5 pt-5 sm:grid-cols-4">
        <InfoItem
          icon={<MapPin size={14} />}
          label="כתובת"
          value={project.address ?? "—"}
        />
        <InfoItem
          icon={<Wallet size={14} />}
          label="תקציב"
          value={
            project.budget
              ? `₪${project.budget.toLocaleString("he-IL")}`
              : "—"
          }
        />
        <InfoItem
          icon={<Calendar size={14} />}
          label="תאריך התחלה"
          value={formatDate(project.startDate) ?? "—"}
        />
        <InfoItem
          icon={<Calendar size={14} />}
          label="יעד לסיום"
          value={formatDate(project.endDate) ?? "—"}
        />
      </div>

      {project.description && (
        <p className="mt-4 whitespace-pre-line border-t border-black/5 pt-4 text-sm text-black/60">
          {project.description}
        </p>
      )}
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-black/40">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-brand-900">{value}</p>
    </div>
  );
}
