import { decryptJson, decryptString, encryptJson, encryptString } from './crypto';

describe('token encryption', () => {
  const key = Buffer.from('12345678901234567890123456789012').toString('base64');

  it('encrypts and decrypts plain strings', () => {
    const encrypted = encryptString('hello', key);
    const decrypted = decryptString(encrypted, key);
    expect(decrypted).toBe('hello');
  });

  it('encrypts and decrypts json payloads', () => {
    const value = { refreshToken: 'rt', accessToken: 'at' };
    const encrypted = encryptJson(value, key);
    const decrypted = decryptJson<typeof value>(encrypted, key);
    expect(decrypted).toEqual(value);
  });
});
