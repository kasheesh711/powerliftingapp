import crypto from 'node:crypto';

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
}

function decodeEncryptionKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes (AES-256 key).');
  }
  return key;
}

export function encryptString(plainText: string, keyBase64: string): string {
  const key = decodeEncryptionKey(keyBase64);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };

  return JSON.stringify(payload);
}

export function decryptString(serializedPayload: string, keyBase64: string): string {
  const payload = JSON.parse(serializedPayload) as EncryptedPayload;
  const key = decodeEncryptionKey(keyBase64);

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));

  const plain = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final()
  ]);

  return plain.toString('utf8');
}

export function encryptJson<T>(value: T, keyBase64: string): string {
  return encryptString(JSON.stringify(value), keyBase64);
}

export function decryptJson<T>(serializedPayload: string, keyBase64: string): T {
  return JSON.parse(decryptString(serializedPayload, keyBase64)) as T;
}
