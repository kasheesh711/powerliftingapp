import { getValidGoogleAccessToken } from '@/lib/token-vault-repo';
import { getUserContext } from '@/lib/user-context';

import { GET } from './route';

vi.mock('@/lib/user-context', () => ({
  getUserContext: vi.fn()
}));

vi.mock('@/lib/token-vault-repo', () => ({
  getValidGoogleAccessToken: vi.fn()
}));

describe('/api/spreadsheets/picker-token', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getUserContext).mockRejectedValue(new Error('Unauthorized'));

    const response = await GET();
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(payload.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when Google token is missing', async () => {
    vi.mocked(getUserContext).mockResolvedValue({
      userId: 'tester@example.com',
      spreadsheetId: 'sheet-1'
    });
    vi.mocked(getValidGoogleAccessToken).mockResolvedValue(null);

    const response = await GET();
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(payload.code).toBe('GOOGLE_TOKEN_MISSING');
  });

  it('returns access token payload without refresh token fields', async () => {
    vi.mocked(getUserContext).mockResolvedValue({
      userId: 'tester@example.com',
      spreadsheetId: 'sheet-1'
    });
    vi.mocked(getValidGoogleAccessToken).mockResolvedValue({
      accessToken: 'access-token-1',
      expiryDate: 1234567890
    });

    const response = await GET();
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload.accessToken).toBe('access-token-1');
    expect(payload.expiresAt).toBe(1234567890);
    expect(payload.refreshToken).toBeUndefined();
    expect(payload.refresh_token).toBeUndefined();
  });
});
