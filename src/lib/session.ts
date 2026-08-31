import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "keter_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET environment variable");
  }
  return new TextEncoder().encode(secret);
}

// Presence of a valid, signed cookie means the shared company login
// succeeded. `partnerId` is set once the signed-in person picks which
// partner they are (רון / גיא) - it's absent right after login.
export type SessionPayload = {
  partnerId?: string;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
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
    const partnerId =
      typeof payload.partnerId === "string" ? payload.partnerId : undefined;
    return { partnerId };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = SESSION_DURATION_SECONDS;
