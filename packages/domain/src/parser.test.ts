import { getAvailableBlocksFromSheetNames, parseBlockFromVisualGrid } from './parser';

describe('parser', () => {
  it('detects block sheets and recap sheets', () => {
    const blocks = getAvailableBlocksFromSheetNames([
      'Warm up',
      'Block 1',
      'Block 1 (continuation)',
      'Block RECAP',
      '_DB_Blocks'
    ]);

    expect(blocks.find((b) => b.name === 'Block 1')?.isBlock).toBe(true);
    expect(blocks.find((b) => b.name === 'Block RECAP')?.isRecap).toBe(true);
    expect(blocks.find((b) => b.name === '_DB_Blocks')).toBeUndefined();
  });

  it('parses day marker template rows', () => {
    const grid = [
      ['', 'DAY 1'],
      ['', '', 'LABEL', 'EXERCISE', 'SETS', 'REPS', 'TARGET LOAD (Kg)', 'ACTUAL LOAD (Kg)', 'RPE', 'E1RM'],
      ['', '', 'squat', 'Competition Squat', '1', '3', '120', '125', '@ 8', '136'],
      ['', '', 'bench', 'Bench Press', '1', '4', '80', '82.5', '@ 8', '92']
    ];

    const data = parseBlockFromVisualGrid('Block 1', grid);
    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.parserReport.layoutVariant).toBe('day_marker_template');
  });
});
