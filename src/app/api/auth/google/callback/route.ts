import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  exchangeCode,
  hasCalendarConnection,
  saveCalendarTokens,
} from "@/lib/google/oauth";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/session";
import { OAUTH_COOKIE, OAUTH_COOKIE_OPTIONS, parseOAuthCookie } from "@/lib/oauth-state";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const flow = parseOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);

  const redirect = (path: string, params: Record<string, string> = {}) => {
    const url = new URL(path, request.url);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const response = NextResponse.redirect(url);
    response.cookies.set(OAUTH_COOKIE, "", { ...OAUTH_COOKIE_OPTIONS, maxAge: 0 });
    return response;
  };

  // `state` must match the one we set right before sending the browser to
  // Google - rejects forged / replayed callbacks.
  if (!flow || searchParams.get("state") !== flow.state) {
    return redirect("/login", { error: "state" });
  }

  // Where a failed calendar grant lands: the user is already signed in by
  // then, so send them to Settings where they can retry.
  const calendarFailure = (reason: string) =>
    redirect("/settings", { calendar_error: reason });

  const code = searchParams.get("code");
  if (searchParams.get("error") || !code) {
    return flow.mode === "calendar"
      ? calendarFailure("denied")
      : redirect("/login", { error: "denied" });
  }

  let result: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    result = await exchangeCode(code);
  } catch (error) {
    console.error("Google OAuth code exchange failed", error);
    return flow.mode === "calendar"
      ? calendarFailure("failed")
      : redirect("/login", { error: "failed" });
  }

  // The allow-list: only emails that belong to a User row may sign in.
  const user = await prisma.user.findUnique({
    where: { email: result.email },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    return redirect("/login", { error: "not_allowed", email: result.email });
  }

  if (flow.mode === "signin") {
    const needsCalendar =
      user.role === "PARTNER" &&
      !(await hasCalendarConnection(user.id, result.email));

    const response = needsCalendar
      ? redirect("/api/auth/google", { mode: "calendar", next: flow.next })
      : redirect(flow.next);
    response.cookies.set(SESSION_COOKIE, await signSession(user.id), SESSION_COOKIE_OPTIONS);
    return response;
  }

  // mode === "calendar": the Google account granting access must be the
  // signed-in user's own account.
  const current = await getCurrentUser();
  if (!current) return redirect("/login");
  if (current.id !== user.id) return calendarFailure("wrong_account");
  if (!result.hasCalendarScope) return calendarFailure("scope");

  try {
    await saveCalendarTokens(user.id, result.email, result.tokens);
  } catch (error) {
    console.error("Saving Google Calendar tokens failed", error);
    return calendarFailure("failed");
  }

  return flow.next === "/settings"
    ? redirect("/settings", { calendar_connected: "1" })
    : redirect(flow.next);
}
