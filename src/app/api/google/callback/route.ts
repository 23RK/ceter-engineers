import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { calendarConnectDeps } from "@/lib/google/oauth";
import { completeCalendarConnection } from "@/lib/google/calendar-access";
import { OAUTH_COOKIE, OAUTH_COOKIE_OPTIONS, parseOAuthCookie } from "@/lib/oauth-state";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const toSettings = (params: Record<string, string>) => {
    const url = new URL("/settings", request.url);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = NextResponse.redirect(url);
    response.cookies.set(OAUTH_COOKIE, "", { ...OAUTH_COOKIE_OPTIONS, maxAge: 0 });
    return response;
  };

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // `state` must match the cookie set when THIS user started the flow -
  // rejects forged / replayed callbacks and flows started by someone else.
  const flow = parseOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  if (!flow || searchParams.get("state") !== flow.state || flow.userId !== user.id) {
    return toSettings({ calendar_error: "state" });
  }

  const code = searchParams.get("code");
  if (searchParams.get("error") || !code) {
    return toSettings({ calendar_error: "denied" });
  }

  const outcome = await completeCalendarConnection(
    { code, appUser: { id: user.id, email: user.email } },
    calendarConnectDeps
  );

  if (!outcome.ok) {
    if (outcome.error !== "failed" && outcome.googleEmail) {
      console.warn(
        `Rejected Google Calendar connection for user ${user.id}: ${outcome.error} (${outcome.googleEmail})`
      );
    }
    return toSettings({
      calendar_error: outcome.error,
      ...(outcome.googleEmail ? { google_email: outcome.googleEmail } : {}),
    });
  }
  return toSettings({ calendar_connected: "1" });
}
