import { createDefaultBasics, createDefaultConfig } from './defaults';
import { computeAllStats, computePrimaryLiftProgressForRows } from './stats';
import type { BlockData } from './types';

describe('stats', () => {
  it('computes primary lift progression across weeks', () => {
    const primary = computePrimaryLiftProgressForRows([
      {
        sheetName: 'Block 5',
        groupLabel: 'Day 1 - Week 1',
        rowIndex: 10,
        exercise: 'Competition Squat',
        sets: 1,
        reps: 3,
        targetLoadKg: 100,
        actualLoadKg: 102.5,
        actualLoadCell: 'I10',
        rpe: '@ 8',
        rpeCell: 'J10',
        e1rm: 112.75,
        notes: '',
        weekIndex: 1,
        dayIndex: 1,
        dayLabel: 'Day 1',
        weekLabel: 'Week 1',
        dayName: 'Monday',
        dayRowIndex: 8,
        weekSectionId: 'day1-week1',
        daySectionId: 'day1'
      },
      {
        sheetName: 'Block 5',
        groupLabel: 'Day 1 - Week 2',
        rowIndex: 11,
        exercise: 'Competition Squat',
        sets: 1,
        reps: 3,
        targetLoadKg: 105,
        actualLoadKg: 107.5,
        actualLoadCell: 'P11',
        rpe: '@ 8',
        rpeCell: 'Q11',
        e1rm: 118.25,
        notes: '',
        weekIndex: 2,
        dayIndex: 1,
        dayLabel: 'Day 1',
        weekLabel: 'Week 2',
        dayName: 'Monday',
        dayRowIndex: 8,
        weekSectionId: 'day1-week2',
        daySectionId: 'day1'
      }
    ]);

    expect(primary.weeks).toHaveLength(2);
    expect(primary.summary.squat.delta).toBe(5);
  });

  it('computes total stats and growth', () => {
    const blockData: BlockData = {
      rows: [
        {
          sheetName: 'Block 5',
          groupLabel: 'Day 1 - Week 1',
          rowIndex: 10,
          exercise: 'Squat',
          sets: 1,
          reps: 3,
          targetLoadKg: 100,
          actualLoadKg: 100,
          actualLoadCell: 'I10',
          rpe: '@ 8',
          rpeCell: 'J10',
          e1rm: 110,
          notes: '',
          weekIndex: 1,
          dayIndex: 1,
          dayLabel: 'Day 1',
          weekLabel: 'Week 1',
          dayName: '',
          dayRowIndex: 8,
          weekSectionId: 'day1-week1',
          daySectionId: 'day1'
        },
        {
          sheetName: 'Block 5',
          groupLabel: 'Day 2 - Week 1',
          rowIndex: 20,
          exercise: 'Bench Press',
          sets: 1,
          reps: 3,
          targetLoadKg: 70,
          actualLoadKg: 70,
          actualLoadCell: 'I20',
          rpe: '@ 8',
          rpeCell: 'J20',
          e1rm: 77,
          notes: '',
          weekIndex: 1,
          dayIndex: 2,
          dayLabel: 'Day 2',
          weekLabel: 'Week 1',
          dayName: '',
          dayRowIndex: 18,
          weekSectionId: 'day2-week1',
          daySectionId: 'day2'
        },
        {
          sheetName: 'Block 5',
          groupLabel: 'Day 3 - Week 1',
          rowIndex: 30,
          exercise: 'Deadlift',
          sets: 1,
          reps: 3,
          targetLoadKg: 150,
          actualLoadKg: 150,
          actualLoadCell: 'I30',
          rpe: '@ 8',
          rpeCell: 'J30',
          e1rm: 165,
          notes: '',
          weekIndex: 1,
          dayIndex: 3,
          dayLabel: 'Day 3',
          weekLabel: 'Week 1',
          dayName: '',
          dayRowIndex: 28,
          weekSectionId: 'day3-week1',
          daySectionId: 'day3'
        }
      ],
      recaps: {
        squat: '',
        bench: '',
        deadlift: '',
        accessory: '',
        additions: '',
        coach: ''
      },
      peakE1RMs: {
        squat: 112,
        bench: 78,
        deadlift: 170
      },
      parserReport: {
        sheetName: 'Block 5',
        groupsFound: 1,
        groups: [],
        warnings: [],
        mappedRows: 3,
        daySectionsFound: 3,
        activeDays: 3,
        plannedWeekCount: 1,
        activeWeekCount: 1,
        daySummaries: [],
        layoutVariant: 'day_marker_template'
      }
    };

    const basics = createDefaultBasics();
    basics.squatBaseline = 90;
    basics.benchBaseline = 60;
    basics.deadliftBaseline = 140;

    const stats = computeAllStats(blockData, basics, createDefaultConfig());

    expect(stats.current.total).toBe(320);
    expect(stats.projected.total).toBe(360);
    expect(stats.growth.total.delta).toBe(70);
  });
});
