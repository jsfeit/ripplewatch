import "server-only";
import { randomBytes, createHash } from "node:crypto";

// "rw" for Ripplewatch, "live" since there's no test-mode concept here —
// matches the Stripe/GitHub convention (sk_live_..., ghp_...) so the key
// itself is recognizable at a glance and greppable in logs/secret scanners.
const KEY_PREFIX = "rw_live_";
const SECRET_BYTES = 24;

export type GeneratedApiKey = {
  // Shown to the user exactly once, at creation — never stored.
  plaintext: string;
  // Stored: sha256 of the full plaintext key, used to look up the key on
  // every request without ever persisting the secret itself.
  hash: string;
  // Stored + shown in the list UI so a user can tell keys apart later
  // without the full secret being recoverable from it.
  displayPrefix: string;
};

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(SECRET_BYTES).toString("base64url");
  const plaintext = `${KEY_PREFIX}${secret}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    displayPrefix: `${plaintext.slice(0, KEY_PREFIX.length + 6)}…`,
  };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function looksLikeApiKey(value: string): boolean {
  return value.startsWith(KEY_PREFIX);
}
