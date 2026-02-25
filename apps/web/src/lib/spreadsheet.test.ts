import { parseSpreadsheetIdFromUrl } from './spreadsheet';

describe('parseSpreadsheetIdFromUrl', () => {
  it('parses spreadsheet id from full URL', () => {
    const id = parseSpreadsheetIdFromUrl(
      'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit#gid=0'
    );
    expect(id).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890');
  });

  it('accepts raw spreadsheet id', () => {
    const id = parseSpreadsheetIdFromUrl('1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890');
    expect(id).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890');
  });

  it('returns null when unparsable', () => {
    const id = parseSpreadsheetIdFromUrl('hello world');
    expect(id).toBeNull();
  });
});
