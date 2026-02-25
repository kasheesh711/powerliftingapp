import { NextResponse } from 'next/server';

import { getDataStore } from '@/lib/datastore';
import { jsonApiError } from '@/lib/http';
import { getUserContext, shouldRequireDashboardAuth } from '@/lib/user-context';

export async function GET(): Promise<NextResponse> {
  try {
    const user = await getUserContext({
      requireAuth: shouldRequireDashboardAuth()
    });
    const store = getDataStore();

    const payload = await store.getInitialPayload(user);
    return NextResponse.json(payload);
  } catch (error) {
    return jsonApiError(error);
  }
}
