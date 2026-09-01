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
        <span className="h-2 w-2 rounded-full bg-slate-400" />
        מקור לא ידוע
      </span>
    </div>
  );
}
