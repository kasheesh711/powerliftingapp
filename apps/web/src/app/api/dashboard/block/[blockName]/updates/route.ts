import { NextResponse } from 'next/server';

import { updateBlockCellsBodySchema } from '@powerlifting/domain';

import { getDataStore } from '@/lib/datastore';
import { jsonApiError } from '@/lib/http';
import { getUserContext, shouldRequireDashboardAuth } from '@/lib/user-context';

interface Params {
  params: Promise<{ blockName: string }>;
}

export async function POST(request: Request, context: Params): Promise<NextResponse> {
  try {
    const { blockName } = await context.params;
    const body = updateBlockCellsBodySchema.parse(await request.json());

    const store = getDataStore();
    const user = await getUserContext({
      requireAuth: shouldRequireDashboardAuth()
    });

    const result = await store.updateBlockCells(
      user,
      decodeURIComponent(blockName),
      body.updates,
      body.forceOverwrite
    );

    if (result.status === 'conflict') {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return jsonApiError(error);
  }
}
