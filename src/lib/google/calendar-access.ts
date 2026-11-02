// Who may connect a Google Calendar - and the full "finish connecting" flow,
// written against injected dependencies so it can be unit-tested without
// Google or a database (see calendar-access.test.ts).
//
// No `server-only` / Prisma imports here on purpose; the route handler wires
// in the real implementations.

/**
 * The ONLY Google accounts whose calendars may ever be synced. Also enforced
 * by a CHECK constraint on GoogleAccount.googleEmail in the database.
 */
export const SYNCABLE_GOOGLE_ACCOUNTS: readonly string[] = [
  "ronketerltd@gmail.com",
  "guyketerltd@gmail.com",
];

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const CALENDAR_OAUTH_SCOPES = ["openid", "email", CALENDAR_SCOPE];

export type CalendarAccessError =
  | "wrong_account" // signed in to Google with a different account
  | "not_syncable" // the app user's own email isn't one of the two accounts
  | "unverified" // Google doesn't vouch for the account's email
  | "scope"; // calendar access wasn't granted on the consent screen

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Decides whether the Google account that just completed OAuth may be
 * connected for this app user. It must be EXACTLY the signed-in user's own
 * email, and that email must be one of the two syncable accounts.
 */
export function checkCalendarAccount({
  appUserEmail,
  googleEmail,
  googleEmailVerified,
  grantedScopes,
}: {
  appUserEmail: string;
  googleEmail: string | null | undefined;
  googleEmailVerified: boolean | null | undefined;
  grantedScopes: string[];
}): { ok: true; email: string } | { ok: false; error: CalendarAccessError } {
  const expected = normalizeEmail(appUserEmail);
  if (!SYNCABLE_GOOGLE_ACCOUNTS.includes(expected)) {
    return { ok: false, error: "not_syncable" };
  }
  if (!googleEmail || normalizeEmail(googleEmail) !== expected) {
    return { ok: false, error: "wrong_account" };
  }
  if (googleEmailVerified !== true) {
    return { ok: false, error: "unverified" };
  }
  if (!grantedScopes.includes(CALENDAR_SCOPE)) {
    return { ok: false, error: "scope" };
  }
  return { ok: true, email: expected };
}

/** Where in the connection a technical failure happened (logged, and shown as a hint). */
export type ConnectStep =
  | "token_exchange" // trading the code for tokens at Google
  | "id_token" // verifying Google's signed ID token
  | "no_refresh_token" // Google didn't return a refresh token
  | "encrypt" // encrypting the tokens (TOKEN_ENCRYPTION_KEY)
  | "database"; // saving them

/** A failure at a known step; `cause` is kept for a safe log line only. */
export class ConnectStepError extends Error {
  constructor(
    public step: ConnectStep,
    public cause: unknown
  ) {
    super(`Google calendar connection failed at ${step}`);
  }
}

export type OAuthResult = {
  googleEmail: string | null | undefined;
  googleEmailVerified: boolean | null | undefined;
  grantedScopes: string[];
  accessToken: string | null | undefined;
  refreshToken: string | null | undefined;
  expiryDate: number | null | undefined;
};

export type ConnectDeps = {
  /** Exchanges the OAuth code; must verify the ID token's signature. */
  exchangeCode(code: string): Promise<OAuthResult>;
  /** Persists the (to-be-encrypted) tokens. Only called for an allowed account. */
  saveTokens(
    userId: string,
    googleEmail: string,
    tokens: { accessToken: string; refreshToken: string; expiryDate: number | null }
  ): Promise<void>;
  /** Best-effort: withdraw a grant we refuse to keep. */
  revokeToken(token: string): Promise<void>;
};

/** The general reason shown in Settings (SPEC: הרשאה חסרה / שגיאה מול גוגל / שגיאת שמירה / חשבון לא מורשה). */
export type ConnectFailure = "google" | "save";

export type ConnectOutcome =
  | { ok: true }
  | { ok: false; error: CalendarAccessError; googleEmail?: string }
  | { ok: false; error: ConnectFailure; step: ConnectStep; cause: unknown };

const SAVE_STEPS: ConnectStep[] = ["encrypt", "database"];
function failure(e: unknown, fallback: ConnectStep): ConnectOutcome {
  const step = e instanceof ConnectStepError ? e.step : fallback;
  const cause = e instanceof ConnectStepError ? e.cause : e;
  return { ok: false, error: SAVE_STEPS.includes(step) ? "save" : "google", step, cause };
}

/**
 * Finishes the calendar OAuth flow for the signed-in user. A rejected account
 * never reaches saveTokens; its freshly issued grant is revoked instead.
 */
export async function completeCalendarConnection(
  { code, appUser }: { code: string; appUser: { id: string; email: string } },
  deps: ConnectDeps
): Promise<ConnectOutcome> {
  let result: OAuthResult;
  try {
    result = await deps.exchangeCode(code);
  } catch (e) {
    return failure(e, "token_exchange");
  }

  const check = checkCalendarAccount({
    appUserEmail: appUser.email,
    googleEmail: result.googleEmail,
    googleEmailVerified: result.googleEmailVerified,
    grantedScopes: result.grantedScopes,
  });

  if (!check.ok) {
    const token = result.refreshToken ?? result.accessToken;
    if (token) await deps.revokeToken(token).catch(() => {});
    return {
      ok: false,
      error: check.error,
      googleEmail: result.googleEmail ?? undefined,
    };
  }

  if (!result.accessToken || !result.refreshToken) {
    return failure(
      new ConnectStepError("no_refresh_token", new Error(result.accessToken ? "no refresh token" : "no access token")),
      "no_refresh_token"
    );
  }

  try {
    await deps.saveTokens(appUser.id, check.email, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiryDate: result.expiryDate ?? null,
    });
  } catch (e) {
    return failure(e, "database");
  }
  return { ok: true };
}
