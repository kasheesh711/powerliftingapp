import { NextResponse } from 'next/server';

import { jsonApiError } from '@/lib/http';
import { getUserContext } from '@/lib/user-context';

export async function GET(): Promise<NextResponse> {
  try {
    await getUserContext({
      requireAuth: true
    });

    const apiKey = process.env.GOOGLE_PICKER_API_KEY || '';
    const appId = process.env.GOOGLE_PICKER_APP_ID || '';

    return NextResponse.json({
      enabled: Boolean(apiKey && appId),
      apiKey: apiKey || null,
      appId: appId || null
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
