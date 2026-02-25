import type {
  AppConfig,
  Basics,
  BlockData,
  BlockDescriptor,
  BlockRow,
  OverallPrimaryProgress,
  PrimaryByWeek,
  PrimaryLiftPoint,
  PrimarySummary,
  Stats
} from './types';

function parseNumericOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isNaN(n) ? null : n;
}

export function computeE1RM_Epley(weight: number, reps: number): number | null {
  if (!weight || !reps || reps <= 0) {
    return null;
  }

  const res = weight * (1 + reps / 30);
  return Math.round(res * 100) / 100;
}

export function computeDots(totalKg: number, bwKg: number, sex: 'male' | 'female', coeffs: AppConfig['coefficients']): number {
  if (!totalKg || !bwKg) {
    return 0;
  }

  const c = coeffs[`DOTS_${sex}`];
  if (!c) {
    return 0;
  }

  const denominator =
    c.a + c.b * bwKg + c.c * Math.pow(bwKg, 2) + c.d * Math.pow(bwKg, 3) + c.e * Math.pow(bwKg, 4);

  return (totalKg * 500) / denominator;
}

export function computeWilks(totalKg: number, bwKg: number, sex: 'male' | 'female', coeffs: AppConfig['coefficients']): number {
  if (!totalKg || !bwKg) {
    return 0;
  }

  const c = coeffs[`WILKS_${sex}`];
  if (!c) {
    return 0;
  }

  const denominator =
    c.a +
    c.b * bwKg +
    c.c * Math.pow(bwKg, 2) +
    c.d * Math.pow(bwKg, 3) +
    c.e * Math.pow(bwKg, 4) +
    (c.f ? c.f * Math.pow(bwKg, 5) : 0);

  return (totalKg * 500) / denominator;
}

export function computeGLPoints(totalKg: number, bwKg: number, sex: 'male' | 'female', coeffs: AppConfig['coefficients']): number {
  if (!totalKg || !bwKg) {
    return 0;
  }

  const c = coeffs[`GLPOINTS_${sex}`];
  if (!c) {
    return 0;
  }

  return (totalKg * 100) / (c.a - c.b * Math.exp(-c.c * bwKg));
}

export function canonicalLiftKey(exerciseText: unknown): 'squat' | 'bench' | 'deadlift' | null {
  const lift = String(exerciseText || '').toLowerCase();
  if (!lift) {
    return null;
  }

  if (lift.includes('bench')) {
    return 'bench';
  }

  if (lift.includes('squat')) {
    return 'squat';
  }

  if (lift.includes('deadlift') || /\bdl\b/.test(lift)) {
    return 'deadlift';
  }

  return null;
}

function hasWeekDayMetadata(rows: BlockRow[]): boolean {
  if (!rows.length) {
    return false;
  }

  const hasWeek = rows.some((row) => Number.parseInt(String(row.weekIndex), 10) > 0);
  const hasDay = rows.some((row) => Number.parseInt(String(row.dayIndex), 10) > 0);
  return hasWeek && hasDay;
}

function selectBetterPrimaryCandidate(
  current: PrimaryLiftPoint | null,
  candidate: PrimaryLiftPoint
): PrimaryLiftPoint {
  if (!current) {
    return candidate;
  }

  if (candidate.loadKg > current.loadKg) {
    return candidate;
  }

  if (candidate.loadKg < current.loadKg) {
    return current;
  }

  const candE1 = candidate.e1rm || 0;
  const currE1 = current.e1rm || 0;

  if (candE1 > currE1) {
    return candidate;
  }

  if (candE1 < currE1) {
    return current;
  }

  const candDay = candidate.dayIndex || 999;
  const currDay = current.dayIndex || 999;

  if (candDay < currDay) {
    return candidate;
  }

  return current;
}

function summarizePrimaryLiftAcrossWeeks(
  weeks: PrimaryByWeek['weeks'],
  liftKey: 'squat' | 'bench' | 'deadlift'
): PrimarySummary {
  let start: number | null = null;
  let end: number | null = null;

  for (const week of weeks) {
    const point = week[liftKey];
    const load = parseNumericOrNull(point ? point.loadKg : null);
    if (load === null) {
      continue;
    }

    if (start === null) {
      start = load;
    }

    end = load;
  }

  if (start === null || end === null) {
    return {
      start: null,
      end: null,
      delta: 0,
      deltaPct: 0
    };
  }

  const delta = end - start;
  return {
    start,
    end,
    delta,
    deltaPct: start ? (delta / start) * 100 : 0
  };
}

function summarizeTimelineLift(
  timeline: OverallPrimaryProgress['timeline'],
  liftKey: 'squat' | 'bench' | 'deadlift'
): PrimarySummary {
  let start: number | null = null;
  let end: number | null = null;

  for (const entry of timeline) {
    const point = entry[liftKey];
    const load = parseNumericOrNull(point ? point.loadKg : null);
    if (load === null) {
      continue;
    }

    if (start === null) {
      start = load;
    }

    end = load;
  }

  if (start === null || end === null) {
    return {
      start: null,
      end: null,
      delta: 0,
      deltaPct: 0
    };
  }

  const delta = end - start;
  return {
    start,
    end,
    delta,
    deltaPct: start ? (delta / start) * 100 : 0
  };
}

