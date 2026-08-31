import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export type Partner = {
  id: string;
  name: string;
  color: string;
};

// Verifies the shared company login only - does not guarantee a partner
// (רון / גיא) has been picked yet.
export const getSession = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
});

export const getCurrentPartner = cache(async (): Promise<Partner | null> => {
  const session = await getSession();
  if (!session?.partnerId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.partnerId },
    select: { id: true, name: true, color: true },
  });

  return user;
});

/** Requires the shared login only; does not require a partner to be picked. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Requires the shared login AND a partner to have been picked. */
export async function requirePartner(): Promise<Partner> {
  await requireSession();
  const partner = await getCurrentPartner();
  if (!partner) redirect("/choose-user");
  return partner;
}
