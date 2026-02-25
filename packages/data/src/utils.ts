export function normalizeHeader(str: unknown): string {
  if (str === null || str === undefined) {
    return '';
  }

  return String(str).trim().toLowerCase().replace(/\s+/g, ' ');
}

export function colIndexToA1(colIndex: number, rowNumber: number): string {
  let letter = '';
  let c = colIndex + 1;

  while (c > 0) {
    const temp = (c - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    c = (c - temp - 1) / 26;
  }

  return `${letter}${rowNumber}`;
}

export function a1ToRowCol(cellA1: string): { rowIndex: number; colIndex: number } {
  const match = String(cellA1).trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid A1 cell reference: ${cellA1}`);
  }

  const colLetters = match[1];
  const row = Number.parseInt(match[2], 10);

  let col = 0;
  for (let i = 0; i < colLetters.length; i++) {
    col = col * 26 + (colLetters.charCodeAt(i) - 64);
  }

  return {
    rowIndex: row - 1,
    colIndex: col - 1
  };
}

export function parseNumberOrNull(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const n = Number.parseFloat(String(value));
  return Number.isNaN(n) ? null : n;
}

export function parseIntOrNull(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const n = Number.parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
}

export function parseDisplayNumberOrNull(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const cleaned = String(value).replace(/,/g, '').trim();
  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const n = Number.parseFloat(match[0]);
  return Number.isNaN(n) ? null : n;
}

export function isA1Cell(text: string): boolean {
  return /^[A-Za-z]+\d+$/.test(text.trim());
}
