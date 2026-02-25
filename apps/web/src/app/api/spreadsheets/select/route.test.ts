import { getSelectedSpreadsheetSelection, saveSelectedSpreadsheet } from '@/lib/selection-repo';
import { getUserContext } from '@/lib/user-context';

import { GET, POST } from './route';

vi.mock('@/lib/user-context', () => ({
  getUserContext: vi.fn()
}));

vi.mock('@/lib/selection-repo', () => ({
  getSelectedSpreadsheetSelection: vi.fn(),
  saveSelectedSpreadsheet: vi.fn()
}));

describe('/api/spreadsheets/select', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 on GET when user context requires auth', async () => {
    vi.mocked(getUserContext).mockRejectedValue(new Error('Unauthorized'));

    const response = await GET();
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(payload.code).toBe('UNAUTHORIZED');
  });

  it('returns currently selected spreadsheet on GET', async () => {
    vi.mocked(getUserContext).mockResolvedValue({
      userId: 'tester@example.com',
      spreadsheetId: 'abc123'
    });
    vi.mocked(getSelectedSpreadsheetSelection).mockResolvedValue({
      spreadsheetId: 'abc123',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/abc123/edit'
    });

    const response = await GET();
    const payload = (await response.json()) as {
      selectedSpreadsheet: { spreadsheetId: string; spreadsheetUrl?: string } | null;
    };

    expect(response.status).toBe(200);
    expect(payload.selectedSpreadsheet?.spreadsheetId).toBe('abc123');
  });

  it('persists spreadsheet selection on POST for authenticated users', async () => {
    vi.mocked(getUserContext).mockResolvedValue({
      userId: 'tester@example.com',
      spreadsheetId: 'existing'
    });

    const request = new Request('http://localhost/api/spreadsheets/select', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        spreadsheetId: 'next-sheet'
      })
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      spreadsheetId: string;
      ok: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.spreadsheetId).toBe('next-sheet');
    expect(saveSelectedSpreadsheet).toHaveBeenCalledWith('tester@example.com', {
      spreadsheetId: 'next-sheet',
      spreadsheetUrl: undefined
    });
  });
});
