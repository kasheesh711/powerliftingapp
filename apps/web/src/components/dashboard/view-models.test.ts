import type { BlockRow, OverallPrimaryProgress, OverallTimelinePoint, PrimaryByWeek } from '@powerlifting/domain';
import { describe, expect, it } from 'vitest';

import {
  buildBlockComparisons,
  buildBlockPrimaryWeekSeries,
  buildGrowthRates,
  buildMeetProjection,
  buildOverallTimelineSeries,
  buildWeekDaySections,
  inferCurrentPosition,
  type GrowthRatesByLift
} from './view-models';

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

function makeGrowthRates(overrides: Partial<GrowthRatesByLift>): GrowthRatesByLift {
  return {
    squat: {
      lift: 'squat',
      label: 'Squat',
      current: 100,
      overallRate: 2,
      recentRate: 3,
      blendedRate: 2.6
    },
    bench: {
      lift: 'bench',
      label: 'Bench',
      current: 80,
      overallRate: 1,
      recentRate: 1.5,
      blendedRate: 1.3
    },
    deadlift: {
      lift: 'deadlift',
      label: 'Deadlift',
      current: 150,
      overallRate: 3,
      recentRate: 4,
      blendedRate: 3.6
    },
    ...overrides
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

describe('buildWeekDaySections', () => {
  it('sorts rows into week-first and day-ordered sections', () => {
    const rows = [
      makeRow({ rowIndex: 30, weekIndex: 2, dayIndex: 1, dayRowIndex: 5, exercise: 'Bench Press', actualLoadKg: 90 }),
      makeRow({ rowIndex: 20, weekIndex: 1, dayIndex: 2, dayRowIndex: 6, exercise: 'Deadlift', actualLoadKg: 180 }),
      makeRow({ rowIndex: 10, weekIndex: 1, dayIndex: 1, dayRowIndex: 4, exercise: 'Squat', actualLoadKg: 150 })
    ];

    const sections = buildWeekDaySections(rows);

    expect(sections).toHaveLength(2);
    expect(sections[0].weekIndex).toBe(1);
    expect(sections[0].days.map((day) => day.dayIndex)).toEqual([1, 2]);
    expect(sections[0].days[0].rows[0].rowIndex).toBe(10);
    expect(sections[1].weekIndex).toBe(2);
  });

  it('keeps unassigned week/day rows stable and grouped', () => {
    const rows = [
      makeRow({ rowIndex: 40, weekIndex: null, dayIndex: null, weekLabel: '', dayLabel: '', exercise: 'Cable Row' }),
      makeRow({ rowIndex: 41, weekIndex: null, dayIndex: null, weekLabel: '', dayLabel: '', exercise: 'DB Press' }),
      makeRow({ rowIndex: 10, weekIndex: 1, dayIndex: 1, exercise: 'Squat' }),
    ];

    const sections = buildWeekDaySections(rows);

    expect(sections).toHaveLength(2);
    expect(sections[1].label).toBe('Unassigned Week');
    expect(sections[1].days[0].label).toBe('Unassigned Day');
    expect(sections[1].days[0].rows.map((row) => row.exercise)).toEqual(['Cable Row', 'DB Press']);
  });
});

describe('inferCurrentPosition', () => {
  it('chooses latest day section crossing completion threshold', () => {
    const rows = [
      makeRow({ rowIndex: 10, weekIndex: 1, dayIndex: 1, actualLoadKg: 100 }),
      makeRow({ rowIndex: 11, weekIndex: 1, dayIndex: 1, actualLoadKg: 102.5 }),
      makeRow({ rowIndex: 20, weekIndex: 1, dayIndex: 2, actualLoadKg: 0 }),
      makeRow({ rowIndex: 21, weekIndex: 1, dayIndex: 2, actualLoadKg: 80 }),
      makeRow({ rowIndex: 30, weekIndex: 2, dayIndex: 1, actualLoadKg: 110 }),
      makeRow({ rowIndex: 31, weekIndex: 2, dayIndex: 1, actualLoadKg: 112.5 })
    ];

    const result = inferCurrentPosition(rows, 0.8);

    expect(result).toMatchObject({
      weekIndex: 2,
      dayIndex: 1,
      source: 'inferred'
    });
    expect(result.completionPct).toBe(100);
  });
});

describe('buildBlockComparisons', () => {
  it('builds deterministic block comparison rows', () => {
    const blocks: OverallPrimaryProgress['blocks'] = [
      {
        blockName: 'Block 4',
        blockNum: '4',
        weeks: [],
        summary: {
          squat: { start: 100, end: 110, delta: 10, deltaPct: 10 },
          bench: { start: 80, end: 85, delta: 5, deltaPct: 6.25 },
          deadlift: { start: 150, end: 162.5, delta: 12.5, deltaPct: 8.3 }
        }
      }
    ];

    const rows = buildBlockComparisons(blocks);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      blockLabel: 'B4',
      totalDelta: 27.5,
      squatDelta: 10,
      benchDelta: 5,
      deadliftDelta: 12.5
    });
  });
});

