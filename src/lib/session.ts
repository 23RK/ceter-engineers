import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "keter_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days
// The session is re-issued (sliding expiry) once it's this old, so anyone who
// opens the app at least once a month stays signed in on that device.
const SESSION_RENEW_AFTER_SECONDS = 60 * 60 * 24; // 1 day

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET environment variable");
  }
  return new TextEncoder().encode(secret);
}

// Set after a successful "Sign in with Google" for an allow-listed email.
// Tokens from the old shared login (which carried `partnerId` instead) fail
// verification below, so everyone is signed out once and signs in again.
export type SessionPayload = {
  userId: string;
  issuedAt: number; // seconds since epoch
};

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.uid !== "string" || typeof payload.iat !== "number") {
      return null;
    }
    return { userId: payload.uid, issuedAt: payload.iat };
  } catch {
    return null;
  }
}

export function shouldRenewSession(session: SessionPayload) {
  return Date.now() / 1000 - session.issuedAt > SESSION_RENEW_AFTER_SECONDS;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
