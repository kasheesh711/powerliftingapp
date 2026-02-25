import {
  decryptTokenPayload,
  encryptTokenPayload,
  mergeRefreshToken,
  type GoogleTokenPayload
} from './token-vault';

describe('token vault', () => {
  const key = Buffer.alloc(32, 7).toString('base64');

  it('encrypts and decrypts payload', () => {
    const payload: GoogleTokenPayload = {
      access_token: 'access',
      refresh_token: 'refresh',
      expiry_date: Date.now() + 3600 * 1000
    };

    const encrypted = encryptTokenPayload(payload, key);
    const roundtrip = decryptTokenPayload(encrypted, key);

    expect(roundtrip.access_token).toBe('access');
    expect(roundtrip.refresh_token).toBe('refresh');
  });

  it('retains existing refresh token when incoming payload omits it', () => {
    const merged = mergeRefreshToken(
      {
        access_token: 'old-access',
        refresh_token: 'old-refresh',
        expiry_date: Date.now()
      },
      {
        access_token: 'new-access',
        refresh_token: null,
        expiry_date: Date.now() + 1000
      }
    );

    expect(merged.refresh_token).toBe('old-refresh');
    expect(merged.access_token).toBe('new-access');
  });
});