export function computePrimaryLiftProgressForRows(rows: BlockRow[]): PrimaryByWeek {
  const safeRows = rows || [];
  const dayLiftBest: Record<string, PrimaryLiftPoint> = {};

  for (const row of safeRows) {
    const lift = canonicalLiftKey(row.exercise);
    const weekIndex = Number.parseInt(String(row.weekIndex), 10);
    const dayIndex = Number.parseInt(String(row.dayIndex), 10);
    const loadKg = parseNumericOrNull(row.actualLoadKg);
    const e1rm = parseNumericOrNull(row.e1rm);

    if (!lift || !weekIndex || weekIndex <= 0) {
      continue;
    }

    if (loadKg === null || loadKg <= 0) {
      continue;
    }

    const normalizedDayIndex = Number.isNaN(dayIndex) || dayIndex <= 0 ? null : dayIndex;
    const dayLabel = row.dayLabel || (normalizedDayIndex ? `Day ${normalizedDayIndex}` : 'Day ?');
    const dayKey = normalizedDayIndex !== null ? String(normalizedDayIndex) : dayLabel;
    const key = `${weekIndex}|${lift}|${dayKey}`;

    const candidate: PrimaryLiftPoint = {
      loadKg,
      e1rm,
      dayIndex: normalizedDayIndex,
      dayLabel,
      rowIndex: Number.parseInt(String(row.rowIndex), 10) || null,
      exercise: String(row.exercise || '')
    };

    dayLiftBest[key] = selectBetterPrimaryCandidate(dayLiftBest[key] || null, candidate);
  }

  const weekLiftBest: Record<string, PrimaryLiftPoint> = {};

  for (const key of Object.keys(dayLiftBest)) {
    const [weekIndexRaw, lift] = key.split('|');
    const weekIndex = Number.parseInt(weekIndexRaw, 10);
    const weekLiftKey = `${weekIndex}|${lift}`;

    weekLiftBest[weekLiftKey] = selectBetterPrimaryCandidate(
      weekLiftBest[weekLiftKey] || null,
      dayLiftBest[key]
    );
  }

  const orderedWeeks = [...new Set(Object.keys(weekLiftBest).map((key) => Number.parseInt(key.split('|')[0], 10)))]
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);

  const weeks = orderedWeeks.map((weekIndex) => ({
    weekIndex,
    squat: weekLiftBest[`${weekIndex}|squat`] || null,
    bench: weekLiftBest[`${weekIndex}|bench`] || null,
    deadlift: weekLiftBest[`${weekIndex}|deadlift`] || null
  }));

  return {
    weeks,
    labels: weeks.map((week) => `W${week.weekIndex}`),
    series: {
      squat: weeks.map((week) => (week.squat ? week.squat.loadKg : null)),
      bench: weeks.map((week) => (week.bench ? week.bench.loadKg : null)),
      deadlift: weeks.map((week) => (week.deadlift ? week.deadlift.loadKg : null))
    },
    summary: {
      squat: summarizePrimaryLiftAcrossWeeks(weeks, 'squat'),
      bench: summarizePrimaryLiftAcrossWeeks(weeks, 'bench'),
      deadlift: summarizePrimaryLiftAcrossWeeks(weeks, 'deadlift')
    }
  };
}

function blockSortForProgress(a: BlockDescriptor, b: BlockDescriptor): number {
  const aNum = Number.parseInt(String(a.blockNum || ''), 10);
  const bNum = Number.parseInt(String(b.blockNum || ''), 10);
  const aHasNum = !Number.isNaN(aNum);
  const bHasNum = !Number.isNaN(bNum);

  if (aHasNum && bHasNum && aNum !== bNum) {
    return aNum - bNum;
  }

  if (aHasNum && !bHasNum) {
    return -1;
  }

  if (!aHasNum && bHasNum) {
    return 1;
  }

  const aName = String(a.name || '').toLowerCase();
  const bName = String(b.name || '').toLowerCase();

  const phaseRank = (name: string): number => {
    if (name.includes('intro')) {
      return 0;
    }

    if (name.includes('continuation')) {
      return 1;
    }

    return 2;
  };

  const phaseDiff = phaseRank(aName) - phaseRank(bName);
  if (phaseDiff !== 0) {
    return phaseDiff;
  }

  return aName.localeCompare(bName);
}

function shortBlockLabelForProgress(block: BlockDescriptor): string {
  const blockNum = block.blockNum ? `B${block.blockNum}` : 'Block';
  const name = String(block.name || '').toLowerCase();

  if (name.includes('intro')) {
    return `${blockNum}i`;
  }

  if (name.includes('continuation')) {
    return `${blockNum}c`;
  }

  return blockNum;
}

