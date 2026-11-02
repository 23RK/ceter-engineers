import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCalendarAuthUrl, isGoogleConfigured } from "@/lib/google/oauth";
import { SYNCABLE_GOOGLE_ACCOUNTS } from "@/lib/google/calendar-access";
import { OAUTH_COOKIE, OAUTH_COOKIE_OPTIONS, type OAuthCookie } from "@/lib/oauth-state";

/** "חיבור יומן Google" in Settings - starts the calendar consent flow. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const settings = (error: string) =>
    NextResponse.redirect(new URL(`/settings?calendar_error=${error}`, request.url));

  if (!isGoogleConfigured()) return settings("not_configured");
  if (!SYNCABLE_GOOGLE_ACCOUNTS.includes(user.email)) return settings("not_syncable");

  const cookie: OAuthCookie = { state: randomBytes(16).toString("hex"), userId: user.id };
  const response = NextResponse.redirect(
    getCalendarAuthUrl({ state: cookie.state, email: user.email })
  );
  response.cookies.set(OAUTH_COOKIE, JSON.stringify(cookie), OAUTH_COOKIE_OPTIONS);
  return response;
}
