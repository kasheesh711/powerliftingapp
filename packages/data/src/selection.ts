const SPREADSHEET_ID_REGEX = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

export function parseSpreadsheetIdFromUrl(spreadsheetUrl: string): string | null {
  const match = String(spreadsheetUrl).match(SPREADSHEET_ID_REGEX);
  return match ? match[1] : null;
}

export function resolveSpreadsheetId(input: {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
}): string {
  if (input.spreadsheetId) {
    return input.spreadsheetId;
  }

  if (input.spreadsheetUrl) {
    const fromUrl = parseSpreadsheetIdFromUrl(input.spreadsheetUrl);
    if (fromUrl) {
      return fromUrl;
    }
  }

  throw new Error('Unable to resolve spreadsheet ID from request payload.');
}
