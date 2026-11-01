import "server-only";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

const SIGN_IN_SCOPES = ["openid", "email"];

// Read/write events on the partner's calendars (incl. push notifications via
// events.watch). Narrower than the full "calendar" scope - the app no longer
// creates calendars, it works on each partner's primary one.
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const REQUIRED_ENV = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "APP_URL",
  "TOKEN_ENCRYPTION_KEY",
] as const;

export function missingGoogleEnv() {
  return REQUIRED_ENV.filter((name) => !process.env[name]);
}

function getAppUrl() {
  const url = process.env.APP_URL;
  if (!url) throw new Error("Missing APP_URL environment variable");
  return url.replace(/\/$/, "");
}

export function getRedirectUri() {
  return `${getAppUrl()}/api/auth/google/callback`;
}

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );
}

export type OAuthMode = "signin" | "calendar";

/**
 * Two flavours of the same Google OAuth flow:
 * - "signin": identity only (who are you?). Quick - no consent screen after
 *   the first time, just the account picker.
 * - "calendar": asks for calendar access with a forced consent screen, so
 *   Google always hands back a refresh token. Run once per partner right
 *   after their first sign-in, and again from Settings to reconnect.
 */
export function getGoogleAuthUrl({
  mode,
  state,
  loginHint,
}: {
  mode: OAuthMode;
  state: string;
  loginHint?: string;
}) {
  const client = createOAuthClient();
  if (mode === "signin") {
    return client.generateAuthUrl({
      scope: SIGN_IN_SCOPES,
      prompt: "select_account",
      state,
    });
  }
  return client.generateAuthUrl({
    scope: [...SIGN_IN_SCOPES, CALENDAR_SCOPE],
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    login_hint: loginHint,
    state,
  });
}

/**
 * Exchanges the callback `code` and returns the Google account's verified
 * email (from the signed ID token) plus the raw tokens.
 */
export async function exchangeCode(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new Error("Google did not return an ID token");

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) {
    throw new Error("Google account has no verified email");
  }

  const grantedScopes = (tokens.scope ?? "").split(" ");
  return {
    email: payload.email.toLowerCase(),
    tokens,
    hasCalendarScope: grantedScopes.includes(CALENDAR_SCOPE),
  };
}

/** Stores (encrypted) the tokens that let the server sync this partner's calendar. */
export async function saveCalendarTokens(
  userId: string,
  googleEmail: string,
  tokens: Awaited<ReturnType<typeof exchangeCode>>["tokens"]
) {
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Google did not return a refresh token");
  }
  const data = {
    googleEmail,
    encryptedAccessToken: encrypt(tokens.access_token),
    encryptedRefreshToken: encrypt(tokens.refresh_token),
    accessTokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
    calendarId: "primary",
  };
  await prisma.googleAccount.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

/**
 * Whether this partner's stored calendar connection belongs to their own
 * sign-in email. Connections made before the move to per-user sign-in may
 * point at a different Gmail account and need to be re-granted.
 */
export async function hasCalendarConnection(userId: string, email: string) {
  const account = await prisma.googleAccount.findUnique({
    where: { userId },
    select: { googleEmail: true },
  });
  return account?.googleEmail.toLowerCase() === email;
}

/**
 * Returns an OAuth2 client pre-loaded with a partner's stored credentials.
 * If Google refreshes the access token mid-request (their SDK does this
 * transparently), the new token is persisted back to the DB automatically.
 */
export async function getAuthorizedClientFor(userId: string) {
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!account) return null;

  const client = createOAuthClient();
  client.setCredentials({
    access_token: decrypt(account.encryptedAccessToken),
    refresh_token: decrypt(account.encryptedRefreshToken),
    expiry_date: account.accessTokenExpiresAt.getTime(),
  });

  client.on("tokens", (tokens) => {
    if (!tokens.access_token) return;
    void prisma.googleAccount
      .update({
        where: { userId },
        data: {
          encryptedAccessToken: encrypt(tokens.access_token),
          accessTokenExpiresAt: new Date(
            tokens.expiry_date ?? Date.now() + 3600_000
          ),
          ...(tokens.refresh_token
            ? { encryptedRefreshToken: encrypt(tokens.refresh_token) }
            : {}),
        },
      })
      .catch(() => {
        // best-effort - the next call will just refresh again
      });
  });

  return { client, account };
}
