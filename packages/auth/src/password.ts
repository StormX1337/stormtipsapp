import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id parameters.
 *
 * Follows the OWASP Password Storage Cheat Sheet recommendation of
 * 19 MiB memory, 2 iterations and 1 degree of parallelism, which keeps a
 * single hash well under 100 ms on a modern server core.
 */
const ARGON2_OPTIONS = {
  // @node-rs/argon2 defaults to Argon2id, which is what we want.
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  if (plaintext.length === 0) throw new Error('Password must not be empty');
  return hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Verifies a password against a stored hash.
 * Never throws on a malformed hash — an unparsable hash is simply a mismatch.
 */
export async function verifyPassword(storedHash: string, plaintext: string): Promise<boolean> {
  if (!storedHash || !plaintext) return false;
  try {
    return await verify(storedHash, plaintext, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/** True when a stored hash was produced with weaker parameters and should be upgraded. */
export function needsRehash(storedHash: string): boolean {
  const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(storedHash);
  if (!match) return true;
  const [, memory, time, parallelism] = match;
  return (
    Number(memory) < ARGON2_OPTIONS.memoryCost ||
    Number(time) < ARGON2_OPTIONS.timeCost ||
    Number(parallelism) < ARGON2_OPTIONS.parallelism
  );
}

/** Very small strength signal surfaced in the UI — not a security control. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}
