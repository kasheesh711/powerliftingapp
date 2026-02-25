import { getPrismaClient } from './prisma';

const inMemorySelections = new Map<string, { spreadsheetId: string; spreadsheetUrl?: string }>();

export interface SelectedSpreadsheet {
  spreadsheetId: string;
  spreadsheetUrl?: string;
}

export async function getSelectedSpreadsheetSelection(
  userId: string
): Promise<SelectedSpreadsheet | null> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const record = await prisma.userSpreadsheetSelection.findUnique({
        where: { userId }
      });

      if (record?.spreadsheetId) {
        return {
          spreadsheetId: record.spreadsheetId,
          spreadsheetUrl: record.spreadsheetUrl ?? undefined
        };
      }
    } catch {
      // Fall through to in-memory fallback.
    }
  }

  return inMemorySelections.get(userId) || null;
}

export async function getSelectedSpreadsheet(userId: string): Promise<string | null> {
  const selected = await getSelectedSpreadsheetSelection(userId);
  return selected?.spreadsheetId || null;
}

export async function saveSelectedSpreadsheet(
  userId: string,
  input: { spreadsheetId: string; spreadsheetUrl?: string }
): Promise<void> {
  const prisma = getPrismaClient();

  if (prisma) {
    try {
      await prisma.userSpreadsheetSelection.upsert({
        where: { userId },
        create: {
          userId,
          spreadsheetId: input.spreadsheetId,
          spreadsheetUrl: input.spreadsheetUrl
        },
        update: {
          spreadsheetId: input.spreadsheetId,
          spreadsheetUrl: input.spreadsheetUrl
        }
      });

      return;
    } catch {
      // Fall back to in-memory store.
    }
  }

  inMemorySelections.set(userId, input);
}