describe('buildGrowthRates', () => {
  it('blends recent and overall rates per lift', () => {
    const timeline: OverallTimelinePoint[] = [
      {
        label: 'B1 W1',
        blockName: 'Block 1',
        blockNum: '1',
        weekIndex: 1,
        squat: { loadKg: 100, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 1, exercise: 'Squat' },
        bench: { loadKg: 70, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 2, exercise: 'Bench Press' },
        deadlift: { loadKg: 140, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 3, exercise: 'Deadlift' }
      },
      {
        label: 'B1 W2',
        blockName: 'Block 1',
        blockNum: '1',
        weekIndex: 2,
        squat: { loadKg: 110, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 4, exercise: 'Squat' },
        bench: { loadKg: 75, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 5, exercise: 'Bench Press' },
        deadlift: { loadKg: 150, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 6, exercise: 'Deadlift' }
      },
      {
        label: 'B2 W1',
        blockName: 'Block 2',
        blockNum: '2',
        weekIndex: 1,
        squat: { loadKg: 120, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 7, exercise: 'Squat' },
        bench: { loadKg: 80, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 8, exercise: 'Bench Press' },
        deadlift: { loadKg: 160, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 9, exercise: 'Deadlift' }
      }
    ];

    const blocks: OverallPrimaryProgress['blocks'] = [
      {
        blockName: 'Block 1',
        blockNum: '1',
        weeks: [
          {
            weekIndex: 1,
            squat: { loadKg: 100, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 1, exercise: 'Squat' },
            bench: { loadKg: 70, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 2, exercise: 'Bench Press' },
            deadlift: { loadKg: 140, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 3, exercise: 'Deadlift' }
          },
          {
            weekIndex: 2,
            squat: { loadKg: 110, e1rm: null, dayIndex: 2, dayLabel: 'Day 2', rowIndex: 4, exercise: 'Squat' },
            bench: { loadKg: 75, e1rm: null, dayIndex: 2, dayLabel: 'Day 2', rowIndex: 5, exercise: 'Bench Press' },
            deadlift: { loadKg: 150, e1rm: null, dayIndex: 2, dayLabel: 'Day 2', rowIndex: 6, exercise: 'Deadlift' }
          }
        ],
        summary: {
          squat: { start: 100, end: 110, delta: 10, deltaPct: 10 },
          bench: { start: 70, end: 75, delta: 5, deltaPct: 7.1 },
          deadlift: { start: 140, end: 150, delta: 10, deltaPct: 7.1 }
        }
      },
      {
        blockName: 'Block 2',
        blockNum: '2',
        weeks: [
          {
            weekIndex: 1,
            squat: { loadKg: 112, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 7, exercise: 'Squat' },
            bench: { loadKg: 76, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 8, exercise: 'Bench Press' },
            deadlift: { loadKg: 151, e1rm: null, dayIndex: 1, dayLabel: 'Day 1', rowIndex: 9, exercise: 'Deadlift' }
          },
          {
            weekIndex: 2,
            squat: { loadKg: 120, e1rm: null, dayIndex: 2, dayLabel: 'Day 2', rowIndex: 10, exercise: 'Squat' },
            bench: { loadKg: 80, e1rm: null, dayIndex: 2, dayLabel: 'Day 2', rowIndex: 11, exercise: 'Bench Press' },
            deadlift: { loadKg: 160, e1rm: null, dayIndex: 2, dayLabel: 'Day 2', rowIndex: 12, exercise: 'Deadlift' }
          }
        ],
        summary: {
          squat: { start: 112, end: 120, delta: 8, deltaPct: 7.1 },
          bench: { start: 76, end: 80, delta: 4, deltaPct: 5.2 },
          deadlift: { start: 151, end: 160, delta: 9, deltaPct: 6 }
        }
      }
    ];

    const result = buildGrowthRates(timeline, blocks);

    expect(result.squat.current).toBe(120);
    expect(result.squat.overallRate).toBe(10);
    expect(result.squat.recentRate).toBe(9);
    expect(result.squat.blendedRate).toBe(9.4);
  });
});

