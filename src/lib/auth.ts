import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  color: string;
};

export const getSession = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
});

/**
 * The signed-in user, re-read from the DB on every request (once per
 * request, via `cache`) - so removing someone's email from the User table
 * locks them out immediately, even with a still-valid session cookie.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, color: true },
  });
  if (!user?.email) return null;

  return { ...user, email: user.email };
});

/** Every page and Server Action calls this - the proxy alone isn't enough. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "מנהל מערכת",
  PARTNER: "שותף",
};
