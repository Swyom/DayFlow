import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

/**
 * Password hashing for local profiles: PBKDF2-HMAC-SHA256 with a random 16-byte salt
 * per account (audited pure-JS implementation, so it also runs in Expo Go).
 *
 * The iteration count is a trade-off: high enough to make offline guessing slow,
 * low enough that log-in stays around a second on low-end phones running Hermes.
 * It is stored with each credential, so it can be raised later; older credentials
 * are re-hashed transparently on the next successful log-in (see `needsRehash`).
 */
export const PBKDF2_ITERATIONS = 50_000;
const KEY_LENGTH = 32;
export const SALT_BYTES = 16;

export type PasswordCredential = {
  v: 2;
  algo: 'pbkdf2-sha256';
  iterations: number;
  salt: string;
  hash: string;
};

/** NFC so the same password typed on different keyboards hashes identically. */
const encode = (password: string) => password.normalize('NFC');

export async function createCredential(password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<PasswordCredential> {
  if (salt.length < SALT_BYTES) throw new Error('Salt too short');
  const key = await pbkdf2Async(sha256, encode(password), salt, { c: iterations, dkLen: KEY_LENGTH });
  return { v: 2, algo: 'pbkdf2-sha256', iterations, salt: bytesToHex(salt), hash: bytesToHex(key) };
}

export async function verifyCredential(password: string, credential: PasswordCredential): Promise<boolean> {
  const key = await pbkdf2Async(sha256, encode(password), hexToBytes(credential.salt), {
    c: credential.iterations,
    dkLen: KEY_LENGTH,
  });
  return constantTimeEqual(bytesToHex(key), credential.hash);
}

export const needsRehash = (credential: PasswordCredential) => credential.iterations < PBKDF2_ITERATIONS;

/** Compares without exiting early, so timing does not reveal how many characters matched. */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function isPasswordCredential(v: unknown): v is PasswordCredential {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    c.v === 2 &&
    c.algo === 'pbkdf2-sha256' &&
    typeof c.iterations === 'number' &&
    c.iterations >= 1000 &&
    c.iterations <= 10_000_000 &&
    typeof c.salt === 'string' &&
    /^[0-9a-f]{32,}$/.test(c.salt) &&
    typeof c.hash === 'string' &&
    /^[0-9a-f]{64}$/.test(c.hash)
  );
}
