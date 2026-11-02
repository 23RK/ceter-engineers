// Short-lived cookie carrying the OAuth `state` (CSRF protection) and the id
// of the user who started the calendar connection, between the redirect to
// Google and the callback.
export const OAUTH_COOKIE = "keter_oauth";

export type OAuthCookie = { state: string; userId: string };

export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/google",
  maxAge: 10 * 60,
};

export function parseOAuthCookie(value: string | undefined): OAuthCookie | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed.state === "string" && typeof parsed.userId === "string") {
      return { state: parsed.state, userId: parsed.userId };
    }
  } catch {
    // fall through
  }
  return null;
}