export function computeOverallPrimaryProgress(
  blocks: BlockDescriptor[],
  getBlockData: (blockName: string, forceRefresh?: boolean) => Promise<BlockData>,
  forceRefresh = false
): Promise<OverallPrimaryProgress> {
  return (async () => {
    const filtered = blocks.filter((block) => block && block.isBlock).sort(blockSortForProgress);

    const timeline: OverallPrimaryProgress['timeline'] = [];
    const blocksProgress: OverallPrimaryProgress['blocks'] = [];

    for (const block of filtered) {
      let blockData = await getBlockData(block.name, forceRefresh);

      if (!forceRefresh && !hasWeekDayMetadata(blockData.rows || [])) {
        blockData = await getBlockData(block.name, true);
      }

      const primary = computePrimaryLiftProgressForRows(blockData.rows || []);
      blocksProgress.push({
        blockName: block.name,
        blockNum: block.blockNum || '',
        weeks: primary.weeks,
        summary: primary.summary
      });

      for (const week of primary.weeks) {
        const shortLabel = shortBlockLabelForProgress(block);
        timeline.push({
          label: `${shortLabel} W${week.weekIndex}`,
          blockName: block.name,
          blockNum: block.blockNum || '',
          weekIndex: week.weekIndex,
          squat: week.squat,
          bench: week.bench,
          deadlift: week.deadlift
        });
      }
    }

    return {
      timeline,
      blocks: blocksProgress,
      summary: {
        squat: summarizeTimelineLift(timeline, 'squat'),
        bench: summarizeTimelineLift(timeline, 'bench'),
        deadlift: summarizeTimelineLift(timeline, 'deadlift')
      }
    };
  })();
}

export function computeAllStats(blockData: BlockData, basics: Basics, config: AppConfig): Stats {
  const coeffs = config.coefficients;
  const bw = basics.bodyweight || 80;
  const sex = basics.sex || 'male';

  const lifts: Array<'squat' | 'bench' | 'deadlift'> = ['squat', 'bench', 'deadlift'];
  const currentMaxes: Record<'squat' | 'bench' | 'deadlift', number> = {
    squat: 0,
    bench: 0,
    deadlift: 0
  };
  const projectedMaxes: Record<'squat' | 'bench' | 'deadlift', number> = {
    squat: 0,
    bench: 0,
    deadlift: 0
  };

  if (blockData.peakE1RMs) {
    for (const lift of lifts) {
      const value = blockData.peakE1RMs[lift];
      if (value) {
        projectedMaxes[lift] = value;
      }
    }
  }

  for (const row of blockData.rows) {
    const canonical = canonicalLiftKey(row.exercise);
    if (!canonical) {
      continue;
    }

    const actualLoad = parseNumericOrNull(row.actualLoadKg);
    if (actualLoad !== null && actualLoad > currentMaxes[canonical]) {
      currentMaxes[canonical] = actualLoad;
    }

    const e1rm = parseNumericOrNull(row.e1rm);
    if (e1rm !== null && !blockData.peakE1RMs?.[canonical] && e1rm > projectedMaxes[canonical]) {
      projectedMaxes[canonical] = e1rm;
    }
  }

  const currentTotal = Math.round(currentMaxes.squat + currentMaxes.bench + currentMaxes.deadlift);
  const projectedTotal = Math.round(projectedMaxes.squat + projectedMaxes.bench + projectedMaxes.deadlift);

  const stats: Stats = {
    current: {
      total: currentTotal,
      dots: computeDots(currentTotal, bw, sex, coeffs),
      wilks: computeWilks(currentTotal, bw, sex, coeffs),
      gl: computeGLPoints(currentTotal, bw, sex, coeffs)
    },
    projected: {
      total: projectedTotal,
      dots: computeDots(projectedTotal, bw, sex, coeffs),
      wilks: computeWilks(projectedTotal, bw, sex, coeffs),
      gl: computeGLPoints(projectedTotal, bw, sex, coeffs)
    },
    growth: {
      squat: { baseline: 0, projected: 0, delta: 0, deltaPct: 0 },
      bench: { baseline: 0, projected: 0, delta: 0, deltaPct: 0 },
      deadlift: { baseline: 0, projected: 0, delta: 0, deltaPct: 0 },
      total: { baseline: 0, projected: 0, delta: 0, deltaPct: 0 }
    },
    primaryByWeek: computePrimaryLiftProgressForRows(blockData.rows || [])
  };

  let totalBaseline = 0;

  for (const lift of lifts) {
    const baseline = basics[`${lift}Baseline` as const] || 0;
    totalBaseline += baseline;

    const current = projectedMaxes[lift];
    const diff = current - baseline;
    const pct = baseline ? (diff / baseline) * 100 : 0;

    stats.growth[lift] = {
      baseline,
      projected: current,
      delta: diff,
      deltaPct: pct
    };
  }

  const totalDiff = projectedTotal - totalBaseline;
  stats.growth.total = {
    baseline: totalBaseline,
    projected: projectedTotal,
    delta: totalDiff,
    deltaPct: totalBaseline ? (totalDiff / totalBaseline) * 100 : 0
  };

  return stats;
}
