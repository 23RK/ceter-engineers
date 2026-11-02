import Link from "next/link";
import { BarChart3, LayoutList, Settings, Wallet } from "lucide-react";

const TABS = [
  { key: "board", href: "/inspections", label: "לוח בדיקות", icon: LayoutList },
  { key: "summary", href: "/inspections/summary", label: "סיכום ורווחיות", icon: BarChart3 },
  { key: "payouts", href: "/inspections/payouts", label: "תשלומים לבודקים", icon: Wallet },
  { key: "settings", href: "/settings/inspections", label: "הגדרות", icon: Settings },
] as const;

/** The בדק בית screens (SPEC §4.3). */
export function InspectionsNav({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="בדק בית" className="-mx-4 flex gap-1 overflow-x-auto border-b border-black/10 px-4 md:mx-0 md:px-0">
      {TABS.map((t) => {
        const Icon = t.icon;
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`-mb-px flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition ${
              on ? "border-brand-600 text-brand-700" : "border-transparent text-black/50 hover:text-brand-900"
            }`}
          >
            <Icon size={15} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
