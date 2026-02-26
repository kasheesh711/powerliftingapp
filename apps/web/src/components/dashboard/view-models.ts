import type { BlockRow, OverallPrimaryProgress, OverallTimelinePoint, PrimaryByWeek } from '@powerlifting/domain';
import {
  getDefaultSelectedWeightClasses,
  normalizeSelectedWeightClasses,
  resolveOpenIpfProjectionTargets,
  type ProjectionSex,
} from './openipf-projection';

const LIFTS = ['squat', 'bench', 'deadlift'] as const;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

type PrimaryLift = (typeof LIFTS)[number];

export interface OverallTimelineDatum {
  index: number;
  label: string;
  blockName: string;
  blockNum: string;
  squat: number | null;
  bench: number | null;
  deadlift: number | null;
}

export interface BlockBoundaryMarker {
  position: number;
  label: string;
  blockName: string;
}

export interface OverallTimelineSeries {
  data: OverallTimelineDatum[];
  boundaries: BlockBoundaryMarker[];
  hasAnyValue: boolean;
}

export interface BlockPrimaryWeekDatum {
  index: number;
  weekIndex: number;
  label: string;
  squat: number | null;
  bench: number | null;
  deadlift: number | null;
}

export interface BlockPrimaryWeekSeries {
  data: BlockPrimaryWeekDatum[];
  hasAnyValue: boolean;
}

export interface DayRowSection {
  key: string;
  dayKey: string;
  dayIndex: number | null;
  label: string;
  dayName: string;
  rows: BlockRow[];
  completionPct: number;
}

export interface WeekDaySection {
  key: string;
  weekKey: string;
  weekIndex: number | null;
  label: string;
  rows: BlockRow[];
  days: DayRowSection[];
}

export interface CurrentPositionVM {
  weekIndex: number | null;
  dayIndex: number | null;
  source: 'manual' | 'inferred';
  completionPct: number | null;
}

export interface BlockComparisonVM {
  blockName: string;
  blockLabel: string;
  weekCount: number;
  startTotal: number | null;
  endTotal: number | null;
  totalDelta: number;
  squatDelta: number;
  benchDelta: number;
  deadliftDelta: number;
}

export interface GrowthRateVM {
  lift: PrimaryLift;
  label: string;
  current: number;
  overallRate: number;
  recentRate: number;
  blendedRate: number;
}

export type GrowthRatesByLift = Record<PrimaryLift, GrowthRateVM>;

export interface ProjectionModelSettingsVM {
  sex: ProjectionSex;
  bodyweightKg: number;
  completedMeets: number;
  selectedWeightClasses: string[];
  manualRateOverrides: Record<PrimaryLift, number | null>;
}

export interface ProjectionRateDetailsVM {
  lift: PrimaryLift;
  autoRate: number;
  usedStartRate: number;
  targetRate: number;
  sampleSize: number;
  transitionLabel: string;
  overrideApplied: boolean;
  usedFallback: boolean;
}

export interface MeetProjectionVM {
  meetDate: string;
  weeksRemaining: number;
  currentPosition: CurrentPositionVM;
  model: {
    sex: ProjectionSex;
    bodyweightKg: number;
    completedMeets: number;
    selectedWeightClasses: string[];
    transitionLabel: string;
    maxTransition: number;
    sampleSize: number;
  };
  rates: Record<PrimaryLift, ProjectionRateDetailsVM>;
  current: {
    squat: number;
    bench: number;
    deadlift: number;
    total: number;
  };
  projected: {
    squat: number;
    bench: number;
    deadlift: number;
    total: number;
  };
}

