import { redirect } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "לחשבון הזה אין הרשאת כניסה למערכת.",
  denied: "ההתחברות בוטלה. נסו שוב.",
  state: "פג תוקף ניסיון ההתחברות. נסו שוב.",
  failed: "ההתחברות עם Google נכשלה. נסו שוב.",
  not_configured:
    "ההתחברות עם Google עוד לא הוגדרה בשרת (חסרים משתני סביבה, ראו README).",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  // A valid session is checked here (not in the proxy) because it needs the
  // DB: a cookie for a user who was removed from the allow-list must still
  // land on this page instead of bouncing back and forth.
  if (await getCurrentUser()) redirect("/dashboard");

  const { error, email } = await searchParams;
  const message = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.failed) : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size="lg" variant="black" />
          <p className="text-sm text-black/50">
            מערכת ניהול משימות ופרויקטים
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {message && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <CircleAlert size={16} className="mt-0.5 shrink-0" />
              <div>
                <p>{message}</p>
                {error === "not_allowed" && email && (
                  <p className="mt-0.5 text-xs text-red-600/80" dir="ltr">
                    {email}
                  </p>
                )}
              </div>
            </div>
          )}

          <GoogleSignInButton />

          <p className="text-center text-xs text-black/40">
            הכניסה מותרת רק לחשבונות המורשים של כתר הנדסה
          </p>
        </div>
      </div>
    </main>
  );
}
