import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encrypts secrets we have to store at rest (Google OAuth tokens) using
// AES-256-GCM. TOKEN_ENCRYPTION_KEY must be a 32-byte key, hex-encoded
// (64 hex chars) - generate one the same way SESSION_SECRET was.
function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("Missing TOKEN_ENCRYPTION_KEY environment variable");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a 32-byte key, hex-encoded (64 hex characters)"
    );
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
