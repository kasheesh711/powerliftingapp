export function parseSpreadsheetIdFromUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const directIdMatch = trimmed.match(/^[a-zA-Z0-9-_]{20,}$/);
  if (directIdMatch) {
    return trimmed;
  }

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
  if (!urlMatch) {
    return null;
  }

  return urlMatch[1];
}
