import type { UserContext } from '@powerlifting/domain';

import { auth } from '@/auth';

import { getSelectedSpreadsheet } from './selection-repo';

interface GetUserContextOptions {
  requireAuth?: boolean;
}

function localAuthBypassEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  const raw = process.env.ALLOW_LOCAL_DEV_AUTH_BYPASS;
  if (!raw) {
    return true;
  }

  return raw.toLowerCase() !== 'false';
}

export function shouldRequireDashboardAuth(): boolean {
  return process.env.NODE_ENV === 'production';
}

export async function getUserContext(options: GetUserContextOptions = {}): Promise<UserContext> {
  const session = (await auth()) as { user?: { email?: string | null } } | null;
  const email = session?.user?.email?.trim().toLowerCase() || null;
  const allowBypass = localAuthBypassEnabled();

  if (!email && (options.requireAuth || !allowBypass)) {
    throw new Error('Unauthorized');
  }

  const userId = email || 'local-dev@example.com';

  const selectedSpreadsheetId = await getSelectedSpreadsheet(userId);
  const spreadsheetId =
    selectedSpreadsheetId || process.env.SOURCE_SPREADSHEET_ID || 'local-workbook';

  return {
    userId,
    spreadsheetId
  };
}
