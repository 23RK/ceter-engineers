import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  KeyRound,
  LayoutList,
} from "lucide-react";
import { ROLE_LABELS, requireUser } from "@/lib/auth";
import { getCalendarConnection, isGoogleConfigured } from "@/lib/google/oauth";
import { SYNCABLE_GOOGLE_ACCOUNTS } from "@/lib/google/calendar-access";
import { googleConfigIssues } from "@/lib/google/env";
import { calendarSyncStatus } from "@/lib/google/calendar-sync";
import { israelDayKey, israelTime } from "@/lib/israel-time";
import { SyncNowButton } from "@/components/calendar/sync-now-button";
import { disconnectCalendarAction } from "@/lib/actions/auth";
import { ChangePasswordForm } from "@/components/change-password-form";

const STEP_HINTS: Record<string, string> = {
  token_exchange: "בשלב החלפת הקוד ב-token מול Google",
  id_token: "בשלב אימות זהות החשבון מול Google",
  no_refresh_token: "Google לא החזיר הרשאה קבועה (refresh token)",
  encrypt: "בשלב הצפנת ההרשאה (מפתח TOKEN_ENCRYPTION_KEY)",
  database: "בשלב השמירה במסד הנתונים",
};

/** Google's own error codes, explained (they're not secret). */
const GOOGLE_CODES: Record<string, string> = {
  invalid_client: "GOOGLE_CLIENT_ID או GOOGLE_CLIENT_SECRET לא תואמים ללקוח ב-Google Cloud",
  unauthorized_client: "הלקוח ב-Google Cloud לא מורשה לסוג החיבור הזה",
  invalid_grant: "הקוד מ-Google פג או כבר נוצל. נסו שוב",
  redirect_uri_mismatch: "ה-Redirect URI ב-Google Cloud לא תואם ל-APP_URL",
};

/** The general reason (missing permission / Google error / save error / account not allowed). */
function calendarErrorMessage(
  error: string,
  ownEmail: string,
  googleEmail?: string,
  step?: string,
  code?: string
) {
  const hint = [step && STEP_HINTS[step], code && (GOOGLE_CODES[code] ?? code)].filter(Boolean).join(". ");
  switch (error) {
    case "wrong_account":
      return (
        <>
          <b>חשבון לא מורשה:</b> נבחר חשבון Google אחר
          {googleEmail && (
            <>
              {" "}(<bdi>{googleEmail}</bdi>)
            </>
          )}
          . אפשר לחבר רק את החשבון <bdi>{ownEmail}</bdi>. שום הרשאה לא נשמרה.
        </>
      );
    case "not_syncable":
      return (
        <>
          <b>חשבון לא מורשה:</b> למשתמש הזה אין אפשרות לחבר יומן Google.
        </>
      );
    case "unverified":
      return (
        <>
          <b>חשבון לא מורשה:</b> Google לא אישר את כתובת המייל של החשבון.
        </>
      );
    case "scope":
      return (
        <>
          <b>הרשאה חסרה:</b> ההרשאה ליומן לא סומנה במסך האישור של Google. יש לסמן אותה ולנסות שוב.
        </>
      );
    case "denied":
      return (
        <>
          <b>הרשאה חסרה:</b> לא ניתנה הרשאה ליומן Google.
        </>
      );
    case "google":
      return (
        <>
          <b>שגיאה מול Google.</b> {hint ? `${hint}.` : ""} נסו שוב, ואם זה חוזר, הפרטים נרשמים ב-Vercel ← Logs (חיפוש: google-calendar).
        </>
      );
    case "save":
      return (
        <>
          <b>שגיאת שמירה.</b> {hint ? `${hint}.` : ""} ההרשאה מ-Google התקבלה אבל לא נשמרה. הפרטים נרשמים ב-Vercel ← Logs (חיפוש: google-calendar).
        </>
      );
    case "config":
      return (
        <>
          <b>הגדרות השרת שגויות.</b> ראו את הפירוט למטה.
        </>
      );
    case "not_configured":
      return "חיבור ל-Google עוד לא הוגדר בשרת (חסרים משתני סביבה, ראו docs/google-cloud-setup.md).";
    case "state":
      return "פג תוקף ניסיון החיבור, או שהוא התחיל בחלון אחר. נסו שוב.";
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
    calendar_step?: string;
    calendar_code?: string;
  }>;
}) {
  const user = await requireUser();
  const { calendar_error, calendar_connected, google_email, calendar_step, calendar_code } =
    await searchParams;
  const configIssues = googleConfigIssues();

  const canSyncCalendar = SYNCABLE_GOOGLE_ACCOUNTS.includes(user.email);
  const connection = canSyncCalendar ? await getCalendarConnection(user.id) : null;
  const sync = connection
    ? (await calendarSyncStatus()).find((s) => s.userId === user.id) ?? null
    : null;

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

      <Link
        href="/settings/stages"
        className="flex max-w-lg items-center gap-3 rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <LayoutList size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-brand-900">
            תבניות שלבים
          </span>
          <span className="block text-xs text-black/50">
            השלבים שפרויקט חדש מקבל, לכל מחלקה
          </span>
        </span>
        <ChevronLeft size={18} className="shrink-0 text-black/30" />
      </Link>

      <Link
        href="/settings/inspections"
        className="flex max-w-lg items-center gap-3 rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <ClipboardCheck size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-brand-900">
            הגדרות בדק בית
          </span>
          <span className="block text-xs text-black/50">
            בודקים, סוגי נכס, מחירון, תעריפים ומע&quot;מ
          </span>
        </span>
        <ChevronLeft size={18} className="shrink-0 text-black/30" />
      </Link>

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
              <span>
                {calendarErrorMessage(calendar_error, user.email, google_email, calendar_step, calendar_code)}
              </span>
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

          {connection && sync && (
            <div className="mt-3 flex flex-col gap-1 rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-black/60">
              <p>
                סנכרון דו-כיווני פעיל: פגישות מהיומן מופיעות במערכת, ופגישות שנקבעות במערכת
                (ובדיקות בדק בית שלך) נכתבות ליומן.
              </p>
              <p>
                עדכון אחרון מ-Google:{" "}
                {sync.lastSyncedAt
                  ? `${israelDayKey(sync.lastSyncedAt).split("-").reverse().join("/")} ${israelTime(sync.lastSyncedAt)}`
                  : "עוד לא"}
                {" · "}
                {sync.pushActive ? "עדכונים מיידיים פעילים" : "עדכונים מיידיים לא פעילים (מתעדכן כל 10 דקות ובפתיחת היומן)"}
              </p>
              {sync.pendingMeetings > 0 && (
                <p className="text-amber-700">
                  {sync.pendingMeetings} פגישות עוד לא נכתבו ל-Google. ננסה שוב אוטומטית.
                </p>
              )}
              {sync.syncError && <p className="text-red-600">{sync.syncError}</p>}
            </div>
          )}

          {configIssues.length > 0 && (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="mb-1 font-semibold">בעיות בהגדרות השרת (Vercel ← Settings ← Environment Variables):</p>
              <ul className="list-inside list-disc">
                {configIssues.map((i, n) => (
                  <li key={n}>
                    <bdi dir="ltr">{i.name}</bdi>: {i.problem}
                  </li>
                ))}
              </ul>
              <p className="mt-1">אחרי תיקון: Redeploy.</p>
            </div>
          )}

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
            {connection && <SyncNowButton />}
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
