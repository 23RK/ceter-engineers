"use client";

import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { ProjectForm } from "@/components/projects/project-form";
import type { Department } from "@prisma/client";
import type { UserOption } from "@/lib/types";

export function NewProjectButton({
  department,
  users,
}: {
  department?: Department;
  users: UserOption[];
}) {
  return (
    <Modal
      title="פרויקט חדש"
      trigger={
        <button className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
          <Plus size={16} />
          פרויקט חדש
        </button>
      }
    >
      {(close) => (
        <ProjectForm
          defaultDepartment={department}
          users={users}
          onClose={close}
        />
      )}
    </Modal>
  );
}
