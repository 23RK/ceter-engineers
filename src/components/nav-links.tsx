"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, isNavItemActive } from "@/lib/nav";

/** The grouped menu from SPEC §3.1, on the dark sidebar / mobile sheet. */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="px-3.5 pb-1 text-[11px] font-semibold tracking-wide text-white/35">
            {group.title}
          </p>
          {group.items.map((item) => {
            const { href, label, icon: Icon, soon } = item;
            if (soon) {
              return (
                <span
                  key={href}
                  aria-disabled="true"
                  className="flex cursor-default items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium text-white/30"
                >
                  <Icon size={18} strokeWidth={2} />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/50">
                    בקרוב
                  </span>
                </span>
              );
            }
            const active = isNavItemActive(item, pathname);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} strokeWidth={2} />
                <span className="min-w-0 truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
