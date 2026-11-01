"use client";

import { Handshake, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { LeadForm } from "@/components/business-dev/lead-form";
import { deleteLead } from "@/lib/actions/leads";
import { leadStatusMeta } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Lead } from "@prisma/client";

export function LeadHeader({ lead }: { lead: Lead }) {
  const status = leadStatusMeta(lead.status);

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Handshake size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-brand-900">{lead.name}</h1>
              <Badge className={status.badge}>{status.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-black/50">
              עודכן לאחרונה: {formatDate(lead.updatedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Modal
            title="עריכת הזדמנות"
            trigger={
              <button className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3.5 py-2 text-sm font-medium text-brand-900 transition hover:bg-black/5">
                <Pencil size={14} />
                עריכה
              </button>
            }
          >
            {(close) => <LeadForm lead={lead} onClose={close} />}
          </Modal>
          <button
            onClick={() => {
              if (
                confirm(
                  `למחוק את ההזדמנות "${lead.name}"? פעולה זו תמחק גם את כל המשימות המשויכות.`
                )
              ) {
                deleteLead(lead.id);
              }
            }}
            className="flex items-center gap-1.5 rounded-lg border border-black/10 px-3.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <Trash2 size={14} />
            מחיקה
          </button>
        </div>
      </div>

      {lead.notes && (
        <p className="mt-4 whitespace-pre-line border-t border-black/5 pt-4 text-sm text-black/60">
          {lead.notes}
        </p>
      )}
    </div>
  );
}