describe('buildMeetProjection', () => {
  it('uses manual override rates for the log-decay start point', () => {
    const today = new Date();
    const future = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 56);
    const meetDate = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(
      future.getDate()
    ).padStart(2, '0')}`;

    const rows = [
      makeRow({ weekIndex: 1, dayIndex: 1, exercise: 'Squat', actualLoadKg: 100 }),
      makeRow({ weekIndex: 1, dayIndex: 1, exercise: 'Bench Press', actualLoadKg: 80 }),
      makeRow({ weekIndex: 1, dayIndex: 1, exercise: 'Deadlift', actualLoadKg: 150 })
    ];

    const growthRates = makeGrowthRates({
      squat: {
        lift: 'squat',
        label: 'Squat',
        current: 100,
        overallRate: 2,
        recentRate: 2,
        blendedRate: 2
      },
      bench: {
        lift: 'bench',
        label: 'Bench',
        current: 80,
        overallRate: 1,
        recentRate: 1,
        blendedRate: 1
      },
      deadlift: {
        lift: 'deadlift',
        label: 'Deadlift',
        current: 150,
        overallRate: 3,
        recentRate: 3,
        blendedRate: 3
      }
    });

    const projection = buildMeetProjection({
      rows,
      timeline: [],
      meetDate,
      currentPosition: {
        weekIndex: 1,
        dayIndex: 1,
        source: 'manual',
        completionPct: null
      },
      growthRates,
      modelSettings: {
        sex: 'male',
        bodyweightKg: 77,
        completedMeets: 0,
        selectedWeightClasses: ['74', '83'],
        manualRateOverrides: {
          squat: 4,
          bench: 3,
          deadlift: 5
        }
      }
    });

    expect(projection.current.total).toBe(330);
    expect(projection.weeksRemaining).toBeGreaterThan(0);
    expect(projection.rates.squat.usedStartRate).toBe(4);
    expect(projection.rates.bench.usedStartRate).toBe(3);
    expect(projection.rates.deadlift.usedStartRate).toBe(5);
    expect(projection.rates.squat.overrideApplied).toBe(true);
  });

  it('produces a lower projection than naive linear extrapolation when target rates are lower', () => {
    const today = new Date();
    const future = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 56);
    const meetDate = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(
      future.getDate()
    ).padStart(2, '0')}`;

    const rows = [
      makeRow({ weekIndex: 1, dayIndex: 1, exercise: 'Squat', actualLoadKg: 100 }),
      makeRow({ weekIndex: 1, dayIndex: 1, exercise: 'Bench Press', actualLoadKg: 80 }),
      makeRow({ weekIndex: 1, dayIndex: 1, exercise: 'Deadlift', actualLoadKg: 150 })
    ];

    const growthRates = makeGrowthRates({
      squat: {
        lift: 'squat',
        label: 'Squat',
        current: 100,
        overallRate: 2,
        recentRate: 2,
        blendedRate: 2
      },
      bench: {
        lift: 'bench',
        label: 'Bench',
        current: 80,
        overallRate: 1,
        recentRate: 1,
        blendedRate: 1
      },
      deadlift: {
        lift: 'deadlift',
        label: 'Deadlift',
        current: 150,
        overallRate: 3,
        recentRate: 3,
        blendedRate: 3
      }
    });

    const projection = buildMeetProjection({
      rows,
      timeline: [],
      meetDate,
      currentPosition: {
        weekIndex: 1,
        dayIndex: 1,
        source: 'manual',
        completionPct: null
      },
      growthRates,
      modelSettings: {
        sex: 'male',
        bodyweightKg: 77,
        completedMeets: 0,
        selectedWeightClasses: ['74', '83'],
        manualRateOverrides: {
          squat: 10,
          bench: 10,
          deadlift: 10
        }
      }
    });

    const linearProjection = projection.current.total + 30 * projection.weeksRemaining;

    expect(projection.projected.total).toBeLessThan(linearProjection);
    expect(projection.model.transitionLabel).toBe('1->2');
    expect(projection.model.selectedWeightClasses).toEqual(['74', '83']);
    expect(projection.rates.squat.targetRate).toBeGreaterThanOrEqual(0);
  });
});
