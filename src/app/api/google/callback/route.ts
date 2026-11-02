import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { blockingConfigIssues, calendarConnectDeps } from "@/lib/google/oauth";
import { completeCalendarConnection } from "@/lib/google/calendar-access";
import { googleErrorCode, safeErrorDetail } from "@/lib/google/env";
import { OAUTH_COOKIE, OAUTH_COOKIE_OPTIONS, parseOAuthCookie } from "@/lib/oauth-state";

/** One log line per failure - ids, step and Google's error code only, never tokens or the code. */
function logFailure(userId: string | null, step: string, detail: string) {
  console.error(`[google-calendar] connect failed: user=${userId ?? "-"} step=${step} detail=${detail}`);
}

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
  if (!user) {
    logFailure(null, "session", "not signed in when Google redirected back");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // `state` must match the cookie set when THIS user started the flow -
  // rejects forged / replayed callbacks and flows started by someone else.
  const flow = parseOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  if (!flow || searchParams.get("state") !== flow.state || flow.userId !== user.id) {
    logFailure(
      user.id,
      "state",
      !flow ? "state cookie missing or expired" : flow.userId !== user.id ? "flow started by another user" : "state mismatch"
    );
    return toSettings({ calendar_error: "state" });
  }

  const googleError = searchParams.get("error");
  const code = searchParams.get("code");
  if (googleError || !code) {
    logFailure(user.id, "consent", googleError ? `google returned error=${googleError.slice(0, 60)}` : "no code");
    return toSettings({ calendar_error: "denied" });
  }

  const issues = blockingConfigIssues();
  if (issues.length) {
    logFailure(user.id, "config", issues.map((i) => `${i.name}: ${i.problem}`).join("; "));
    return toSettings({ calendar_error: "config" });
  }

  const outcome = await completeCalendarConnection(
    { code, appUser: { id: user.id, email: user.email } },
    calendarConnectDeps
  );

  if (!outcome.ok) {
    if ("step" in outcome) {
      logFailure(user.id, outcome.step, safeErrorDetail(outcome.cause));
      const gcode = googleErrorCode(outcome.cause);
      return toSettings({
        calendar_error: outcome.error,
        calendar_step: outcome.step,
        ...(gcode ? { calendar_code: gcode } : {}),
      });
    }
    console.warn(
      `[google-calendar] rejected account: user=${user.id} reason=${outcome.error}${outcome.googleEmail ? ` google=${outcome.googleEmail}` : ""}`
    );
    return toSettings({
      calendar_error: outcome.error,
      ...(outcome.googleEmail ? { google_email: outcome.googleEmail } : {}),
    });
  }
  console.info(`[google-calendar] connected: user=${user.id}`);
  return toSettings({ calendar_connected: "1" });
}