export interface DashboardAnalyticsVM {
  weekSections: WeekDaySection[];
  inferredPosition: CurrentPositionVM;
  blockComparisons: BlockComparisonVM[];
  growthRates: GrowthRatesByLift;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function numericOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function positiveIntOrNull(value: unknown): number | null {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function isValidLoad(value: unknown): boolean {
  const parsed = numericOrNull(value);
  return parsed !== null && parsed > 0;
}

function sumOrNull(values: Array<number | null>): number | null {
  if (values.some((value) => value === null)) {
    return null;
  }

  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function blockLabel(blockName: string, blockNum: string): string {
  if (blockNum) {
    return `B${blockNum}`;
  }

  return String(blockName || 'Block');
}

function canonicalLiftKey(exercise: unknown): PrimaryLift | null {
  const normalized = String(exercise || '').toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized.includes('bench')) {
    return 'bench';
  }

  if (normalized.includes('squat')) {
    return 'squat';
  }

  if (normalized.includes('deadlift') || /\bdl\b/.test(normalized)) {
    return 'deadlift';
  }

  return null;
}

function weekDescriptor(row: BlockRow): { key: string; label: string; weekIndex: number | null } {
  const weekIndex = positiveIntOrNull(row.weekIndex);
  const weekLabel = String(row.weekLabel || '').trim();

  if (weekIndex !== null) {
    return {
      key: `week-${weekIndex}`,
      label: weekLabel || `Week ${weekIndex}`,
      weekIndex
    };
  }

  if (weekLabel) {
    return {
      key: `week-label-${weekLabel.toLowerCase()}`,
      label: weekLabel,
      weekIndex: null
    };
  }

  return {
    key: 'week-unassigned',
    label: 'Unassigned Week',
    weekIndex: null
  };
}

function dayDescriptor(row: BlockRow): { key: string; label: string; dayIndex: number | null; dayName: string } {
  const dayIndex = positiveIntOrNull(row.dayIndex);
  const dayLabel = String(row.dayLabel || '').trim();
  const dayName = String(row.dayName || '').trim();

  if (dayIndex !== null) {
    return {
      key: `day-${dayIndex}`,
      label: dayLabel || `Day ${dayIndex}`,
      dayIndex,
      dayName
    };
  }

  if (dayLabel) {
    return {
      key: `day-label-${dayLabel.toLowerCase()}`,
      label: dayLabel,
      dayIndex: null,
      dayName
    };
  }

  return {
    key: 'day-unassigned',
    label: 'Unassigned Day',
    dayIndex: null,
    dayName
  };
}

function compareRowsForWeekDaySort(a: BlockRow, b: BlockRow): number {
  const weekA = positiveIntOrNull(a.weekIndex) ?? Number.MAX_SAFE_INTEGER;
  const weekB = positiveIntOrNull(b.weekIndex) ?? Number.MAX_SAFE_INTEGER;
  if (weekA !== weekB) {
    return weekA - weekB;
  }

  const dayA = positiveIntOrNull(a.dayIndex) ?? Number.MAX_SAFE_INTEGER;
  const dayB = positiveIntOrNull(b.dayIndex) ?? Number.MAX_SAFE_INTEGER;
  if (dayA !== dayB) {
    return dayA - dayB;
  }

  const dayRowA = positiveIntOrNull(a.dayRowIndex) ?? Number.MAX_SAFE_INTEGER;
  const dayRowB = positiveIntOrNull(b.dayRowIndex) ?? Number.MAX_SAFE_INTEGER;
  if (dayRowA !== dayRowB) {
    return dayRowA - dayRowB;
  }

  const rowA = positiveIntOrNull(a.rowIndex) ?? Number.MAX_SAFE_INTEGER;
  const rowB = positiveIntOrNull(b.rowIndex) ?? Number.MAX_SAFE_INTEGER;
  if (rowA !== rowB) {
    return rowA - rowB;
  }

  return String(a.exercise || '').localeCompare(String(b.exercise || ''), undefined, {
    sensitivity: 'base'
  });
}

function olsSlope(values: Array<{ x: number; y: number }>): number | null {
  if (values.length < 2) {
    return null;
  }

  const count = values.length;
  const sumX = values.reduce((sum, point) => sum + point.x, 0);
  const sumY = values.reduce((sum, point) => sum + point.y, 0);
  const meanX = sumX / count;
  const meanY = sumY / count;

  let numerator = 0;
  let denominator = 0;

  for (const point of values) {
    const xDiff = point.x - meanX;
    numerator += xDiff * (point.y - meanY);
    denominator += xDiff * xDiff;
  }

  if (!denominator) {
    return null;
  }

  return numerator / denominator;
}

function getCurrentLiftFromTimeline(timeline: OverallTimelinePoint[], lift: PrimaryLift): number {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const load = numericOrNull(timeline[index]?.[lift]?.loadKg);
    if (load !== null && load > 0) {
      return load;
    }
  }

  return 0;
}

function getLiftRateForBlock(
  block: OverallPrimaryProgress['blocks'][number],
  lift: PrimaryLift
): number | null {
  let startLoad: number | null = null;
  let endLoad: number | null = null;
  let startWeek: number | null = null;
  let endWeek: number | null = null;

  for (const week of block.weeks) {
    const weekIndex = positiveIntOrNull(week.weekIndex);
    const load = numericOrNull(week[lift]?.loadKg);

    if (weekIndex === null || load === null || load <= 0) {
      continue;
    }

    if (startLoad === null) {
      startLoad = load;
      startWeek = weekIndex;
    }

    endLoad = load;
    endWeek = weekIndex;
  }

  if (startLoad === null || endLoad === null || startWeek === null || endWeek === null) {
    return null;
  }

  const weekSpan = Math.max(1, endWeek - startWeek);
  return (endLoad - startLoad) / weekSpan;
}

function startOfLocalDay(input: Date): Date {
  return new Date(input.getFullYear(), input.getMonth(), input.getDate());
}

function parseDateInput(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return Number.isFinite(date.getTime()) ? date : null;
}

function clampNonNegative(value: number): number {
  return Math.max(0, value);
}

function normalizeProjectionSettings(settings: ProjectionModelSettingsVM): ProjectionModelSettingsVM {
  const sex: ProjectionSex = settings.sex === 'female' ? 'female' : 'male';
  const bodyweightKg = Number.isFinite(settings.bodyweightKg) && settings.bodyweightKg > 0 ? settings.bodyweightKg : 80;
  const completedMeets =
    Number.isFinite(settings.completedMeets) && settings.completedMeets >= 0 ? Math.floor(settings.completedMeets) : 0;

  const defaultClasses = getDefaultSelectedWeightClasses(sex);
  const normalizedSelected = normalizeSelectedWeightClasses(sex, settings.selectedWeightClasses || []);
  const selectedWeightClasses = normalizedSelected.length ? normalizedSelected : defaultClasses;

  const manualRateOverrides: Record<PrimaryLift, number | null> = {
    squat: numericOrNull(settings.manualRateOverrides?.squat),
    bench: numericOrNull(settings.manualRateOverrides?.bench),
    deadlift: numericOrNull(settings.manualRateOverrides?.deadlift),
  };

  return {
    sex,
    bodyweightKg,
    completedMeets,
    selectedWeightClasses,
    manualRateOverrides,
  };
}

function projectLiftWithLogDecay(currentLift: number, startRate: number, targetRate: number, weeksRemaining: number): number {
  if (weeksRemaining <= 0) {
    return currentLift;
  }

  const safeStart = clampNonNegative(startRate);
  const safeTarget = clampNonNegative(Math.min(safeStart, targetRate));
  const denominator = Math.log(1 + weeksRemaining);
  let projected = currentLift;

  for (let week = 1; week <= weeksRemaining; week += 1) {
    const decay = denominator > 0 ? Math.log(1 + week) / denominator : 1;
    const weekRate = safeStart - (safeStart - safeTarget) * decay;
    projected += weekRate;
  }

  return clampNonNegative(projected);
}

function getCurrentLiftFromRows(rows: BlockRow[], currentPosition: CurrentPositionVM, lift: PrimaryLift): number | null {
  const weekIndex = currentPosition.weekIndex;
  const dayIndex = currentPosition.dayIndex;

  if (weekIndex === null) {
    return null;
  }

  let best: number | null = null;

  for (const row of rows) {
    const rowLift = canonicalLiftKey(row.exercise);
    if (rowLift !== lift) {
      continue;
    }

    if (positiveIntOrNull(row.weekIndex) !== weekIndex) {
      continue;
    }

    if (dayIndex !== null && positiveIntOrNull(row.dayIndex) !== dayIndex) {
      continue;
    }

    const load = numericOrNull(row.actualLoadKg);
    if (load === null || load <= 0) {
      continue;
    }

    best = best === null ? load : Math.max(best, load);
  }

  return best;
}

export function buildOverallTimelineSeries(timeline: OverallTimelinePoint[]): OverallTimelineSeries {
  const data = (timeline || []).map((point, index) => ({
    index,
    label: point.label,
    blockName: point.blockName,
    blockNum: point.blockNum,
    squat: point.squat?.loadKg ?? null,
    bench: point.bench?.loadKg ?? null,
    deadlift: point.deadlift?.loadKg ?? null
  }));

  const boundaries: BlockBoundaryMarker[] = [];

  for (let index = 1; index < data.length; index += 1) {
    const current = data[index];
    const previous = data[index - 1];

    if (current.blockName === previous.blockName) {
      continue;
    }

    boundaries.push({
      position: index - 0.5,
      label: current.blockNum ? `B${current.blockNum}` : current.blockName,
      blockName: current.blockName
    });
  }

  const hasAnyValue = data.some((point) => point.squat !== null || point.bench !== null || point.deadlift !== null);

  return {
    data,
    boundaries,
    hasAnyValue
  };
}

export function buildBlockPrimaryWeekSeries(primaryByWeek: PrimaryByWeek | null | undefined): BlockPrimaryWeekSeries {
  if (!primaryByWeek) {
    return {
      data: [],
      hasAnyValue: false
    };
  }

  const labels = primaryByWeek.labels || [];

  const data = (primaryByWeek.weeks || []).map((week, index) => {
    const weekIndex = positiveIntOrNull(week.weekIndex) || index + 1;

    return {
      index,
      weekIndex,
      label: labels[index] || `W${weekIndex}`,
      squat: week.squat?.loadKg ?? null,
      bench: week.bench?.loadKg ?? null,
      deadlift: week.deadlift?.loadKg ?? null
    };
  });

  const hasAnyValue = data.some((point) => point.squat !== null || point.bench !== null || point.deadlift !== null);

  return {
    data,
    hasAnyValue
  };
}

export function buildWeekDaySections(rows: BlockRow[]): WeekDaySection[] {
  const sorted = [...(rows || [])].sort(compareRowsForWeekDaySort);
  const weekSections: WeekDaySection[] = [];

  for (const row of sorted) {
    const week = weekDescriptor(row);
    const day = dayDescriptor(row);
    const latestWeek = weekSections[weekSections.length - 1];

    if (!latestWeek || latestWeek.weekKey !== week.key) {
      weekSections.push({
        key: `${week.key}-${weekSections.length}`,
        weekKey: week.key,
        weekIndex: week.weekIndex,
        label: week.label,
        rows: [row],
        days: [
          {
            key: `${week.key}-${day.key}-0`,
            dayKey: day.key,
            dayIndex: day.dayIndex,
            label: day.label,
            dayName: day.dayName,
            rows: [row],
            completionPct: isValidLoad(row.actualLoadKg) ? 1 : 0
          }
        ]
      });
      continue;
    }

    latestWeek.rows.push(row);

    const latestDay = latestWeek.days[latestWeek.days.length - 1];
    if (!latestDay || latestDay.dayKey !== day.key) {
      latestWeek.days.push({
        key: `${week.key}-${day.key}-${latestWeek.days.length}`,
        dayKey: day.key,
        dayIndex: day.dayIndex,
        label: day.label,
        dayName: day.dayName,
        rows: [row],
        completionPct: isValidLoad(row.actualLoadKg) ? 1 : 0
      });
      continue;
    }

    latestDay.rows.push(row);
  }

  for (const week of weekSections) {
    for (const day of week.days) {
      const total = day.rows.length;
      if (!total) {
        day.completionPct = 0;
        continue;
      }

      const completed = day.rows.reduce((count, row) => count + (isValidLoad(row.actualLoadKg) ? 1 : 0), 0);
      day.completionPct = completed / total;
    }
  }

  return weekSections;
}

export function inferCurrentPosition(rows: BlockRow[], threshold = 0.8): CurrentPositionVM {
  const weekSections = buildWeekDaySections(rows);
  let fallbackWeek: number | null = null;
  let fallbackDay: number | null = null;

  for (const week of weekSections) {
    for (const day of week.days) {
      if (fallbackWeek === null && week.weekIndex !== null) {
        fallbackWeek = week.weekIndex;
      }

      if (fallbackDay === null && day.dayIndex !== null) {
        fallbackDay = day.dayIndex;
      }
    }
  }

  let best: CurrentPositionVM | null = null;

  for (const week of weekSections) {
    for (const day of week.days) {
      if (week.weekIndex === null || day.dayIndex === null) {
        continue;
      }

      if (day.completionPct < threshold) {
        continue;
      }

      best = {
        weekIndex: week.weekIndex,
        dayIndex: day.dayIndex,
        source: 'inferred',
        completionPct: roundOneDecimal(day.completionPct * 100)
      };
    }
  }

  if (best) {
    return best;
  }

  return {
    weekIndex: fallbackWeek,
    dayIndex: fallbackDay,
    source: 'inferred',
    completionPct: null
  };
}

export function buildBlockComparisons(blocks: OverallPrimaryProgress['blocks']): BlockComparisonVM[] {
  return (blocks || []).map((block) => {
    const startTotal = sumOrNull([block.summary.squat.start, block.summary.bench.start, block.summary.deadlift.start]);
    const endTotal = sumOrNull([block.summary.squat.end, block.summary.bench.end, block.summary.deadlift.end]);

    return {
      blockName: block.blockName,
      blockLabel: blockLabel(block.blockName, block.blockNum),
      weekCount: block.weeks.length,
      startTotal,
      endTotal,
      totalDelta: roundOneDecimal(block.summary.squat.delta + block.summary.bench.delta + block.summary.deadlift.delta),
      squatDelta: roundOneDecimal(block.summary.squat.delta),
      benchDelta: roundOneDecimal(block.summary.bench.delta),
      deadliftDelta: roundOneDecimal(block.summary.deadlift.delta)
    };
  });
}

export function buildGrowthRates(
  timeline: OverallTimelinePoint[],
  blocks: OverallPrimaryProgress['blocks']
): GrowthRatesByLift {
  const output = {} as GrowthRatesByLift;

  for (const lift of LIFTS) {
    const values: Array<{ x: number; y: number }> = [];

    for (let index = 0; index < (timeline || []).length; index += 1) {
      const load = numericOrNull(timeline[index]?.[lift]?.loadKg);
      if (load === null || load <= 0) {
        continue;
      }

      values.push({ x: index, y: load });
    }

    const overallRateRaw = olsSlope(values);
    const blockRates = (blocks || [])
      .map((block) => getLiftRateForBlock(block, lift))
      .filter((value): value is number => value !== null);

    const recentSlice = blockRates.slice(-2);
    const recentRateRaw = recentSlice.length
      ? recentSlice.reduce((sum, value) => sum + value, 0) / recentSlice.length
      : null;

    const blendedRateRaw =
      recentRateRaw !== null && overallRateRaw !== null
        ? recentRateRaw * 0.6 + overallRateRaw * 0.4
        : recentRateRaw ?? overallRateRaw ?? 0;

    output[lift] = {
      lift,
      label: lift[0].toUpperCase() + lift.slice(1),
      current: roundOneDecimal(getCurrentLiftFromTimeline(timeline || [], lift)),
      overallRate: roundOneDecimal(overallRateRaw ?? 0),
      recentRate: roundOneDecimal(recentRateRaw ?? 0),
      blendedRate: roundOneDecimal(blendedRateRaw)
    };
  }

  return output;
}

export function buildMeetProjection(input: {
  rows: BlockRow[];
  timeline: OverallTimelinePoint[];
  meetDate: string;
  currentPosition: CurrentPositionVM;
  growthRates: GrowthRatesByLift;
  modelSettings: ProjectionModelSettingsVM;
}): MeetProjectionVM {
  const { rows, timeline, meetDate, currentPosition, growthRates } = input;
  const modelSettings = normalizeProjectionSettings(input.modelSettings);
  const meetDateObj = parseDateInput(meetDate);
  const todayStart = startOfLocalDay(new Date());
  const meetStart = meetDateObj ? startOfLocalDay(meetDateObj) : todayStart;

  const weeksRemaining = clampNonNegative(Math.ceil((meetStart.getTime() - todayStart.getTime()) / MS_PER_WEEK));

  const currentSquat =
    getCurrentLiftFromRows(rows, currentPosition, 'squat') ?? growthRates.squat.current ?? getCurrentLiftFromTimeline(timeline, 'squat');
  const currentBench =
    getCurrentLiftFromRows(rows, currentPosition, 'bench') ?? growthRates.bench.current ?? getCurrentLiftFromTimeline(timeline, 'bench');
  const currentDeadlift =
    getCurrentLiftFromRows(rows, currentPosition, 'deadlift') ??
    growthRates.deadlift.current ??
    getCurrentLiftFromTimeline(timeline, 'deadlift');

  const targets = resolveOpenIpfProjectionTargets({
    sex: modelSettings.sex,
    bodyweightKg: modelSettings.bodyweightKg,
    completedMeets: modelSettings.completedMeets,
    selectedWeightClasses: modelSettings.selectedWeightClasses,
  });

  const squatStartRate = clampNonNegative(
    numericOrNull(modelSettings.manualRateOverrides.squat) ?? growthRates.squat.blendedRate
  );
  const benchStartRate = clampNonNegative(
    numericOrNull(modelSettings.manualRateOverrides.bench) ?? growthRates.bench.blendedRate
  );
  const deadliftStartRate = clampNonNegative(
    numericOrNull(modelSettings.manualRateOverrides.deadlift) ?? growthRates.deadlift.blendedRate
  );

  const projectedSquat = projectLiftWithLogDecay(
    currentSquat,
    squatStartRate,
    targets.liftTargets.squat.rate,
    weeksRemaining
  );
  const projectedBench = projectLiftWithLogDecay(
    currentBench,
    benchStartRate,
    targets.liftTargets.bench.rate,
    weeksRemaining
  );
  const projectedDeadlift = projectLiftWithLogDecay(
    currentDeadlift,
    deadliftStartRate,
    targets.liftTargets.deadlift.rate,
    weeksRemaining
  );

  const currentTotal = currentSquat + currentBench + currentDeadlift;
  const projectedTotal = projectedSquat + projectedBench + projectedDeadlift;

  return {
    meetDate,
    weeksRemaining,
    currentPosition,
    model: {
      sex: modelSettings.sex,
      bodyweightKg: roundOneDecimal(modelSettings.bodyweightKg),
      completedMeets: modelSettings.completedMeets,
      selectedWeightClasses: targets.selectedWeightClasses,
      transitionLabel: targets.transitionLabel,
      maxTransition: targets.maxTransition,
      sampleSize: targets.totalSampleSize,
    },
    rates: {
      squat: {
        lift: 'squat',
        autoRate: roundOneDecimal(growthRates.squat.blendedRate),
        usedStartRate: roundOneDecimal(squatStartRate),
        targetRate: roundOneDecimal(targets.liftTargets.squat.rate),
        sampleSize: targets.liftTargets.squat.sampleSize,
        transitionLabel: targets.transitionLabel,
        overrideApplied: numericOrNull(modelSettings.manualRateOverrides.squat) !== null,
        usedFallback: targets.liftTargets.squat.usedFallback,
      },
      bench: {
        lift: 'bench',
        autoRate: roundOneDecimal(growthRates.bench.blendedRate),
        usedStartRate: roundOneDecimal(benchStartRate),
        targetRate: roundOneDecimal(targets.liftTargets.bench.rate),
        sampleSize: targets.liftTargets.bench.sampleSize,
        transitionLabel: targets.transitionLabel,
        overrideApplied: numericOrNull(modelSettings.manualRateOverrides.bench) !== null,
        usedFallback: targets.liftTargets.bench.usedFallback,
      },
      deadlift: {
        lift: 'deadlift',
        autoRate: roundOneDecimal(growthRates.deadlift.blendedRate),
        usedStartRate: roundOneDecimal(deadliftStartRate),
        targetRate: roundOneDecimal(targets.liftTargets.deadlift.rate),
        sampleSize: targets.liftTargets.deadlift.sampleSize,
        transitionLabel: targets.transitionLabel,
        overrideApplied: numericOrNull(modelSettings.manualRateOverrides.deadlift) !== null,
        usedFallback: targets.liftTargets.deadlift.usedFallback,
      },
    },
    current: {
      squat: roundOneDecimal(currentSquat),
      bench: roundOneDecimal(currentBench),
      deadlift: roundOneDecimal(currentDeadlift),
      total: roundOneDecimal(currentTotal)
    },
    projected: {
      squat: roundOneDecimal(projectedSquat),
      bench: roundOneDecimal(projectedBench),
      deadlift: roundOneDecimal(projectedDeadlift),
      total: roundOneDecimal(projectedTotal)
    }
  };
}

export function buildDashboardAnalytics(
  rows: BlockRow[],
  overallProgress: OverallPrimaryProgress | null | undefined
): DashboardAnalyticsVM {
  const safeRows = rows || [];
  const timeline = overallProgress?.timeline || [];
  const blocks = overallProgress?.blocks || [];

  return {
    weekSections: buildWeekDaySections(safeRows),
    inferredPosition: inferCurrentPosition(safeRows),
    blockComparisons: buildBlockComparisons(blocks),
    growthRates: buildGrowthRates(timeline, blocks)
  };
}
