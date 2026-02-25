import type { IDataStore, InitialPayload } from '@powerlifting/domain';

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

describe('/api/dashboard/initial', () => {
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

    const response = await GET();
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(payload.code).toBe('UNAUTHORIZED');
  });

  it('returns initial payload from datastore', async () => {
    vi.mocked(getUserContext).mockResolvedValue(baseUser);

    const initialPayload: InitialPayload = {
      blocks: [],
      basics: {
        bodyweight: 90,
        sex: 'male',
        squatBaseline: null,
        benchBaseline: null,
        deadliftBaseline: null
      },
      config: {
        coefficients: {},
        disableWrites: false
      }
    };

    const store = {
      getInitialPayload: vi.fn().mockResolvedValue(initialPayload)
    } as unknown as IDataStore;

    vi.mocked(getDataStore).mockReturnValue(store);

    const response = await GET();
    const payload = (await response.json()) as InitialPayload;

    expect(response.status).toBe(200);
    expect(payload.basics.bodyweight).toBe(90);
    expect(store.getInitialPayload).toHaveBeenCalledWith(baseUser);
  });
});
