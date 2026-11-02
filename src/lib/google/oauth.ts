import "server-only";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import {
  CALENDAR_OAUTH_SCOPES,
  SYNCABLE_GOOGLE_ACCOUNTS,
  type ConnectDeps,
} from "@/lib/google/calendar-access";

// Google OAuth is used ONLY to connect a partner's own calendar (from
// Settings) - signing in to the app is email + password.

const REQUIRED_ENV = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "APP_URL",
  "TOKEN_ENCRYPTION_KEY",
] as const;

export function isGoogleConfigured() {
  return REQUIRED_ENV.every((name) => Boolean(process.env[name]));
}

function getAppUrl() {
  const url = process.env.APP_URL;
  if (!url) throw new Error("Missing APP_URL environment variable");
  return url.replace(/\/$/, "");
}

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${getAppUrl()}/api/google/callback`
  );
}

/**
 * Consent screen for calendar access. `login_hint` pre-selects the partner's
 * own account; the callback still verifies it server-side, since the user
 * can pick another account on Google's screen.
 */
export function getCalendarAuthUrl({ state, email }: { state: string; email: string }) {
  return createOAuthClient().generateAuthUrl({
    scope: CALENDAR_OAUTH_SCOPES,
    access_type: "offline",
    // Always show consent, so Google always returns a refresh token.
    prompt: "consent",
    login_hint: email,
    state,
  });
}

/** Real implementations of the injected dependencies in calendar-access.ts. */
export const calendarConnectDeps: ConnectDeps = {
  async exchangeCode(code) {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new Error("Google did not return an ID token");

    // Verifies the ID token's signature, issuer, expiry and audience - the
    // email we check comes from Google, not from anything the browser sent.
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    return {
      googleEmail: payload?.email,
      googleEmailVerified: payload?.email_verified,
      grantedScopes: (tokens.scope ?? "").split(" ").filter(Boolean),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    };
  },

  async saveTokens(userId, googleEmail, tokens) {
    const data = {
      googleEmail,
      encryptedAccessToken: encrypt(tokens.accessToken),
      encryptedRefreshToken: encrypt(tokens.refreshToken),
      accessTokenExpiresAt: new Date(tokens.expiryDate ?? Date.now() + 3600_000),
      calendarId: "primary",
      lastSyncedAt: null,
    };
    await prisma.googleAccount.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  },

  async revokeToken(token) {
    await createOAuthClient().revokeToken(token);
  },
};

/**
 * The stored connection for this user - but only if it is their own,
 * allowed account. Anything else is treated as "not connected".
 */
async function getOwnGoogleAccount(userId: string) {
  const account = await prisma.googleAccount.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  });
  if (
    !account ||
    !SYNCABLE_GOOGLE_ACCOUNTS.includes(account.googleEmail) ||
    account.googleEmail !== account.user.email
  ) {
    return null;
  }
  return account;
}

export async function getCalendarConnection(userId: string) {
  const account = await getOwnGoogleAccount(userId);
  return account ? { googleEmail: account.googleEmail } : null;
}

/** Removes the stored tokens and withdraws the grant at Google (best-effort). */
export async function disconnectCalendar(userId: string) {
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!account) return;
  await prisma.googleAccount.delete({ where: { userId } });
  try {
    await createOAuthClient().revokeToken(decrypt(account.encryptedRefreshToken));
  } catch {
    // already revoked / key rotated - the stored tokens are gone either way
  }
}

/**
 * Returns an OAuth2 client pre-loaded with a partner's stored credentials, or
 * null if they have no valid own-account connection. If Google refreshes the
 * access token mid-request, the new token is persisted automatically.
 */
export async function getAuthorizedClientFor(userId: string) {
  const account = await getOwnGoogleAccount(userId);
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
