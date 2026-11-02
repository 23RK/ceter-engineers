"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  verifyAgainstDummy,
  verifyPassword,
} from "@/lib/password";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/session";
import { disconnectCalendar } from "@/lib/google/oauth";
import type { ActionState } from "@/lib/actions/tasks";
import { revalidatePath } from "next/cache";

export type LoginState = { error?: string; email?: string };

const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;
const WRONG_CREDENTIALS = "אימייל או סיסמה שגויים";

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "יש למלא אימייל וסיסמה", email };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, failedLoginCount: true, lockedUntil: true },
  });

  if (!user?.passwordHash) {
    await verifyAgainstDummy(password);
    return { error: WRONG_CREDENTIALS, email };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return {
      error: `יותר מדי ניסיונות כניסה שגויים. נסו שוב בעוד ${minutes} דקות.`,
      email,
    };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data:
        failed >= MAX_FAILED_LOGINS
          ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
          : { failedLoginCount: failed },
    });
    return { error: WRONG_CREDENTIALS, email };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(user.id), SESSION_COOKIE_OPTIONS);
  redirect("/dashboard");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

/** Changes the signed-in user's own password and signs out their other devices. */
export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const current = await requireUser();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) {
    return { error: "יש למלא את הסיסמה הנוכחית ואת הסיסמה החדשה" };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `הסיסמה החדשה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים` };
  }
  if (newPassword !== confirmPassword) {
    return { error: "אימות הסיסמה החדשה לא תואם" };
  }

  const user = await prisma.user.findUnique({
    where: { id: current.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return { error: "הסיסמה הנוכחית שגויה" };
  }

  const changedAt = new Date();
  await prisma.user.update({
    where: { id: current.id },
    data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: changedAt },
  });

  // Every older session (other devices) is now rejected; keep this one.
  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    await signSession(current.id, Math.ceil(changedAt.getTime() / 1000)),
    SESSION_COOKIE_OPTIONS
  );

  return { ok: true, ts: Date.now() };
}

export async function disconnectCalendarAction() {
  const user = await requireUser();
  await disconnectCalendar(user.id);
  revalidatePath("/settings");
}
