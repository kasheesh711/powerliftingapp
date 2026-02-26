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
  primaryRows: number;
  completedPrimaryRows: number;
  primaryCompletionPct: number;
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
  canonicalKey: string;
  weekCount: number;
  startTotal: number | null;
  endTotal: number | null;
  totalDelta: number;
  squatDelta: number;
  benchDelta: number;
  deadliftDelta: number;
  confidenceScore: number;
  confidenceLabel: 'High' | 'Medium' | 'Low';
}

export interface GrowthRateVM {
  lift: PrimaryLift;
  label: string;
  current: number;
  overallRate: number;
  robustLongRate: number;
  recentRate: number;
  blockRate: number;
  baseRate: number;
  uncertaintyRate: number;
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
  robustLongRate: number;
  recentRate: number;
  blockRate: number;
  baseRate: number;
  safetyClamped: boolean;
  sampleSize: number;
  transitionLabel: string;
  overrideApplied: boolean;
  usedFallback: boolean;
}

export interface ProjectionScenarioTotalsVM {
  squat: number;
  bench: number;
  deadlift: number;
  total: number;
}

export interface ProjectionScenariosVM {
  low: ProjectionScenarioTotalsVM;
  base: ProjectionScenarioTotalsVM;
  high: ProjectionScenarioTotalsVM;
  confidenceBandKg: number;
  confidenceScore: number;
}

export interface AdherenceSummaryVM {
  overallCompletionPct: number;
  overallPrimaryCompletionPct: number;
  recentCompletionPct: number;
  recentPrimaryCompletionPct: number;
  dayVolatilityPct: number;
}

export interface CoachSignalVM {
  id: 'adherenceRisk' | 'liftImbalance' | 'meetReadiness';
  severity: 'low' | 'medium' | 'high';
  title: string;
  rationale: string;
  action: string;
}

export interface NextSessionFocusVM {
  headline: string;
  details: string;
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
  scenarios: ProjectionScenariosVM;
}

export interface DashboardAnalyticsVM {
  weekSections: WeekDaySection[];
  inferredPosition: CurrentPositionVM;
  blockComparisons: BlockComparisonVM[];
  growthRates: GrowthRatesByLift;
  adherenceSummary: AdherenceSummaryVM;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]): number | null {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
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

function theilSenSlope(values: Array<{ x: number; y: number }>): number | null {
  if (values.length < 2) {
    return null;
  }

  const slopes: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < values.length; nextIndex += 1) {
      const left = values[index];
      const right = values[nextIndex];
      const deltaX = right.x - left.x;

      if (!deltaX) {
        continue;
      }

      slopes.push((right.y - left.y) / deltaX);
    }
  }

  return median(slopes);
}

function recentStepRate(values: Array<{ x: number; y: number }>, windowSize = 3): number | null {
  if (values.length < 2) {
    return null;
  }

  const steps: number[] = [];
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    const deltaX = current.x - previous.x;

    if (!deltaX) {
      continue;
    }

    steps.push((current.y - previous.y) / deltaX);
  }

  if (!steps.length) {
    return null;
  }

  const tail = steps.slice(-Math.min(windowSize, steps.length));
  return tail.reduce((sum, value) => sum + value, 0) / tail.length;
}

function residualStdDev(values: Array<{ x: number; y: number }>, slope: number): number {
  if (values.length < 3) {
    return 0;
  }

  const intercept = median(values.map((point) => point.y - slope * point.x)) ?? 0;
  const residuals = values.map((point) => point.y - (intercept + slope * point.x));
  const mean = residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
  const variance = residuals.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / residuals.length;

  return Number.isFinite(variance) ? Math.sqrt(variance) : 0;
}

