import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'v1';

function keyFrom(hexKey: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error('ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes)');
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypts a secret for storage (provider API keys, OAuth client secrets).
 * Output: `v1:<iv-b64>:<tag-b64>:<ciphertext-b64>` — version prefixed so the
 * algorithm can be rotated without a destructive migration.
 */
export function encryptSecret(plaintext: string, hexKey: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyFrom(hexKey), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decryptSecret(payload: string, hexKey: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error('Malformed encrypted payload');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(
    ALGORITHM,
    keyFrom(hexKey),
    Buffer.from(ivB64 as string, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH },
  );
  decipher.setAuthTag(Buffer.from(tagB64 as string, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64 as string, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`);
}

/** Masks a secret for display in the admin UI: "sk_live_…9f2a". */
export function maskSecret(value: string, visible = 4): string {
  if (value.length <= visible * 2) return '•'.repeat(value.length);
  return `${value.slice(0, visible)}${'•'.repeat(8)}${value.slice(-visible)}`;
}
