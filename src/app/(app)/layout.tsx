import Link from "next/link";
import { Settings } from "lucide-react";
import { ROLE_LABELS, requireUser } from "@/lib/auth";
import { NavLinks } from "@/components/nav-links";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { LogoutButton } from "@/components/logout-button";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { prisma } from "@/lib/prisma";
import { ToastProvider } from "@/components/ui/toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const unread = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  return (
    <ToastProvider>
    <div className="min-h-screen bg-background md:flex">
      {/* Sidebar - desktop */}
      <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto bg-brand-950 px-4 py-6 md:sticky md:top-0 md:flex md:h-screen">
        <div className="mb-8 flex items-start justify-between gap-2 px-1.5">
          <Logo size="md" />
          <NotificationBell count={unread} />
        </div>

        <div className="pb-6">
          <NavLinks />
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2.5 px-1.5 py-1">
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
                {ROLE_LABELS[user.role]}
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <Settings size={16} />
            הגדרות
          </Link>
          <LogoutButton />
        </div>
      </aside>

      {/* Top bar - mobile (navigation is in the bottom bar) */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-brand-950 px-4 py-3 md:hidden">
        <Logo size="sm" />
        <div className="flex items-center gap-1">
          <NotificationBell count={unread} />
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.slice(0, 2)}
          </span>
        </div>
      </header>
      <MobileTabBar
        user={{
          name: user.name,
          color: user.color,
          roleLabel: ROLE_LABELS[user.role],
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
