"use client";

import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { MeetingForm } from "@/components/calendar/meeting-form";

export function AddMeetingButton({
  defaultStart,
  defaultEnd,
  variant = "full",
}: {
  defaultStart: Date;
  defaultEnd: Date;
  variant?: "full" | "icon";
}) {
  return (
    <Modal
      title="פגישה חדשה"
      trigger={
        variant === "full" ? (
          <button className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
            <Plus size={16} />
            פגישה חדשה
          </button>
        ) : (
          <button
            type="button"
            className="rounded-md p-0.5 text-black/20 opacity-0 transition hover:bg-brand-50 hover:text-brand-600 group-hover:opacity-100"
            title="פגישה חדשה"
          >
            <Plus size={13} />
          </button>
        )
      }
    >
      {(close) => (
        <MeetingForm
          defaultStart={defaultStart}
          defaultEnd={defaultEnd}
          onClose={close}
        />
      )}
    </Modal>
  );
}
