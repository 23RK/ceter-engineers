import "server-only";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

function getAppUrl() {
  const url = process.env.APP_URL;
  if (!url) throw new Error("Missing APP_URL environment variable");
  return url.replace(/\/$/, "");
}

export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.APP_URL &&
      process.env.TOKEN_ENCRYPTION_KEY
  );
}

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${getAppUrl()}/api/google/callback`
  );
}

/** `state` carries the connecting partner's id through the redirect. */
export function getGoogleAuthUrl(partnerId: string) {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    // Forces Google to always re-issue a refresh_token, even for a partner
    // who connected before (otherwise it's only returned the first time).
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state: partnerId,
  });
}

export async function connectGoogleAccount(partnerId: string, code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      "Google לא החזיר refresh token - נסו להתחבר שוב ולוודא אישור מלא"
    );
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();

  await prisma.googleAccount.upsert({
    where: { userId: partnerId },
    create: {
      userId: partnerId,
      googleEmail: data.email ?? "",
      encryptedAccessToken: encrypt(tokens.access_token),
      encryptedRefreshToken: encrypt(tokens.refresh_token),
      accessTokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
    },
    update: {
      googleEmail: data.email ?? "",
      encryptedAccessToken: encrypt(tokens.access_token),
      encryptedRefreshToken: encrypt(tokens.refresh_token),
      accessTokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
    },
  });
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

export async function disconnectGoogleAccount(userId: string) {
  await prisma.googleAccount.delete({ where: { userId } }).catch(() => {});
}
