import { CalendarDays, CircleAlert, CircleCheck, KeyRound } from "lucide-react";
import { ROLE_LABELS, requireUser } from "@/lib/auth";
import { getCalendarConnection, isGoogleConfigured } from "@/lib/google/oauth";
import { SYNCABLE_GOOGLE_ACCOUNTS } from "@/lib/google/calendar-access";
import { disconnectCalendarAction } from "@/lib/actions/auth";
import { ChangePasswordForm } from "@/components/change-password-form";

function calendarErrorMessage(error: string, ownEmail: string, googleEmail?: string) {
  switch (error) {
    case "wrong_account":
      return (
        <>
          החיבור נדחה: נבחר חשבון Google אחר
          {googleEmail && (
            <>
              {" "}(<bdi>{googleEmail}</bdi>)
            </>
          )}
          . אפשר לחבר רק את החשבון <bdi>{ownEmail}</bdi>. שום הרשאה לא נשמרה.
        </>
      );
    case "not_syncable":
      return "למשתמש הזה אין אפשרות לחבר יומן Google.";
    case "unverified":
      return "החיבור נדחה: Google לא אישר את כתובת המייל של החשבון.";
    case "scope":
      return "ההרשאה ליומן לא סומנה במסך האישור של Google. יש לסמן אותה ולנסות שוב.";
    case "denied":
      return "לא ניתנה הרשאה ליומן Google.";
    case "not_configured":
      return "חיבור ל-Google עוד לא הוגדר בשרת (חסרים משתני סביבה, ראו docs/google-cloud-setup.md).";
    case "state":
      return "פג תוקף ניסיון החיבור. נסו שוב.";
    default:
      return "החיבור ליומן Google נכשל. נסו שוב.";
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    calendar_error?: string;
    calendar_connected?: string;
    google_email?: string;
  }>;
}) {
  const user = await requireUser();
  const { calendar_error, calendar_connected, google_email } = await searchParams;

  const canSyncCalendar = SYNCABLE_GOOGLE_ACCOUNTS.includes(user.email);
  const connection = canSyncCalendar ? await getCalendarConnection(user.id) : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-brand-900">הגדרות</h1>
        <p className="text-sm text-black/50">החשבון שלך במערכת</p>
      </div>

      <section className="max-w-lg rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
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
      </section>

      <section className="max-w-lg rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-brand-900">
          <KeyRound size={16} />
          שינוי סיסמה
        </h2>
        <ChangePasswordForm email={user.email} />
      </section>

      {canSyncCalendar && (
        <section className="max-w-lg rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
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
              <span>{calendarErrorMessage(calendar_error, user.email, google_email)}</span>
            </p>
          )}

          <p className="text-sm text-black/60">
            {connection ? (
              <>
                מחובר ליומן הראשי של{" "}
                <bdi className="font-medium">{connection.googleEmail}</bdi>.
              </>
            ) : (
              <>
                היומן עוד לא מחובר. אפשר לחבר רק את חשבון ה-Google{" "}
                <bdi className="font-medium">{user.email}</bdi>.
              </>
            )}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {isGoogleConfigured() ? (
              <a
                href="/api/google/connect"
                className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold text-brand-900 transition hover:bg-black/5"
              >
                {connection ? "חיבור מחדש" : "חיבור יומן Google"}
              </a>
            ) : (
              <p className="text-xs text-black/40">
                חיבור ל-Google עוד לא הוגדר בשרת (ראו docs/google-cloud-setup.md).
              </p>
            )}
            {connection && (
              <form action={disconnectCalendarAction}>
                <button
                  type="submit"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  ניתוק
                </button>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
