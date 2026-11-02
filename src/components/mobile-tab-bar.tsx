"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, Settings, X } from "lucide-react";
import { MOBILE_TABS, isNavItemActive } from "@/lib/nav";
import { NavLinks } from "@/components/nav-links";
import { LogoutButton } from "@/components/logout-button";

/**
 * Mobile navigation (SPEC §1.2): a fixed bottom bar with the daily-work
 * screens, and "עוד" opening the full grouped menu as a bottom sheet.
 */
export function MobileTabBar({
  user,
}: {
  user: { name: string; color: string; roleLabel: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const inTabs = MOBILE_TABS.some((t) => isNavItemActive(t, pathname));
  const close = () => setOpen(false);

  const tabClass = (active: boolean) =>
    `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
      active ? "text-brand-400" : "text-white/60 active:text-white"
    }`;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="תפריט"
            className="animate-fade-in absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-brand-950 px-4 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5 px-1.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name.slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-white/40">
                    {user.roleLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-2.5 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="סגירה"
              >
                <X size={20} />
              </button>
            </div>

            <NavLinks onNavigate={close} />

            <div className="mt-4 flex flex-col gap-1 border-t border-white/10 pt-3">
              <Link
                href="/settings"
                onClick={close}
                className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <Settings size={18} />
                הגדרות
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="ניווט ראשי"
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-white/10 bg-brand-950 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {MOBILE_TABS.map((item) => {
          const Icon = item.icon;
          const active = !open && isNavItemActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              aria-current={active ? "page" : undefined}
              className={tabClass(active)}
            >
              <Icon size={21} strokeWidth={2} />
              {item.short ?? item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={tabClass(open || !inTabs)}
        >
          <Ellipsis size={21} strokeWidth={2} />
          עוד
        </button>
      </nav>
    </>
  );
}