function blendedRate(input: {
  recentRate: number | null;
  robustLongRate: number | null;
  blockRate: number | null;
  fallbackRate: number | null;
}): number {
  const weighted: Array<{ value: number; weight: number }> = [];

  if (input.recentRate !== null) {
    weighted.push({ value: input.recentRate, weight: 0.5 });
  }

  if (input.robustLongRate !== null) {
    weighted.push({ value: input.robustLongRate, weight: 0.3 });
  }

  if (input.blockRate !== null) {
    weighted.push({ value: input.blockRate, weight: 0.2 });
  }

  if (!weighted.length) {
    return input.fallbackRate ?? 0;
  }

  const weightTotal = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const valueTotal = weighted.reduce((sum, entry) => sum + entry.value * entry.weight, 0);
  return weightTotal ? valueTotal / weightTotal : input.fallbackRate ?? 0;
}

function normalizeBlockName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function canonicalBlockKey(blockName: string, blockNum: string): string {
  if (blockNum) {
    return `b${blockNum}`;
  }

  const normalized = normalizeBlockName(blockName);
  return normalized || blockName.toLowerCase();
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

function clampProjectionRate(value: number): number {
  return clamp(value, -4, 8);
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

  const safeStart = clampProjectionRate(startRate);
  const safeTarget = clampProjectionRate(targetRate);
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
            completionPct: 0,
            primaryRows: 0,
            completedPrimaryRows: 0,
            primaryCompletionPct: 0
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
        completionPct: 0,
        primaryRows: 0,
        completedPrimaryRows: 0,
        primaryCompletionPct: 0
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

      const primaryRows = day.rows.filter((row) => canonicalLiftKey(row.exercise) !== null);
      day.primaryRows = primaryRows.length;
      day.completedPrimaryRows = primaryRows.reduce((count, row) => count + (isValidLoad(row.actualLoadKg) ? 1 : 0), 0);
      day.primaryCompletionPct = day.primaryRows > 0 ? day.completedPrimaryRows / day.primaryRows : day.completionPct;
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

      const effectiveCompletion = day.primaryRows > 0 ? day.primaryCompletionPct : day.completionPct;
      if (effectiveCompletion < threshold) {
        continue;
      }

      best = {
        weekIndex: week.weekIndex,
        dayIndex: day.dayIndex,
        source: 'inferred',
        completionPct: roundOneDecimal(effectiveCompletion * 100)
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

export function buildAdherenceSummary(weekSections: WeekDaySection[]): AdherenceSummaryVM {
  const days = weekSections.flatMap((week) => week.days);
  const completionValues = days.map((day) => day.completionPct * 100);

  const overallRows = days.reduce((sum, day) => sum + day.rows.length, 0);
  const overallCompleted = days.reduce(
    (sum, day) => sum + day.rows.reduce((count, row) => count + (isValidLoad(row.actualLoadKg) ? 1 : 0), 0),
    0
  );

  const totalPrimaryRows = days.reduce((sum, day) => sum + day.primaryRows, 0);
  const totalPrimaryCompleted = days.reduce((sum, day) => sum + day.completedPrimaryRows, 0);

  const recentDays = days.slice(-4);
  const recentRows = recentDays.reduce((sum, day) => sum + day.rows.length, 0);
  const recentCompleted = recentDays.reduce(
    (sum, day) => sum + day.rows.reduce((count, row) => count + (isValidLoad(row.actualLoadKg) ? 1 : 0), 0),
    0
  );
  const recentPrimaryRows = recentDays.reduce((sum, day) => sum + day.primaryRows, 0);
  const recentPrimaryCompleted = recentDays.reduce((sum, day) => sum + day.completedPrimaryRows, 0);

  const completionMean = completionValues.length
    ? completionValues.reduce((sum, value) => sum + value, 0) / completionValues.length
    : 0;
  const dayVolatility =
    completionValues.length > 1
      ? Math.sqrt(
          completionValues.reduce((sum, value) => sum + Math.pow(value - completionMean, 2), 0) / completionValues.length
        )
      : 0;

  return {
    overallCompletionPct: roundOneDecimal(overallRows ? (overallCompleted / overallRows) * 100 : 0),
    overallPrimaryCompletionPct: roundOneDecimal(totalPrimaryRows ? (totalPrimaryCompleted / totalPrimaryRows) * 100 : 0),
    recentCompletionPct: roundOneDecimal(recentRows ? (recentCompleted / recentRows) * 100 : 0),
    recentPrimaryCompletionPct: roundOneDecimal(recentPrimaryRows ? (recentPrimaryCompleted / recentPrimaryRows) * 100 : 0),
    dayVolatilityPct: roundOneDecimal(dayVolatility)
  };
}

export function buildBlockComparisons(blocks: OverallPrimaryProgress['blocks']): BlockComparisonVM[] {
  const deduped = new Map<string, { index: number; row: BlockComparisonVM }>();

  (blocks || []).forEach((block, index) => {
    const startTotal = sumOrNull([block.summary.squat.start, block.summary.bench.start, block.summary.deadlift.start]);
    const endTotal = sumOrNull([block.summary.squat.end, block.summary.bench.end, block.summary.deadlift.end]);
    const key = canonicalBlockKey(block.blockName, block.blockNum);

    const confidenceScore = clamp(
      roundOneDecimal(
        Math.min(70, (block.weeks.length / 5) * 70) +
          (startTotal !== null && endTotal !== null ? 30 : 15)
      ),
      20,
      100
    );

    const row: BlockComparisonVM = {
      blockName: block.blockName,
      blockLabel: blockLabel(block.blockName, block.blockNum),
      canonicalKey: key,
      weekCount: block.weeks.length,
      startTotal,
      endTotal,
      totalDelta: roundOneDecimal(block.summary.squat.delta + block.summary.bench.delta + block.summary.deadlift.delta),
      squatDelta: roundOneDecimal(block.summary.squat.delta),
      benchDelta: roundOneDecimal(block.summary.bench.delta),
      deadliftDelta: roundOneDecimal(block.summary.deadlift.delta),
      confidenceScore,
      confidenceLabel: confidenceScore >= 75 ? 'High' : confidenceScore >= 50 ? 'Medium' : 'Low'
    };

    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, { index, row });
      return;
    }

    if (row.weekCount > existing.row.weekCount || (row.weekCount === existing.row.weekCount && index > existing.index)) {
      deduped.set(key, { index, row });
    }
  });

  return [...deduped.values()]
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.row);
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
    const robustLongRateRaw = theilSenSlope(values);
    const recentRateRaw = recentStepRate(values, 3);

    const blockRates = (blocks || [])
      .map((block) => getLiftRateForBlock(block, lift))
      .filter((value): value is number => value !== null);

    const blockSlice = blockRates.slice(-2);
    const blockRateRaw = blockSlice.length
      ? blockSlice.reduce((sum, value) => sum + value, 0) / blockSlice.length
      : null;

    const baseRateRaw = blendedRate({
      recentRate: recentRateRaw,
      robustLongRate: robustLongRateRaw,
      blockRate: blockRateRaw,
      fallbackRate: overallRateRaw
    });
    const safeBaseRate = clampProjectionRate(baseRateRaw);
    const anchorRate = robustLongRateRaw ?? overallRateRaw ?? safeBaseRate;
    const uncertaintyRaw = residualStdDev(values, anchorRate);
    const uncertaintyRate = clamp(uncertaintyRaw, 0, 6);

    output[lift] = {
      lift,
      label: lift[0].toUpperCase() + lift.slice(1),
      current: roundOneDecimal(getCurrentLiftFromTimeline(timeline || [], lift)),
      overallRate: roundOneDecimal(overallRateRaw ?? 0),
      robustLongRate: roundOneDecimal(robustLongRateRaw ?? overallRateRaw ?? 0),
      recentRate: roundOneDecimal(recentRateRaw ?? 0),
      blockRate: roundOneDecimal(blockRateRaw ?? 0),
      baseRate: roundOneDecimal(safeBaseRate),
      uncertaintyRate: roundOneDecimal(uncertaintyRate),
      blendedRate: roundOneDecimal(safeBaseRate)
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

  const squatManualRate = numericOrNull(modelSettings.manualRateOverrides.squat);
  const benchManualRate = numericOrNull(modelSettings.manualRateOverrides.bench);
  const deadliftManualRate = numericOrNull(modelSettings.manualRateOverrides.deadlift);

  const squatStartRate = clampProjectionRate(squatManualRate ?? growthRates.squat.baseRate);
  const benchStartRate = clampProjectionRate(benchManualRate ?? growthRates.bench.baseRate);
  const deadliftStartRate = clampProjectionRate(deadliftManualRate ?? growthRates.deadlift.baseRate);

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

  const squatBand = Math.max(0.5, growthRates.squat.uncertaintyRate * Math.max(1, Math.sqrt(Math.max(1, weeksRemaining))));
  const benchBand = Math.max(0.5, growthRates.bench.uncertaintyRate * Math.max(1, Math.sqrt(Math.max(1, weeksRemaining))));
  const deadliftBand = Math.max(0.5, growthRates.deadlift.uncertaintyRate * Math.max(1, Math.sqrt(Math.max(1, weeksRemaining))));

  const scenarioLow = {
    squat: clampNonNegative(projectedSquat - squatBand),
    bench: clampNonNegative(projectedBench - benchBand),
    deadlift: clampNonNegative(projectedDeadlift - deadliftBand),
  };

  const scenarioHigh = {
    squat: clampNonNegative(projectedSquat + squatBand),
    bench: clampNonNegative(projectedBench + benchBand),
    deadlift: clampNonNegative(projectedDeadlift + deadliftBand),
  };

  const scenarioBase = {
    squat: projectedSquat,
    bench: projectedBench,
    deadlift: projectedDeadlift,
  };

  const currentTotal = currentSquat + currentBench + currentDeadlift;
  const projectedTotal = scenarioBase.squat + scenarioBase.bench + scenarioBase.deadlift;

  const lowTotal = scenarioLow.squat + scenarioLow.bench + scenarioLow.deadlift;
  const highTotal = scenarioHigh.squat + scenarioHigh.bench + scenarioHigh.deadlift;
  const confidenceBandKg = roundOneDecimal((highTotal - lowTotal) / 2);
  const confidenceScore = clamp(
    roundOneDecimal(
      100 -
        Math.min(45, confidenceBandKg / Math.max(1, currentTotal) * 180) +
        Math.min(20, targets.totalSampleSize / 140)
    ),
    35,
    96
  );

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
        autoRate: roundOneDecimal(growthRates.squat.baseRate),
        usedStartRate: roundOneDecimal(squatStartRate),
        targetRate: roundOneDecimal(targets.liftTargets.squat.rate),
        robustLongRate: roundOneDecimal(growthRates.squat.robustLongRate),
        recentRate: roundOneDecimal(growthRates.squat.recentRate),
        blockRate: roundOneDecimal(growthRates.squat.blockRate),
        baseRate: roundOneDecimal(growthRates.squat.baseRate),
        safetyClamped: roundOneDecimal(squatStartRate) !== roundOneDecimal(squatManualRate ?? growthRates.squat.baseRate),
        sampleSize: targets.liftTargets.squat.sampleSize,
        transitionLabel: targets.transitionLabel,
        overrideApplied: squatManualRate !== null,
        usedFallback: targets.liftTargets.squat.usedFallback,
      },
      bench: {
        lift: 'bench',
        autoRate: roundOneDecimal(growthRates.bench.baseRate),
        usedStartRate: roundOneDecimal(benchStartRate),
        targetRate: roundOneDecimal(targets.liftTargets.bench.rate),
        robustLongRate: roundOneDecimal(growthRates.bench.robustLongRate),
        recentRate: roundOneDecimal(growthRates.bench.recentRate),
        blockRate: roundOneDecimal(growthRates.bench.blockRate),
        baseRate: roundOneDecimal(growthRates.bench.baseRate),
        safetyClamped: roundOneDecimal(benchStartRate) !== roundOneDecimal(benchManualRate ?? growthRates.bench.baseRate),
        sampleSize: targets.liftTargets.bench.sampleSize,
        transitionLabel: targets.transitionLabel,
        overrideApplied: benchManualRate !== null,
        usedFallback: targets.liftTargets.bench.usedFallback,
      },
      deadlift: {
        lift: 'deadlift',
        autoRate: roundOneDecimal(growthRates.deadlift.baseRate),
        usedStartRate: roundOneDecimal(deadliftStartRate),
        targetRate: roundOneDecimal(targets.liftTargets.deadlift.rate),
        robustLongRate: roundOneDecimal(growthRates.deadlift.robustLongRate),
        recentRate: roundOneDecimal(growthRates.deadlift.recentRate),
        blockRate: roundOneDecimal(growthRates.deadlift.blockRate),
        baseRate: roundOneDecimal(growthRates.deadlift.baseRate),
        safetyClamped:
          roundOneDecimal(deadliftStartRate) !== roundOneDecimal(deadliftManualRate ?? growthRates.deadlift.baseRate),
        sampleSize: targets.liftTargets.deadlift.sampleSize,
        transitionLabel: targets.transitionLabel,
        overrideApplied: deadliftManualRate !== null,
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
      squat: roundOneDecimal(scenarioBase.squat),
      bench: roundOneDecimal(scenarioBase.bench),
      deadlift: roundOneDecimal(scenarioBase.deadlift),
      total: roundOneDecimal(projectedTotal)
    },
    scenarios: {
      low: {
        squat: roundOneDecimal(scenarioLow.squat),
        bench: roundOneDecimal(scenarioLow.bench),
        deadlift: roundOneDecimal(scenarioLow.deadlift),
        total: roundOneDecimal(lowTotal)
      },
      base: {
        squat: roundOneDecimal(scenarioBase.squat),
        bench: roundOneDecimal(scenarioBase.bench),
        deadlift: roundOneDecimal(scenarioBase.deadlift),
        total: roundOneDecimal(projectedTotal)
      },
      high: {
        squat: roundOneDecimal(scenarioHigh.squat),
        bench: roundOneDecimal(scenarioHigh.bench),
        deadlift: roundOneDecimal(scenarioHigh.deadlift),
        total: roundOneDecimal(highTotal)
      },
      confidenceBandKg,
      confidenceScore
    }
  };
}

