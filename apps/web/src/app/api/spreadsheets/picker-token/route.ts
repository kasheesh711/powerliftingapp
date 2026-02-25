import { NextResponse } from 'next/server';

import { jsonApiError } from '@/lib/http';
import { getValidGoogleAccessToken } from '@/lib/token-vault-repo';
import { getUserContext } from '@/lib/user-context';

export async function GET(): Promise<NextResponse> {
  try {
    const user = await getUserContext({
      requireAuth: true
    });
    const token = await getValidGoogleAccessToken(user.userId);

    if (!token) {
      return NextResponse.json(
        {
          error: 'No Google token available. Sign in with Google first.',
          code: 'GOOGLE_TOKEN_MISSING'
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      accessToken: token.accessToken,
      expiresAt: token.expiryDate
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
