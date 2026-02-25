import type { IDataStore, UpdateResult } from '@powerlifting/domain';

import { getDataStore } from '@/lib/datastore';
import { getUserContext, shouldRequireDashboardAuth } from '@/lib/user-context';

import { POST } from './route';

vi.mock('@/lib/datastore', () => ({
  getDataStore: vi.fn()
}));

vi.mock('@/lib/user-context', () => ({
  getUserContext: vi.fn(),
  shouldRequireDashboardAuth: vi.fn()
}));

describe('/api/dashboard/block/[blockName]/updates', () => {
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

    const request = new Request('http://localhost/api/dashboard/block/Block%205/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [
          {
            cellA1: 'D10',
            field: 'actualLoad',
            originalValue: '100',
            newValue: '101'
          }
        ]
      })
    });

    const response = await POST(request, {
      params: Promise.resolve({ blockName: 'Block%205' })
    });
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(payload.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for invalid update payload', async () => {
    const request = new Request('http://localhost/api/dashboard/block/Block%205/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [
          {
            cellA1: 'D10',
            field: 'invalid-field',
            originalValue: '100',
            newValue: '101'
          }
        ]
      })
    });

    const response = await POST(request, {
      params: Promise.resolve({ blockName: 'Block%205' })
    });
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(payload.code).toBe('VALIDATION_ERROR');
    expect(getUserContext).not.toHaveBeenCalled();
  });

  it('returns 409 and conflict payload when datastore detects conflicts', async () => {
    vi.mocked(getUserContext).mockResolvedValue(baseUser);

    const store = {
      updateBlockCells: vi.fn().mockResolvedValue({
        status: 'conflict',
        conflicts: [
          {
            cellA1: 'D10',
            serverValue: '110',
            requestedOriginal: '100'
          }
        ],
        message: 'Conflict detected.'
      } satisfies Extract<UpdateResult, { status: 'conflict' }>)
    } as unknown as IDataStore;

    vi.mocked(getDataStore).mockReturnValue(store);

    const request = new Request('http://localhost/api/dashboard/block/Block%205/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [
          {
            cellA1: 'D10',
            field: 'actualLoad',
            originalValue: '100',
            newValue: '101'
          }
        ]
      })
    });

    const response = await POST(request, {
      params: Promise.resolve({ blockName: 'Block%205' })
    });
    const payload = (await response.json()) as Extract<UpdateResult, { status: 'conflict' }>;

    expect(response.status).toBe(409);
    expect(payload.status).toBe('conflict');
    expect(payload.conflicts).toHaveLength(1);
  });

  it('passes decoded block name and forceOverwrite through to datastore', async () => {
    vi.mocked(getUserContext).mockResolvedValue(baseUser);

    const okResult: Extract<UpdateResult, { status: 'ok' }> = {
      status: 'ok',
      updatedRows: [],
      stats: {} as Extract<UpdateResult, { status: 'ok' }>['stats'],
      parserReport: {} as Extract<UpdateResult, { status: 'ok' }>['parserReport']
    };

    const store = {
      updateBlockCells: vi.fn().mockResolvedValue(okResult)
    } as unknown as IDataStore;

    vi.mocked(getDataStore).mockReturnValue(store);

    const request = new Request('http://localhost/api/dashboard/block/Block%205/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [
          {
            cellA1: 'E18',
            field: 'rpe',
            originalValue: '@ 8',
            newValue: '@ 8.5'
          }
        ],
        forceOverwrite: true
      })
    });

    const response = await POST(request, {
      params: Promise.resolve({ blockName: 'Block%205' })
    });

    expect(response.status).toBe(200);
    expect(store.updateBlockCells).toHaveBeenCalledWith(
      baseUser,
      'Block 5',
      [
        {
          cellA1: 'E18',
          field: 'rpe',
          originalValue: '@ 8',
          newValue: '@ 8.5'
        }
      ],
      true
    );
  });
});