export function buildCoachSignals(input: {
  adherenceSummary: AdherenceSummaryVM;
  growthRates: GrowthRatesByLift;
  meetProjection: MeetProjectionVM;
}): CoachSignalVM[] {
  const { adherenceSummary, growthRates, meetProjection } = input;

  const adherenceSeverity: CoachSignalVM['severity'] =
    adherenceSummary.recentPrimaryCompletionPct < 55 || adherenceSummary.dayVolatilityPct > 30
      ? 'high'
      : adherenceSummary.recentPrimaryCompletionPct < 75 || adherenceSummary.dayVolatilityPct > 20
        ? 'medium'
        : 'low';

  const liftRates = LIFTS.map((lift) => growthRates[lift].baseRate);
  const liftSpread = Math.max(...liftRates) - Math.min(...liftRates);
  const imbalanceSeverity: CoachSignalVM['severity'] =
    liftSpread > 3 || liftRates.some((value) => value < -1)
      ? 'high'
      : liftSpread > 1.5 || liftRates.some((value) => value < 0)
        ? 'medium'
        : 'low';

  const readinessSeverity: CoachSignalVM['severity'] =
    (meetProjection.weeksRemaining <= 8 && meetProjection.scenarios.base.total < meetProjection.current.total + 10) ||
    meetProjection.scenarios.confidenceScore < 55
      ? 'high'
      : (meetProjection.weeksRemaining <= 14 && meetProjection.scenarios.base.total < meetProjection.current.total + 20) ||
          meetProjection.scenarios.confidenceScore < 70
        ? 'medium'
        : 'low';

  return [
    {
      id: 'adherenceRisk',
      severity: adherenceSeverity,
      title: 'Adherence Risk',
      rationale: `Recent primary completion is ${adherenceSummary.recentPrimaryCompletionPct.toFixed(1)}% with ${adherenceSummary.dayVolatilityPct.toFixed(1)}% day-to-day volatility.`,
      action:
        adherenceSeverity === 'high'
          ? 'Use one fixed session start window this week and complete primary movements before accessories.'
          : 'Keep the current cadence and preserve primary-lift completion consistency.'
    },
    {
      id: 'liftImbalance',
      severity: imbalanceSeverity,
      title: 'Lift Imbalance',
      rationale: `Base weekly rate spread is ${liftSpread.toFixed(1)} kg/week across squat, bench, and deadlift.`,
      action:
        imbalanceSeverity === 'high'
          ? 'Reduce jump size on the fastest lift and add one focused top set on the lagging lift.'
          : 'Track rate spread weekly and keep load jumps symmetric unless recovery flags rise.'
    },
    {
      id: 'meetReadiness',
      severity: readinessSeverity,
      title: 'Meet Readiness',
      rationale: `${meetProjection.weeksRemaining} weeks remain with confidence ${meetProjection.scenarios.confidenceScore.toFixed(1)}%.`,
      action:
        readinessSeverity === 'high'
          ? 'Start attempt-plan constraints now and prioritize execution quality over aggressive load jumps.'
          : 'Maintain progressive overload and re-check readiness after the next completed week.'
    }
  ];
}

