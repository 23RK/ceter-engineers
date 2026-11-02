import type { ContactRole } from "@prisma/client";

/** A contact's role in a project (SPEC §3.4). */
export const CONTACT_ROLES: { value: ContactRole; label: string }[] = [
  { value: "CLIENT", label: "לקוח" },
  { value: "DEVELOPER", label: "יזם" },
  { value: "CONTRACTOR", label: "קבלן מבצע" },
  { value: "ARCHITECT", label: "אדריכל" },
  { value: "ENGINEER", label: "מהנדס" },
  { value: "CONSULTANT", label: "יועץ" },
  { value: "OTHER", label: "אחר" },
];

export function contactRoleLabel(role: ContactRole) {
  return CONTACT_ROLES.find((r) => r.value === role)!.label;
}

export function isContactRole(value: unknown): value is ContactRole {
  return CONTACT_ROLES.some((r) => r.value === value);
}

/** The phone's digits (and a leading +), for a tel: link. */
export function telHref(phone: string | null | undefined) {
  if (!phone) return null;
  const cleaned = phone.trim().replace(/(?!^\+)[^\d]/g, "");
  return cleaned.replace(/\D/g, "").length >= 7 ? `tel:${cleaned}` : null;
}

/**
 * wa.me link (SPEC §1.2). Israeli local numbers (05x...) become 9725x...;
 * numbers already in international form are kept.
 */
export function whatsappHref(phone: string | null | undefined, text?: string) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) {
    // already international
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = `972${digits.slice(1)}`;
  }
  if (digits.length < 9) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Waze navigation to the full address (adds the city when it's not in the address). */
export function wazeHref(address: string | null | undefined, city?: string | null) {
  const a = address?.trim() ?? "";
  const c = city?.trim() ?? "";
  const full = a && c && !a.includes(c) ? `${a}, ${c}` : a || c;
  if (!full) return null;
  return `https://waze.com/ul?q=${encodeURIComponent(full)}&navigate=yes`;
}

/** Full address for display. */
export function fullAddress(address: string | null | undefined, city?: string | null) {
  const a = address?.trim() ?? "";
  const c = city?.trim() ?? "";
  if (a && c && !a.includes(c)) return `${a}, ${c}`;
  return a || c || null;
}
