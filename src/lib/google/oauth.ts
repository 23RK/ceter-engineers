import "server-only";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

// Full "calendar" scope (not just calendar.events) - needed so we can
// create the dedicated business calendar below, not just read/write
// events on whatever calendar we're pointed at.
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

// The app never touches a partner's primary (personal) calendar - it
// creates and only ever uses this separate, clearly-named calendar in
// their Google account, so business meetings never mix with personal
// ones and neither partner can see the other's actual personal calendar.
const BUSINESS_CALENDAR_NAME = "כתר הנדסה - פגישות עסקיות";

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

/**
 * Finds this partner's dedicated business calendar if they already have
 * one (e.g. reconnecting), otherwise creates it. Never returns "primary".
 */
async function getOrCreateBusinessCalendarId(
  client: InstanceType<typeof google.auth.OAuth2>
): Promise<string> {
  const calendar = google.calendar({ version: "v3", auth: client });

  const { data: list } = await calendar.calendarList.list({
    minAccessRole: "owner",
  });
  const existing = list.items?.find(
    (item) => item.summary === BUSINESS_CALENDAR_NAME
  );
  if (existing?.id) return existing.id;

  const { data: created } = await calendar.calendars.insert({
    requestBody: { summary: BUSINESS_CALENDAR_NAME },
  });
  if (!created.id) {
    throw new Error("Google did not return an id for the new calendar");
  }
  return created.id;
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
  const calendarId = await getOrCreateBusinessCalendarId(client);

  await prisma.googleAccount.upsert({
    where: { userId: partnerId },
    create: {
      userId: partnerId,
      googleEmail: data.email ?? "",
      encryptedAccessToken: encrypt(tokens.access_token),
      encryptedRefreshToken: encrypt(tokens.refresh_token),
      accessTokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
      calendarId,
    },
    update: {
      googleEmail: data.email ?? "",
      encryptedAccessToken: encrypt(tokens.access_token),
      encryptedRefreshToken: encrypt(tokens.refresh_token),
      accessTokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
      calendarId,
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