export function buildNextSessionFocus(input: {
  selectedDaySection: DayRowSection | null;
  growthRates: GrowthRatesByLift;
}): NextSessionFocusVM {
  const { selectedDaySection, growthRates } = input;
  if (!selectedDaySection) {
    return {
      headline: 'Next Session Focus',
      details: 'Select a day tab to generate a focused execution cue for the next session.'
    };
  }

  const weakestLift = [...LIFTS]
    .sort((left, right) => growthRates[left].baseRate - growthRates[right].baseRate)[0];
  const weakestLiftLabel = weakestLift[0].toUpperCase() + weakestLift.slice(1);
  const primaryPct = Math.round(selectedDaySection.primaryCompletionPct * 100);
  const totalPct = Math.round(selectedDaySection.completionPct * 100);

  if (selectedDaySection.primaryRows > 0 && selectedDaySection.primaryCompletionPct < 0.75) {
    return {
      headline: `Prioritize ${selectedDaySection.label} primary work`,
      details: `Primary completion is ${primaryPct}%. Open with ${weakestLiftLabel} and finish all programmed primary sets before accessories.`
    };
  }

  if (selectedDaySection.completionPct < 0.8) {
    return {
      headline: `Close accessory gaps on ${selectedDaySection.label}`,
      details: `Overall completion is ${totalPct}%. Keep main lift quality, then complete at least one missed accessory slot to improve consistency.`
    };
  }

  return {
    headline: `Build momentum on ${selectedDaySection.label}`,
    details: `Completion is ${totalPct}%. Keep the same pacing and use RPE discipline to protect recovery while progressing ${weakestLiftLabel}.`
  };
}

export function buildDashboardAnalytics(
  rows: BlockRow[],
  overallProgress: OverallPrimaryProgress | null | undefined
): DashboardAnalyticsVM {
  const safeRows = rows || [];
  const timeline = overallProgress?.timeline || [];
  const blocks = overallProgress?.blocks || [];
  const weekSections = buildWeekDaySections(safeRows);

  return {
    weekSections,
    inferredPosition: inferCurrentPosition(safeRows),
    blockComparisons: buildBlockComparisons(blocks),
    growthRates: buildGrowthRates(timeline, blocks),
    adherenceSummary: buildAdherenceSummary(weekSections)
  };
}
