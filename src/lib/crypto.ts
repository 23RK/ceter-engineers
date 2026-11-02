import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { encryptionKeyFrom, env } from "@/lib/google/env";

// Encrypts secrets we have to store at rest (Google OAuth tokens) using
// AES-256-GCM. TOKEN_ENCRYPTION_KEY should be a 32-byte key, hex-encoded
// (64 hex chars): `openssl rand -hex 32`. Surrounding quotes / spaces are
// ignored; another 32+ character value is turned into a key with SHA-256.
let warned = false;
function getKey(): Buffer {
  const value = env("TOKEN_ENCRYPTION_KEY");
  if (!value) {
    throw new Error("Missing TOKEN_ENCRYPTION_KEY environment variable");
  }
  const { key, derived } = encryptionKeyFrom(value);
  if (derived && !warned) {
    warned = true;
    console.warn("[google] TOKEN_ENCRYPTION_KEY is not 64 hex characters - using a SHA-256-derived key. Replace it with `openssl rand -hex 32` before any token is stored.");
  }
  return key;
}

// Output format: "<iv>:<authTag>:<ciphertext>", each hex-encoded.
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("hex")).join(":");
}

export function decrypt(payload: string): string {
  const [ivHex, authTagHex, ciphertextHex] = payload.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted payload");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
