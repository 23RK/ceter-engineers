import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGoogleAuthUrl, missingGoogleEnv } from "@/lib/google/oauth";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_OPTIONS,
  safeNextPath,
  type OAuthCookie,
} from "@/lib/oauth-state";

/**
 * Starts the Google OAuth flow.
 *   /api/auth/google                 -> sign in
 *   /api/auth/google?mode=calendar   -> grant calendar access (partners, signed in)
 */
export async function GET(request: NextRequest) {
  if (missingGoogleEnv().length > 0) {
    return NextResponse.redirect(new URL("/login?error=not_configured", request.url));
  }

  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("mode") === "calendar" ? "calendar" : "signin";
  const next = safeNextPath(searchParams.get("next"));

  let loginHint: string | undefined;
  if (mode === "calendar") {
    const user = await getCurrentUser();
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    if (user.role !== "PARTNER") {
      return NextResponse.redirect(new URL("/settings", request.url));
    }
    loginHint = user.email;
  }

  const state = randomBytes(16).toString("hex");
  const cookie: OAuthCookie = { state, mode, next };

  const response = NextResponse.redirect(
    getGoogleAuthUrl({ mode, state, loginHint })
  );
  response.cookies.set(OAUTH_COOKIE, JSON.stringify(cookie), OAUTH_COOKIE_OPTIONS);
  return response;
}
