import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  // A valid session is checked here (not in the proxy) because it needs the
  // DB: a cookie that's no longer valid (password changed, user removed)
  // must still land on this page instead of bouncing back and forth.
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size="lg" variant="black" />
          <p className="text-sm text-black/50">מערכת ניהול משימות ופרויקטים</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
