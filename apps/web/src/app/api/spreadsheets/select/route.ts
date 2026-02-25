import { NextResponse } from 'next/server';

import { resolveSpreadsheetId } from '@powerlifting/data';
import { spreadsheetSelectSchema } from '@powerlifting/domain';

import {
  getSelectedSpreadsheetSelection,
  saveSelectedSpreadsheet
} from '@/lib/selection-repo';
import { jsonApiError } from '@/lib/http';
import { getUserContext } from '@/lib/user-context';

export async function GET(): Promise<NextResponse> {
  try {
    const user = await getUserContext({
      requireAuth: true
    });
    const selected = await getSelectedSpreadsheetSelection(user.userId);

    return NextResponse.json({
      selectedSpreadsheet: selected
    });
  } catch (error) {
    return jsonApiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = spreadsheetSelectSchema.parse(await request.json());
    const user = await getUserContext({
      requireAuth: true
    });

    const spreadsheetId = resolveSpreadsheetId(body);

    await saveSelectedSpreadsheet(user.userId, {
      spreadsheetId,
      spreadsheetUrl: body.spreadsheetUrl
    });

    return NextResponse.json({
      ok: true,
      spreadsheetId,
      spreadsheetUrl: body.spreadsheetUrl
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
