import { NextResponse } from 'next/server';

import { blockQuerySchema, loadDashboardPayload } from '@powerlifting/domain';

import { getDataStore } from '@/lib/datastore';
import { jsonApiError } from '@/lib/http';
import { getUserContext, shouldRequireDashboardAuth } from '@/lib/user-context';

interface Params {
  params: Promise<{ blockName: string }>;
}

export async function GET(request: Request, context: Params): Promise<NextResponse> {
  try {
    const { blockName } = await context.params;

    const searchParams = new URL(request.url).searchParams;
    const query = blockQuerySchema.parse({
      forceRefresh: searchParams.get('forceRefresh') || undefined
    });

    const store = getDataStore();
    const user = await getUserContext({
      requireAuth: shouldRequireDashboardAuth()
    });

    const payload = await loadDashboardPayload(store, user, decodeURIComponent(blockName), {
      forceRefresh: query.forceRefresh
    });

    return NextResponse.json(payload);
  } catch (error) {
    return jsonApiError(error);
  }
}
