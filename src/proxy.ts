import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login"];
const CHOOSE_USER_PATH = "/choose-user";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const isChooseUser =
    pathname === CHOOSE_USER_PATH || pathname.startsWith(`${CHOOSE_USER_PATH}/`);

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Not signed in to the shared company login at all.
  if (!session) {
    return isPublic ? NextResponse.next() : redirectTo(request, "/login");
  }

  // Signed in, but hitting the login page - send them onward.
  if (isPublic) {
    return redirectTo(request, session.partnerId ? "/dashboard" : CHOOSE_USER_PATH);
  }

  // Signed in but no partner (רון / גיא) picked yet - only the picker is allowed.
  if (!session.partnerId && !isChooseUser) {
    return redirectTo(request, CHOOSE_USER_PATH);
  }

  return NextResponse.next();
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
