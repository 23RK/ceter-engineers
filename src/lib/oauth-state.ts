import type { OAuthMode } from "@/lib/google/oauth";

// Short-lived cookie carrying the OAuth `state` (CSRF protection) and where
// to land afterwards, between the redirect to Google and the callback.
export const OAUTH_COOKIE = "keter_oauth";

export type OAuthCookie = { state: string; mode: OAuthMode; next: string };

export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth/google",
  maxAge: 10 * 60,
};

/** Only allow same-site relative paths, so `next` can't become an open redirect. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

export function parseOAuthCookie(value: string | undefined): OAuthCookie | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (
      typeof parsed.state === "string" &&
      (parsed.mode === "signin" || parsed.mode === "calendar") &&
      typeof parsed.next === "string"
    ) {
      return { ...parsed, next: safeNextPath(parsed.next) };
    }
  } catch {
    // fall through
  }
  return null;
}
