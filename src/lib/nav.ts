import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  ContactRound,
  Handshake,
  House,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Shorter label for the mobile tab bar. */
  short?: string;
  icon: LucideIcon;
  /** Not built yet: shown disabled with a "בקרוב" tag. */
  soon?: boolean;
};

export type NavGroup = { title: string; items: NavItem[] };

// The sidebar structure from SPEC §3.1 - the single source for the desktop
// sidebar and the mobile "עוד" sheet.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "עבודה יומית",
    items: [
      { href: "/dashboard", label: "לוח בקרה", icon: LayoutDashboard },
      { href: "/tasks", label: "המשימות שלי", short: "משימות", icon: ListChecks },
      { href: "/calendar", label: "יומן", icon: CalendarDays },
    ],
  },
  {
    title: "מחלקות",
    items: [
      {
        href: "/departments/developer",
        label: "ניהול ופיקוח – יזמים",
        short: "יזמים",
        icon: Building2,
      },
      {
        href: "/departments/villa",
        label: "ניהול ופיקוח – וילות",
        short: "וילות",
        icon: House,
      },
      { href: "/inspections", label: "בדק בית", icon: ClipboardCheck, soon: true },
    ],
  },
  {
    title: "עסק",
    items: [
      { href: "/business-dev", label: "פיתוח עסקי", icon: Handshake },
      { href: "/contacts", label: "לקוחות ואנשי קשר", icon: ContactRound, soon: true },
    ],
  },
];

/** The always-visible items of the mobile bottom bar (plus "עוד"). */
export const MOBILE_TABS: NavItem[] = NAV_GROUPS[0].items;

export function isNavItemActive(item: NavItem, pathname: string) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
