import type { BlockRow, OverallTimelinePoint, PrimaryByWeek, Stats } from '@powerlifting/domain';
import { describe, expect, it } from 'vitest';

import { buildBlockPrimaryWeekSeries, buildGrowthDeltaData, buildOverallTimelineSeries, groupRowsByWeek } from './view-models';

function makeRow(overrides: Partial<BlockRow>): BlockRow {
  return {
    sheetName: 'Block 5',
    groupLabel: 'Day Group',
    rowIndex: 10,
    exercise: 'Squat',
    sets: '1',
    reps: '1',
    targetLoadKg: null,
    actualLoadKg: 100,
    actualLoadCell: 'H10',
    rpe: '@ 8',
    rpeCell: 'I10',
    e1rm: null,
    notes: '',
    weekIndex: 1,
    dayIndex: 1,
    dayLabel: 'Day 1',
    weekLabel: 'Week 1',
    dayName: 'Monday',
    dayRowIndex: 8,
    weekSectionId: 'week-1',
    daySectionId: 'day-1',
    ...overrides
  };
}

function point(label: string, blockName: string, blockNum: string, squat: number | null): OverallTimelinePoint {
  return {
    label,
    blockName,
    blockNum,
    weekIndex: 1,
    squat: squat === null ? null : { loadKg: squat, e1rm: null, dayIndex: 1, dayLabel: 'D1', rowIndex: 10, exercise: 'Squat' },
    bench: null,
    deadlift: null
  };
}

describe('buildOverallTimelineSeries', () => {
  it('maps timeline and marks block transitions', () => {
    const timeline = [
      point('B1 W1', 'Block 1 - Intro', '1', 100),
      point('B1 W2', 'Block 1 - Intro', '1', 102.5),
      point('B2 W1', 'Block 2', '2', 105)
    ];

    const result = buildOverallTimelineSeries(timeline);

    expect(result.data).toHaveLength(3);
    expect(result.data[0].squat).toBe(100);
    expect(result.boundaries).toHaveLength(1);
    expect(result.boundaries[0]).toMatchObject({ position: 1.5, label: 'B2' });
    expect(result.hasAnyValue).toBe(true);
  });

  it('reports no values when timeline points are null', () => {
    const timeline = [point('B1 W1', 'Block 1 - Intro', '1', null)];
    const result = buildOverallTimelineSeries(timeline);

    expect(result.hasAnyValue).toBe(false);
    expect(result.boundaries).toEqual([]);
  });
});

describe('buildBlockPrimaryWeekSeries', () => {
  it('converts weekly summary into chart rows', () => {
    const primaryByWeek: PrimaryByWeek = {
      weeks: [
        {
          weekIndex: 1,
          squat: { loadKg: 100, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 10, exercise: 'Squat' },
          bench: null,
          deadlift: null
        },
        {
          weekIndex: 2,
          squat: null,
          bench: { loadKg: 80, e1rm: null, dayIndex: 2, dayLabel: 'Day 2', rowIndex: 16, exercise: 'Bench' },
          deadlift: null
        }
      ],
      labels: ['W1', 'W2'],
      series: {
        squat: [100, null],
        bench: [null, 80],
        deadlift: [null, null]
      },
      summary: {
        squat: { start: 100, end: 100, delta: 0, deltaPct: 0 },
        bench: { start: 80, end: 80, delta: 0, deltaPct: 0 },
        deadlift: { start: null, end: null, delta: 0, deltaPct: 0 }
      }
    };

    const result = buildBlockPrimaryWeekSeries(primaryByWeek);

    expect(result.data).toHaveLength(2);
    expect(result.data[1]).toMatchObject({ label: 'W2', bench: 80, squat: null });
    expect(result.hasAnyValue).toBe(true);
  });
});

describe('groupRowsByWeek', () => {
  it('groups rows in contiguous week sections with fallback labels', () => {
    const rows = [
      makeRow({ rowIndex: 1, weekIndex: 1, weekLabel: 'Week 1' }),
      makeRow({ rowIndex: 2, weekIndex: 1, weekLabel: 'Week 1', dayLabel: 'Day 2' }),
      makeRow({ rowIndex: 3, weekIndex: 2, weekLabel: 'Week 2' }),
      makeRow({ rowIndex: 4, weekIndex: null, weekLabel: 'Taper Week' }),
      makeRow({ rowIndex: 5, weekIndex: null, weekLabel: '', dayLabel: 'Day X' })
    ];

    const groups = groupRowsByWeek(rows);

    expect(groups).toHaveLength(4);
    expect(groups.map((group) => group.label)).toEqual(['Week 1', 'Week 2', 'Taper Week', 'Unassigned Week']);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[3].rows[0].rowIndex).toBe(5);
  });
});

describe('buildGrowthDeltaData', () => {
  it('maps growth metrics into deterministic chart order', () => {
    const growth: Stats['growth'] = {
      squat: { baseline: 180, projected: 200, delta: 20, deltaPct: 11.1 },
      bench: { baseline: 120, projected: 130, delta: 10, deltaPct: 8.3 },
      deadlift: { baseline: 220, projected: 250, delta: 30, deltaPct: 13.6 },
      total: { baseline: 520, projected: 580, delta: 60, deltaPct: 11.5 }
    };

    const rows = buildGrowthDeltaData(growth);

    expect(rows.map((row) => row.id)).toEqual(['squat', 'bench', 'deadlift', 'total']);
    expect(rows[2]).toMatchObject({ label: 'Deadlift', delta: 30, baseline: 220, projected: 250 });
  });
});
