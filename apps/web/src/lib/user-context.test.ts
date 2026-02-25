import { auth } from '@/auth';

import { getSelectedSpreadsheet } from './selection-repo';
import { getUserContext } from './user-context';

vi.mock('@/auth', () => ({
  auth: vi.fn()
}));

vi.mock('./selection-repo', () => ({
  getSelectedSpreadsheet: vi.fn()
}));

describe('getUserContext', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBypass = process.env.ALLOW_LOCAL_DEV_AUTH_BYPASS;
  const originalSourceSpreadsheetId = process.env.SOURCE_SPREADSHEET_ID;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_LOCAL_DEV_AUTH_BYPASS = 'true';
    process.env.SOURCE_SPREADSHEET_ID = 'source-sheet-id';
    vi.mocked(getSelectedSpreadsheet).mockResolvedValue(null);
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ALLOW_LOCAL_DEV_AUTH_BYPASS = originalBypass;
    process.env.SOURCE_SPREADSHEET_ID = originalSourceSpreadsheetId;
  });

  it('uses local-dev fallback identity when bypass is enabled', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const context = await getUserContext();

    expect(context.userId).toBe('local-dev@example.com');
    expect(context.spreadsheetId).toBe('source-sheet-id');
  });

  it('throws unauthorized when requireAuth is true and session is missing', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    await expect(getUserContext({ requireAuth: true })).rejects.toThrow('Unauthorized');
  });

  it('throws unauthorized when bypass is disabled without session', async () => {
    process.env.ALLOW_LOCAL_DEV_AUTH_BYPASS = 'false';
    vi.mocked(auth).mockResolvedValue(null);

    await expect(getUserContext()).rejects.toThrow('Unauthorized');
  });

  it('uses authenticated user email and selected spreadsheet', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        email: 'Kevin@Example.com'
      }
    });
    vi.mocked(getSelectedSpreadsheet).mockResolvedValue('sheet-from-selection');

    const context = await getUserContext({ requireAuth: true });

    expect(context).toEqual({
      userId: 'kevin@example.com',
      spreadsheetId: 'sheet-from-selection'
    });
  });

  it('falls back to local-workbook when no selected sheet or source sheet is configured', async () => {
    process.env.SOURCE_SPREADSHEET_ID = '';
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(getSelectedSpreadsheet).mockResolvedValue(null);

    const context = await getUserContext();

    expect(context.userId).toBe('local-dev@example.com');
    expect(context.spreadsheetId).toBe('local-workbook');
  });
});
