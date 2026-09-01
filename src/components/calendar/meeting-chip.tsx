"use client";

import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { MeetingForm } from "@/components/calendar/meeting-form";
import { deleteMeeting } from "@/lib/actions/meetings";
import { formatTime } from "@/lib/format";
import type { Meeting } from "@prisma/client";

export function MeetingChip({ meeting }: { meeting: Meeting }) {
  return (
    <Modal title="עריכת פגישה" trigger={<MeetingChipView meeting={meeting} />}>
      {(close) => (
        <MeetingForm meeting={meeting} onClose={close} />
      )}
    </Modal>
  );
}

function MeetingChipView({ meeting }: { meeting: Meeting }) {
  return (
    <div className="group flex w-full cursor-pointer items-center gap-1.5 rounded-md bg-brand-50 px-1.5 py-1 text-right text-xs text-brand-800 transition hover:bg-brand-100">
      <span className="shrink-0 font-medium" dir="ltr">
        {formatTime(meeting.startTime)}
      </span>
      <span className="truncate">{meeting.title}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`למחוק את הפגישה "${meeting.title}"?`)) {
            deleteMeeting(meeting.id);
          }
        }}
        className="mr-auto shrink-0 rounded p-0.5 text-brand-400 opacity-0 transition hover:bg-brand-200 hover:text-brand-700 group-hover:opacity-100"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}
