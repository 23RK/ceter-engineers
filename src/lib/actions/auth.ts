"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "יש למלא אימייל וסיסמה" };
  }

  const credential = await prisma.credential.findUnique({ where: { email } });
  if (!credential) {
    return { error: "אימייל או סיסמה שגויים" };
  }

  const valid = await bcrypt.compare(password, credential.passwordHash);
  if (!valid) {
    return { error: "אימייל או סיסמה שגויים" };
  }

  // Signed in with the shared company login - no partner picked yet.
  const token = await signSession({});
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/choose-user");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function selectPartnerAction(partnerId: string) {
  await requireSession();

  const partner = await prisma.user.findUnique({ where: { id: partnerId } });
  if (!partner) return;

  const token = await signSession({ partnerId });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/dashboard");
}
