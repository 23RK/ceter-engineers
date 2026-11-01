import { CalendarDays, CircleAlert, CircleCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS, requireUser } from "@/lib/auth";

const CALENDAR_ERRORS: Record<string, string> = {
  denied: "לא ניתנה הרשאה ליומן Google.",
  scope: "ההרשאה ליומן לא סומנה במסך האישור של Google. יש לסמן אותה ולנסות שוב.",
  wrong_account:
    "נבחר חשבון Google אחר מזה שאיתו נכנסת למערכת. יש לבחור באותו חשבון.",
  failed: "החיבור ליומן Google נכשל. נסו שוב.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar_error?: string; calendar_connected?: string }>;
}) {
  const user = await requireUser();
  const { calendar_error, calendar_connected } = await searchParams;

  const googleAccount =
    user.role === "PARTNER"
      ? await prisma.googleAccount.findUnique({
          where: { userId: user.id },
          select: { googleEmail: true },
        })
      : null;
  const calendarConnected =
    googleAccount?.googleEmail.toLowerCase() === user.email;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-brand-900">הגדרות</h1>
        <p className="text-sm text-black/50">החשבון שלך במערכת</p>
      </div>

      <section className="max-w-md rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: user.color }}
          >
            {user.name.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-brand-900">{user.name}</p>
            <p className="truncate text-sm text-black/50" dir="ltr">
              {user.email}
            </p>
          </div>
          <span className="mr-auto rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
            {ROLE_LABELS[user.role]}
          </span>
        </div>
        <p className="mt-4 text-xs text-black/40">
          הכניסה למערכת נעשית עם חשבון Google הזה. אין סיסמה נפרדת.
        </p>
      </section>

      {user.role === "PARTNER" && (
        <section className="max-w-md rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-brand-900">
            <CalendarDays size={16} />
            יומן Google
          </h2>

          {calendar_connected && (
            <p className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              <CircleCheck size={15} />
              יומן ה-Google חובר בהצלחה.
            </p>
          )}
          {calendar_error && (
            <p className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <CircleAlert size={15} className="mt-0.5 shrink-0" />
              {CALENDAR_ERRORS[calendar_error] ?? CALENDAR_ERRORS.failed}
            </p>
          )}

          {calendarConnected ? (
            <p className="text-sm text-black/60">
              ההרשאה ליומן הראשי של{" "}
              <span dir="ltr" className="font-medium">
                {user.email}
              </span>{" "}
              פעילה.
            </p>
          ) : (
            <p className="text-sm text-black/60">
              היומן עוד לא מחובר. בלי החיבור, הפגישות שלך לא יסתנכרנו עם Google.
            </p>
          )}

          <a
            href="/api/auth/google?mode=calendar&next=/settings"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold text-brand-900 transition hover:bg-black/5"
          >
            {calendarConnected ? "חיבור מחדש" : "חיבור יומן Google"}
          </a>
        </section>
      )}
    </div>
  );
}
