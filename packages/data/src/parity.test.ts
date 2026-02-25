import type { IDataStore, UserContext } from '@powerlifting/domain';

import { runParityComparison } from './parity';

function makeStore(value: number): IDataStore {
  return {
    async getInitialPayload() {
      return {
        blocks: [],
        basics: {
          bodyweight: 80,
          sex: 'male',
          squatBaseline: null,
          benchBaseline: null,
          deadliftBaseline: null
        },
        config: {
          coefficients: {},
          disableWrites: false
        }
      };
    },
    async getAvailableBlocks() {
      return [];
    },
    async getBlockData() {
      return {
        rows: [
          {
            sheetName: 'Block 5',
            groupLabel: 'Day 1 - Week 1',
            rowIndex: 1,
            exercise: 'Squat',
            sets: 1,
            reps: 1,
            targetLoadKg: 100,
            actualLoadKg: value,
            actualLoadCell: 'A1',
            rpe: '@ 8',
            rpeCell: 'A2',
            e1rm: value,
            notes: '',
            weekIndex: 1,
            dayIndex: 1,
            dayLabel: 'Day 1',
            weekLabel: 'Week 1',
            dayName: '',
            dayRowIndex: 1,
            weekSectionId: 'day1-week1',
            daySectionId: 'day1'
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
          squat: value,
          bench: null,
          deadlift: null
        },
        parserReport: {
          sheetName: 'Block 5',
          groupsFound: 1,
          groups: [],
          warnings: [],
          mappedRows: 1,
          daySectionsFound: 1,
          activeDays: 1,
          plannedWeekCount: 1,
          activeWeekCount: 1,
          daySummaries: [],
          layoutVariant: 'day_marker_template'
        }
      };
    },
    async getOverallPrimaryProgress() {
      return {
        timeline: [],
        blocks: [],
        summary: {
          squat: { start: null, end: null, delta: 0, deltaPct: 0 },
          bench: { start: null, end: null, delta: 0, deltaPct: 0 },
          deadlift: { start: null, end: null, delta: 0, deltaPct: 0 }
        }
      };
    },
    async updateBlockCells() {
      return {
        status: 'ok',
        updatedRows: [],
        stats: {
          current: { total: 0, dots: 0, wilks: 0, gl: 0 },
          projected: { total: 0, dots: 0, wilks: 0, gl: 0 },
          growth: {
            squat: { baseline: 0, projected: 0, delta: 0, deltaPct: 0 },
            bench: { baseline: 0, projected: 0, delta: 0, deltaPct: 0 },
            deadlift: { baseline: 0, projected: 0, delta: 0, deltaPct: 0 },
            total: { baseline: 0, projected: 0, delta: 0, deltaPct: 0 }
          },
          primaryByWeek: {
            weeks: [],
            labels: [],
            series: { squat: [], bench: [], deadlift: [] },
            summary: {
              squat: { start: null, end: null, delta: 0, deltaPct: 0 },
              bench: { start: null, end: null, delta: 0, deltaPct: 0 },
              deadlift: { start: null, end: null, delta: 0, deltaPct: 0 }
            }
          }
        },
        parserReport: {
          sheetName: 'x',
          groupsFound: 0,
          groups: [],
          warnings: [],
          mappedRows: 0,
          daySectionsFound: 0,
          activeDays: 0,
          plannedWeekCount: 0,
          activeWeekCount: 0,
          daySummaries: [],
          layoutVariant: 'unknown'
        }
      };
    }
  };
}

describe('parity harness', () => {
  const user: UserContext = {
    userId: 'parity-user',
    spreadsheetId: 'sheet-1'
  };

  it('reports no mismatches for equal data', async () => {
    const results = await runParityComparison({
      excelStore: makeStore(100),
      googleStore: makeStore(100),
      user,
      blockNames: ['Block 5']
    });

    expect(results[0].matches).toBe(true);
  });

  it('captures mismatches', async () => {
    const results = await runParityComparison({
      excelStore: makeStore(100),
      googleStore: makeStore(101),
      user,
      blockNames: ['Block 5'],
      floatTolerance: 0
    });

    expect(results[0].matches).toBe(false);
    expect(results[0].mismatches.length).toBeGreaterThan(0);
  });
});
