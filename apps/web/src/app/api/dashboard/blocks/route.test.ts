import type { BlockDescriptor, IDataStore } from '@powerlifting/domain';

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

describe('/api/dashboard/blocks', () => {
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

    const response = await GET(new Request('http://localhost/api/dashboard/blocks'));
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(payload.code).toBe('UNAUTHORIZED');
  });

  it('forwards forceRefresh to datastore query options', async () => {
    vi.mocked(getUserContext).mockResolvedValue(baseUser);

    const blocks: BlockDescriptor[] = [
      {
        name: 'Block 5',
        blockNum: '5',
        year: null,
        isRecap: false,
        isBlock: true
      }
    ];

    const store = {
      getAvailableBlocks: vi.fn().mockResolvedValue(blocks)
    } as unknown as IDataStore;

    vi.mocked(getDataStore).mockReturnValue(store);

    const response = await GET(new Request('http://localhost/api/dashboard/blocks?forceRefresh=true'));
    const payload = (await response.json()) as BlockDescriptor[];

    expect(response.status).toBe(200);
    expect(payload).toHaveLength(1);
    expect(store.getAvailableBlocks).toHaveBeenCalledWith(baseUser, {
      forceRefresh: true
    });
  });
});
