import { loadDashboardPayload, type DashboardPayload, type IDataStore } from '@powerlifting/domain';

import { getDataStore } from '@/lib/datastore';
import { getUserContext, shouldRequireDashboardAuth } from '@/lib/user-context';

import { GET } from './route';

vi.mock('@/lib/datastore', () => ({
  getDataStore: vi.fn()
}));

vi.mock('@/lib/user-context', () => ({
  getUserContext: vi.fn(),
  shouldRequireDashboardAuth: vi.fn()
}));

vi.mock('@powerlifting/domain', async () => {
  const actual = await vi.importActual<typeof import('@powerlifting/domain')>('@powerlifting/domain');
  return {
    ...actual,
    loadDashboardPayload: vi.fn()
  };
});

describe('/api/dashboard/block/[blockName]', () => {
  const baseUser = {
    userId: 'tester@example.com',
    spreadsheetId: 'sheet-1'
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(shouldRequireDashboardAuth).mockReturnValue(false);
  });

  it('returns 401 when user context fails auth', async () => {
    vi.mocked(getUserContext).mockRejectedValue(new Error('Unauthorized'));
    vi.mocked(getDataStore).mockReturnValue({} as IDataStore);

    const response = await GET(new Request('http://localhost/api/dashboard/block/Block%205'), {
      params: Promise.resolve({ blockName: 'Block%205' })
    });
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(payload.code).toBe('UNAUTHORIZED');
  });

  it('loads dashboard payload with decoded block name and forceRefresh', async () => {
    vi.mocked(getUserContext).mockResolvedValue(baseUser);
    vi.mocked(getDataStore).mockReturnValue({} as IDataStore);

    const dashboardPayload = {
      blockData: {
        rows: [],
        recaps: {
          squat: '',
          bench: '',
          deadlift: '',
          accessory: '',
          additions: '',
          coach: ''
        },
        peakE1RMs: {
          squat: null,
          bench: null,
          deadlift: null
        },
        parserReport: {} as DashboardPayload['blockData']['parserReport']
      },
      stats: {} as DashboardPayload['stats'],
      basics: {} as DashboardPayload['basics'],
      config: {} as DashboardPayload['config'],
      overallProgress: {} as DashboardPayload['overallProgress']
    } satisfies DashboardPayload;

    vi.mocked(loadDashboardPayload).mockResolvedValue(dashboardPayload);

    const response = await GET(new Request('http://localhost/api/dashboard/block/Block%205?forceRefresh=true'), {
      params: Promise.resolve({ blockName: 'Block%205' })
    });

    expect(response.status).toBe(200);
    expect(loadDashboardPayload).toHaveBeenCalledWith({}, baseUser, 'Block 5', {
      forceRefresh: true
    });
  });
});
