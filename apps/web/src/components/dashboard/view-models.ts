import type { BlockRow, OverallTimelinePoint, PrimaryByWeek, Stats } from '@powerlifting/domain';

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

export interface GrowthDeltaDatum {
  id: 'squat' | 'bench' | 'deadlift' | 'total';
  label: string;
  delta: number;
  deltaPct: number;
  projected: number;
  baseline: number;
}

export interface WeekRowGroup {
  key: string;
  baseKey: string;
  label: string;
  weekIndex: number | null;
  rows: BlockRow[];
}

function positiveIntOrNull(value: unknown): number | null {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function describeWeek(row: BlockRow): { baseKey: string; label: string; weekIndex: number | null } {
  const weekIndex = positiveIntOrNull(row.weekIndex);
  const weekLabel = String(row.weekLabel || '').trim();

  if (weekIndex !== null) {
    return {
      baseKey: `week-${weekIndex}`,
      label: weekLabel || `Week ${weekIndex}`,
      weekIndex
    };
  }

  if (weekLabel) {
    return {
      baseKey: `label-${weekLabel.toLowerCase()}`,
      label: weekLabel,
      weekIndex: null
    };
  }

  return {
    baseKey: 'unassigned',
    label: 'Unassigned Week',
    weekIndex: null
  };
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

export function buildGrowthDeltaData(growth: Stats['growth'] | null | undefined): GrowthDeltaDatum[] {
  if (!growth) {
    return [];
  }

  const rows: Array<{ id: GrowthDeltaDatum['id']; label: GrowthDeltaDatum['label']; source: Stats['growth'][keyof Stats['growth']] }> = [
    { id: 'squat', label: 'Squat', source: growth.squat },
    { id: 'bench', label: 'Bench', source: growth.bench },
    { id: 'deadlift', label: 'Deadlift', source: growth.deadlift },
    { id: 'total', label: 'Total', source: growth.total }
  ];

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    delta: row.source.delta,
    deltaPct: row.source.deltaPct,
    projected: row.source.projected,
    baseline: row.source.baseline
  }));
}

export function groupRowsByWeek(rows: BlockRow[]): WeekRowGroup[] {
  const groups: WeekRowGroup[] = [];

  for (const row of rows || []) {
    const descriptor = describeWeek(row);
    const previous = groups[groups.length - 1];

    if (!previous || previous.baseKey !== descriptor.baseKey) {
      groups.push({
        key: `${descriptor.baseKey}-${groups.length}`,
        baseKey: descriptor.baseKey,
        label: descriptor.label,
        weekIndex: descriptor.weekIndex,
        rows: [row]
      });
      continue;
    }

    previous.rows.push(row);
  }

  return groups;
}
