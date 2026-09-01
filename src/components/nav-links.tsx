"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Building2,
  Handshake,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "לוח בקרה", icon: LayoutDashboard },
  { href: "/tasks", label: "משימות", icon: ListChecks },
  { href: "/projects", label: "פרויקטים", icon: Building2 },
  { href: "/business-dev", label: "פיתוח עסקי", icon: Handshake },
];

export function NavLinks({
  orientation = "vertical",
}: {
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();

  return (
    <nav
      className={`flex gap-1 ${
        orientation === "vertical" ? "flex-col" : "w-full"
      }`}
    >
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
              orientation === "horizontal" ? "flex-1 justify-center" : ""
            } ${
              active
                ? "bg-brand-600 text-white shadow-sm"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={18} strokeWidth={2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
