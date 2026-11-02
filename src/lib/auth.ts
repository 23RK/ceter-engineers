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
 * request, via `cache`). A session is rejected if the user no longer has an
 * email + password, or if the password changed after this session signed in.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      color: true,
      passwordHash: true,
      passwordChangedAt: true,
    },
  });
  if (!user?.email || !user.passwordHash) return null;
  if (
    user.passwordChangedAt &&
    Math.floor(user.passwordChangedAt.getTime() / 1000) > session.authTime
  ) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    color: user.color,
  };
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
