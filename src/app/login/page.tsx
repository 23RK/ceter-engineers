import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600 text-2xl font-bold text-white shadow-lg">
            כה
          </div>
          <h1 className="text-xl font-bold text-brand-900">כתר הנדסה</h1>
          <p className="text-sm text-black/50">
            מערכת ניהול משימות ופרויקטים
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
