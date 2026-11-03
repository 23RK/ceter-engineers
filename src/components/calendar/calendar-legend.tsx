import { ClipboardCheck, CloudOff, Lock, Users } from "lucide-react";
import type { UserOption } from "@/lib/types";

export function CalendarLegend({ partners }: { partners: UserOption[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-black/50">
      {partners.map((partner) => (
        <span key={partner.id} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: partner.color }}
          />
          {partner.name}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <Users size={12} className="text-brand-400" />
        פגישה משותפת
      </span>
      <span className="flex items-center gap-1.5">
        <Lock size={12} />
        פרטי (&quot;תפוס&quot;)
      </span>
      <span className="flex items-center gap-1.5">
        <CloudOff size={12} className="text-amber-600" />
        עוד לא נכתב ל-Google
      </span>
      <span className="flex items-center gap-1.5">
        <ClipboardCheck size={12} />
        בדק בית
      </span>
    </div>
  );
}
