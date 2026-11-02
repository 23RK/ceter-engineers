import type { Department } from "@prisma/client";

export const DEPARTMENTS: {
  value: Department;
  slug: string;
  label: string;
  short: string;
  badge: string;
}[] = [
  {
    value: "DEVELOPER",
    slug: "developer",
    label: "ניהול ופיקוח – יזמים",
    short: "יזמים",
    badge: "bg-brand-50 text-brand-700",
  },
  {
    value: "VILLA",
    slug: "villa",
    label: "ניהול ופיקוח – וילות",
    short: "וילות",
    badge: "bg-teal-50 text-teal-700",
  },
];

export function departmentMeta(department: Department) {
  return DEPARTMENTS.find((d) => d.value === department)!;
}

export function departmentBySlug(slug: string) {
  return DEPARTMENTS.find((d) => d.slug === slug) ?? null;
}

export function isDepartment(value: unknown): value is Department {
  return DEPARTMENTS.some((d) => d.value === value);
}

/** Where a project lives in the app: its department screen, or the assignment screen. */
export function departmentHref(department: Department | null) {
  return department
    ? `/departments/${departmentMeta(department).slug}`
    : "/projects";
}

// The same unambiguous rules the migration 20261102170000_project_department
// used for automatic assignment. Keep the two in sync.
const VILLA_WORDS = ["וילה", "ווילה", "וילות", "ווילות"];
const DEVELOPER_WORDS = ["יזם", "יזמ"];

const mentions = (text: string, words: string[]) =>
  words.some((w) => text.includes(w));

/** The department the migration would assign automatically, or null. */
export function autoDepartment(name: string): Department | null {
  const villa = mentions(name, VILLA_WORDS);
  const developer = mentions(name, DEVELOPER_WORDS);
  if (villa && !developer) return "VILLA";
  if (developer && !villa) return "DEVELOPER";
  return null;
}

// Weaker hints - only shown as a suggestion on the assignment screen, never
// applied automatically.
const DEVELOPER_HINTS = ['יח"ד', "יח״ד", "דירות", "בניין", "מגורים", "קומות", "מגדל", "תמ\"א", "פינוי בינוי", "בע\"מ"];
const VILLA_HINTS = ["בית פרטי", "צמוד קרקע", "משפחת", "בית מגורים"];

/** A best guess for a project that couldn't be assigned automatically. */
export function suggestDepartment(project: {
  name: string;
  client?: string | null;
  description?: string | null;
}): Department | null {
  const strong = autoDepartment(project.name);
  if (strong) return strong;

  const text = [project.name, project.client, project.description]
    .filter(Boolean)
    .join(" ");
  const villaFromAll = mentions(text, VILLA_WORDS);
  const devFromAll = mentions(text, DEVELOPER_WORDS);
  // Name mentions both (e.g. "וילה ... פיקוח יזם") - let the person decide.
  if (mentions(project.name, VILLA_WORDS) && mentions(project.name, DEVELOPER_WORDS)) {
    return null;
  }
  if (villaFromAll !== devFromAll) return villaFromAll ? "VILLA" : "DEVELOPER";

  const villaHint = mentions(text, VILLA_HINTS);
  const devHint = mentions(text, DEVELOPER_HINTS);
  if (villaHint !== devHint) return villaHint ? "VILLA" : "DEVELOPER";
  return null;
}

/**
 * A name that is only the project type ("פיקוח יזם", "ניהול ופיקוח וילה") -
 * SPEC §3.1: the type is a field, so such a project needs a real name.
 */
export function isGenericProjectName(name: string) {
  const normalized = name.replace(/[–\-_,.]/g, " ").replace(/\s+/g, " ").trim();
  return /^(ניהול ו?פיקוח|ניהול|פיקוח|פרויקט)( (על|של))? ?(ה?יזם|ה?יזמים|יזמי|ה?וו?ילה|ה?וו?ילות)$/.test(
    normalized
  );
}
