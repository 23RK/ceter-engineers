"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePartner, requireSession } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import type { ActionState } from "@/lib/actions/tasks";

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

export async function changeCredentialAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePartner();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newEmail = String(formData.get("newEmail") ?? "")
    .trim()
    .toLowerCase();
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newEmail) {
    return { error: "יש למלא את הסיסמה הנוכחית ואת האימייל" };
  }

  // There's a single shared credential row by design.
  const credential = await prisma.credential.findFirst();
  if (!credential) {
    return { error: "לא נמצא חשבון התחברות" };
  }

  const valid = await bcrypt.compare(currentPassword, credential.passwordHash);
  if (!valid) {
    return { error: "הסיסמה הנוכחית שגויה" };
  }

  if (newPassword && newPassword !== confirmPassword) {
    return { error: "אימות הסיסמה החדשה לא תואם" };
  }
  if (newPassword && newPassword.length < 8) {
    return { error: "הסיסמה החדשה חייבת להכיל לפחות 8 תווים" };
  }

  await prisma.credential.update({
    where: { id: credential.id },
    data: {
      email: newEmail,
      ...(newPassword ? { passwordHash: await bcrypt.hash(newPassword, 10) } : {}),
    },
  });

  return { ok: true, ts: Date.now() };
}
