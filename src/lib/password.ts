import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// Compared against when the email is unknown, so a wrong email takes as long
// as a wrong password (doesn't reveal which emails exist).
let dummyHash: Promise<string> | undefined;
export async function verifyAgainstDummy(password: string) {
  dummyHash ??= hashPassword("not-a-real-password");
  await bcrypt.compare(password, await dummyHash);
  return false;
}
