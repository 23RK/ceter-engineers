import { createHash } from "node:crypto";

// Reading the Google / encryption settings safely. Values pasted into Vercel
// often carry surrounding quotes (as written in .env.example) or a trailing
// space / newline - both break the OAuth client secret and the encryption
// key without any visible error. Nothing here ever returns or logs a value.

/** An environment value without surrounding whitespace or quotes. */
export function cleanEnvValue(raw: string | undefined | null): string {
  let v = (raw ?? "").trim();
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

export function env(name: string) {
  return cleanEnvValue(process.env[name]);
}

const HEX64 = /^[0-9a-fA-F]{64}$/;

/**
 * The 32-byte AES key. The documented format is 64 hex characters; any other
 * value of 32+ characters (e.g. a password-style string, as an old code
 * comment suggested) is turned into a key with SHA-256 instead of failing.
 */
export function encryptionKeyFrom(value: string): { key: Buffer; derived: boolean } {
  if (HEX64.test(value)) return { key: Buffer.from(value, "hex"), derived: false };
  if (value.length >= 32) return { key: createHash("sha256").update(value, "utf8").digest(), derived: true };
  throw new Error("TOKEN_ENCRYPTION_KEY is too short (needs 64 hex characters)");
}

export type ConfigIssue = { name: string; problem: string; blocking: boolean };

/** What's wrong with the Google calendar settings - names and problems only, never values. */
export function googleConfigIssues(get: (name: string) => string | undefined = (n) => process.env[n]): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  for (const name of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "APP_URL", "TOKEN_ENCRYPTION_KEY"]) {
    const raw = get(name);
    const v = cleanEnvValue(raw);
    if (!v) {
      issues.push({ name, problem: "חסר", blocking: true });
      continue;
    }
    if (raw !== v) {
      issues.push({ name, problem: "יש בו רווחים או מרכאות מסביב לערך (המערכת מתעלמת מהם, אבל כדאי לתקן)", blocking: false });
    }
  }
  const id = cleanEnvValue(get("GOOGLE_CLIENT_ID"));
  if (id && !id.endsWith(".apps.googleusercontent.com")) {
    issues.push({ name: "GOOGLE_CLIENT_ID", problem: "צריך להסתיים ב-.apps.googleusercontent.com", blocking: true });
  }
  const url = cleanEnvValue(get("APP_URL"));
  if (url) {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.hostname !== "localhost") {
        issues.push({ name: "APP_URL", problem: "צריך להתחיל ב-https://", blocking: true });
      }
      if (u.pathname.replace(/\/$/, "") !== "") {
        issues.push({ name: "APP_URL", problem: "צריך להיות רק כתובת האתר, בלי נתיב", blocking: true });
      }
    } catch {
      issues.push({ name: "APP_URL", problem: "לא כתובת תקינה (לדוגמה https://ceter-engineers.vercel.app)", blocking: true });
    }
  }
  const key = cleanEnvValue(get("TOKEN_ENCRYPTION_KEY"));
  if (key && !HEX64.test(key)) {
    issues.push(
      key.length >= 32
        ? { name: "TOKEN_ENCRYPTION_KEY", problem: "אינו 64 תווים הקסדצימליים. המערכת גוזרת ממנו מפתח תקין, אבל מומלץ להחליף (openssl rand -hex 32)", blocking: false }
        : { name: "TOKEN_ENCRYPTION_KEY", problem: "קצר מדי. צריך 64 תווים הקסדצימליים (openssl rand -hex 32)", blocking: true }
    );
  }
  return issues;
}

/**
 * A short, safe description of an error for logs and the settings message:
 * Google's error code (e.g. invalid_client), a status, or an error code -
 * never tokens, codes or secrets (long token-like strings are masked).
 */
export function safeErrorDetail(e: unknown): string {
  const err = e as {
    message?: string;
    code?: string | number;
    status?: number;
    response?: { status?: number; data?: { error?: unknown; error_description?: unknown } };
  };
  const parts: string[] = [];
  const data = err?.response?.data;
  const status = err?.response?.status ?? err?.status;
  if (status) parts.push(String(status));
  if (typeof data?.error === "string") parts.push(data.error);
  if (typeof data?.error_description === "string") parts.push(data.error_description);
  if (parts.length === 0 || (!data && err?.message)) {
    if (err?.code !== undefined) parts.push(String(err.code));
    if (err?.message) parts.push(err.message.split("\n")[0]);
  }
  return parts
    .join(" ")
    .replace(/[A-Za-z0-9_\-./+=]{24,}/g, "[…]")
    .slice(0, 200);
}

/** The Google error code alone (e.g. invalid_grant), for the settings page. */
export function googleErrorCode(e: unknown): string | null {
  const code = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof code === "string" && /^[a-z_]{3,40}$/.test(code) ? code : null;
}
