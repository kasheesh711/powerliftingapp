import {
  blockQuerySchema,
  spreadsheetSelectSchema,
  updateBlockCellsBodySchema,
  updateResultSchema
} from './contracts';

describe('contracts', () => {
  it('parses block query forceRefresh', () => {
    const parsed = blockQuerySchema.parse({ forceRefresh: 'true' });
    expect(parsed.forceRefresh).toBe(true);
  });

  it('rejects update fields outside allowlist', () => {
    expect(() =>
      updateBlockCellsBodySchema.parse({
        updates: [
          {
            cellA1: 'A1',
            newValue: 'x',
            originalValue: 'y',
            field: 'notes'
          }
        ]
      })
    ).toThrow();
  });

  it('accepts either spreadsheetId or spreadsheetUrl', () => {
    const byId = spreadsheetSelectSchema.parse({ spreadsheetId: 'abc123' });
    expect(byId.spreadsheetId).toBe('abc123');

    const byUrl = spreadsheetSelectSchema.parse({
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/abc123/edit'
    });
    expect(byUrl.spreadsheetUrl).toContain('docs.google.com');
  });

  it('validates conflict response shape', () => {
    const parsed = updateResultSchema.parse({
      status: 'conflict',
      conflicts: [{ cellA1: 'B2', serverValue: '90', requestedOriginal: '85' }],
      message: 'conflict'
    });

    expect(parsed.status).toBe('conflict');
  });
});
