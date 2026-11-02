import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  shouldRenewSession,
  signSession,
  verifySessionToken,
} from "@/lib/session";

const PUBLIC_PATHS = ["/login"];

// A coarse, cookie-only gate. The real check (does this user still exist,
// was the password changed since?) happens against the DB in requireUser(),
// which every page and Server Action calls.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return isPublic
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();
  // Sliding expiry: keep people signed in on their device while they use it.
  if (shouldRenewSession(session)) {
    response.cookies.set(
      SESSION_COOKIE,
      await signSession(session.userId, session.authTime),
      SESSION_COOKIE_OPTIONS
    );
  }
  return response;
}

export const config = {
  matcher: [
    // Icons and the PWA manifest are public (browsers fetch the manifest
    // without cookies, so a redirect to /login would break "add to home screen").
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
