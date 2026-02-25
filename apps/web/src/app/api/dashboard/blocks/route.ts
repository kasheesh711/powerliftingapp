import { NextResponse } from 'next/server';

import { blockQuerySchema } from '@powerlifting/domain';

import { getDataStore } from '@/lib/datastore';
import { jsonApiError } from '@/lib/http';
import { getUserContext, shouldRequireDashboardAuth } from '@/lib/user-context';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const searchParams = new URL(request.url).searchParams;
    const query = blockQuerySchema.parse({
      forceRefresh: searchParams.get('forceRefresh') || undefined
    });

    const user = await getUserContext({
      requireAuth: shouldRequireDashboardAuth()
    });
    const store = getDataStore();

    const blocks = await store.getAvailableBlocks(user, {
      forceRefresh: query.forceRefresh
    });
    return NextResponse.json(blocks);
  } catch (error) {
    return jsonApiError(error);
  }
}
