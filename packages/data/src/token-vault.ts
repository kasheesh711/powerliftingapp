import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface GoogleTokenPayload {
  access_token: string;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string;
  token_type?: string;
}

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
  version: 1;
}

export function decodeEncryptionKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes.');
  }
  return key;
}

export function encryptTokenPayload(
  payload: GoogleTokenPayload,
  keyBase64: string
): EncryptedPayload {
  const key = decodeEncryptionKey(keyBase64);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    version: 1
  };
}

export function decryptTokenPayload(
  encrypted: EncryptedPayload,
  keyBase64: string
): GoogleTokenPayload {
  const key = decodeEncryptionKey(keyBase64);
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as GoogleTokenPayload;
}

export function mergeRefreshToken(
  existing: GoogleTokenPayload | null,
  incoming: GoogleTokenPayload
): GoogleTokenPayload {
  if (!incoming.refresh_token && existing?.refresh_token) {
    return {
      ...incoming,
      refresh_token: existing.refresh_token
    };
  }

  return incoming;
}
