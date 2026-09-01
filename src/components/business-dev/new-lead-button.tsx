"use client";

import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { LeadForm } from "@/components/business-dev/lead-form";

export function NewLeadButton() {
  return (
    <Modal
      title="הזדמנות חדשה"
      trigger={
        <button className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
          <Plus size={16} />
          הזדמנות חדשה
        </button>
      }
    >
      {(close) => <LeadForm onClose={close} />}
    </Modal>
  );
}
