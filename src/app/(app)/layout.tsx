import { requireUser } from "@/lib/auth";
import { NavLinks } from "@/components/nav-links";
import { LogoutButton } from "@/components/logout-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Sidebar - desktop */}
      <aside className="hidden w-64 shrink-0 flex-col bg-brand-950 px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-3 px-1.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            כה
          </div>
          <div>
            <p className="text-sm font-bold text-white">כתר הנדסה</p>
            <p className="text-xs text-white/50">ניהול ופיקוח פרויקטים</p>
          </div>
        </div>

        <NavLinks />

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
              <p className="truncate text-xs text-white/40" dir="ltr">
                {user.email}
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Top bar - mobile */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-brand-950 px-4 py-3 md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
            כה
          </div>
          <p className="text-sm font-bold text-white">כתר הנדסה</p>
        </div>
        <LogoutButton />
      </header>
      <nav className="sticky top-[52px] z-20 flex gap-1 overflow-x-auto bg-brand-900 px-3 py-2 md:hidden">
        <NavLinks orientation="horizontal" />
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
