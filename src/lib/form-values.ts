/** Parsing helpers for Server Actions (plain module - not "use server"). */

export function str(value: FormDataEntryValue | string | null | undefined) {
  const s = typeof value === "string" ? value.trim() : "";
  return s || null;
}

/** A yyyy-mm-dd input value as a date-only Date (UTC midnight), or null. */
export function date(value: FormDataEntryValue | string | null | undefined) {
  const s = str(value);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A number, or null when empty. `undefined` when it isn't a valid number. */
export function num(value: FormDataEntryValue | string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const s = str(value)?.replace(/[,₪\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Only http(s) links are kept, so a link can never run script. */
export function safeUrl(value: FormDataEntryValue | string | null | undefined) {
  const s = str(value);
  if (!s) return null;
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Uploads: Vercel caps a request at 4.5MB, so files are kept below that. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function filesOf(formData: FormData, field = "files") {
  return formData
    .getAll(field)
    .filter((f): f is File => typeof f === "object" && f !== null && "size" in f && f.size > 0);
}

export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
