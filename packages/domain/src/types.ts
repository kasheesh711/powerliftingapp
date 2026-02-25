export type Sex = 'male' | 'female';

export interface UserContext {
  userId: string;
  spreadsheetId: string;
}

export interface BlockDescriptor {
  sheetId?: string;
  name: string;
  blockNum: string | null;
  year: string | null;
  isRecap: boolean;
  isBlock: boolean;
}

export interface Basics {
  bodyweight: number;
  sex: Sex;
  squatBaseline: number | null;
  benchBaseline: number | null;
  deadliftBaseline: number | null;
}

export interface Coefficients {
  [key: string]: Record<string, number>;
}

export interface AppConfig {
  coefficients: Coefficients;
  disableWrites: boolean;
}

export interface ParserWeekGroup {
  weekIndex: number;
  weekLabel: string;
  weekSectionId: string;
  actualLoadCol: number | null;
  rpeCol: number | null;
  targetLoadCol: number | null;
}

export interface ParserDayGroup {
  daySectionId: string;
  dayIndex: number;
  dayLabel: string;
  dayName: string;
  dayRowIndex: number;
  headerRowIndex: number;
  weekGroups: ParserWeekGroup[];
}

export interface DaySummaryWeek {
  weekIndex: number;
  weekLabel: string;
  weekSectionId: string;
  mappedRows: number;
  hasTargetOrActual: boolean;
}

export interface DaySummary {
  daySectionId: string;
  dayIndex: number;
  dayLabel: string;
  dayName: string;
  dayRowIndex: number;
  headerRowIndex: number;
  plannedWeekCount: number;
  exerciseCount: number;
  mappedRows: number;
  isActive: boolean;
  weekSummaries: DaySummaryWeek[];
}

export interface ParserReport {
  sheetName: string;
  groupsFound: number;
  groups: ParserDayGroup[];
  warnings: string[];
  mappedRows: number;
  daySectionsFound: number;
  activeDays: number;
  plannedWeekCount: number;
  activeWeekCount: number;
  daySummaries: DaySummary[];
  layoutVariant: 'unknown' | 'day_marker_template' | 'header_repeat_fallback';
}

export interface BlockRow {
  sheetName: string;
  groupLabel: string;
  rowIndex: number | string;
  exercise: string;
  sets: string | number;
  reps: string | number;
  targetLoadKg: number | string | null;
  actualLoadKg: number | null;
  actualLoadCell: string | null;
  rpe: string | null;
  rpeCell: string | null;
  e1rm: number | null;
  notes: string;
  weekIndex: number | null;
  dayIndex: number | null;
  dayLabel: string;
  weekLabel: string;
  dayName: string;
  dayRowIndex: number | null;
  weekSectionId: string;
  daySectionId: string;
}

export interface Recaps {
  squat: string;
  bench: string;
  deadlift: string;
  accessory: string;
  additions: string;
  coach: string;
}

export interface PeakE1RMs {
  squat: number | null;
  bench: number | null;
  deadlift: number | null;
}

export interface BlockData {
  rows: BlockRow[];
  recaps: Recaps;
  peakE1RMs: PeakE1RMs;
  parserReport: ParserReport;
}

export interface StatTotal {
  total: number;
  dots: number;
  wilks: number;
  gl: number;
}

export interface GrowthLift {
  baseline: number;
  projected: number;
  delta: number;
  deltaPct: number;
}

export interface PrimaryLiftPoint {
  loadKg: number;
  e1rm: number | null;
  dayIndex: number | null;
  dayLabel: string;
  rowIndex: number | null;
  exercise: string;
}

export interface PrimaryWeek {
  weekIndex: number;
  squat: PrimaryLiftPoint | null;
  bench: PrimaryLiftPoint | null;
  deadlift: PrimaryLiftPoint | null;
}

export interface PrimarySummary {
  start: number | null;
  end: number | null;
  delta: number;
  deltaPct: number;
}

export interface PrimaryByWeek {
  weeks: PrimaryWeek[];
  labels: string[];
  series: {
    squat: Array<number | null>;
    bench: Array<number | null>;
    deadlift: Array<number | null>;
  };
  summary: {
    squat: PrimarySummary;
    bench: PrimarySummary;
    deadlift: PrimarySummary;
  };
}

export interface OverallTimelinePoint {
  label: string;
  blockName: string;
  blockNum: string;
  weekIndex: number;
  squat: PrimaryLiftPoint | null;
  bench: PrimaryLiftPoint | null;
  deadlift: PrimaryLiftPoint | null;
}

export interface OverallPrimaryProgress {
  timeline: OverallTimelinePoint[];
  blocks: Array<{
    blockName: string;
    blockNum: string;
    weeks: PrimaryWeek[];
    summary: PrimaryByWeek['summary'];
  }>;
  summary: {
    squat: PrimarySummary;
    bench: PrimarySummary;
    deadlift: PrimarySummary;
  };
}

export interface Stats {
  current: StatTotal;
  projected: StatTotal;
  growth: {
    squat: GrowthLift;
    bench: GrowthLift;
    deadlift: GrowthLift;
    total: GrowthLift;
  };
  primaryByWeek: PrimaryByWeek;
}

export interface InitialPayload {
  blocks: BlockDescriptor[];
  basics: Basics;
  config: AppConfig;
}

export interface CellUpdateInput {
  cellA1: string;
  newValue: string | number;
  originalValue: string | number | null;
  field: 'actualLoad' | 'rpe';
}

export interface ConflictDetail {
  cellA1: string;
  serverValue: string;
  requestedOriginal: string | number | null;
}

export type UpdateResult =
  | {
      status: 'ok';
      updatedRows: BlockRow[];
      stats: Stats;
      parserReport: ParserReport;
    }
  | {
      status: 'conflict';
      conflicts: ConflictDetail[];
      message: string;
    };

export interface DashboardPayload {
  blockData: BlockData;
  stats: Stats;
  basics: Basics;
  config: AppConfig;
  overallProgress: OverallPrimaryProgress;
}
