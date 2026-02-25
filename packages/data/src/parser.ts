import { computeE1RM_Epley } from '@powerlifting/domain';
import type { BlockData, BlockRow, DaySummary, ParserDayGroup, ParserReport, Recaps } from '@powerlifting/domain';

import { BLOCK_RECAP_RE } from './constants';
import { colIndexToA1, normalizeHeader, parseDisplayNumberOrNull, parseIntOrNull, parseNumberOrNull } from './utils';

interface InternalWeekGroup {
  daySectionId: string;
  headerRow: number;
  dayRow: number;
  labelCol: number;
  exerciseCol: number;
  setsCol: number;
  repsCol: number;
  targetLoadCol: number;
  actualLoadCol: number;
  rpeCol: number;
  e1rmCol: number;
  notesCol: number;
  weekIndex: number;
  weekLabel: string;
  weekSectionId: string;
}

interface InternalDaySection {
  sectionId: string;
  dayIndex: number;
  dayLabel: string;
  dayName: string;
  dayRowIndex: number;
  headerRow: number;
  startRow: number;
  endRowExclusive: number;
  exerciseCol: number;
  weekGroups: InternalWeekGroup[];
}

export function createEmptyBlockData(sheetName: string, warning?: string): BlockData {
  return {
    rows: [],
    recaps: {
      squat: '',
      bench: '',
      deadlift: '',
      accessory: '',
      additions: '',
      coach: ''
    },
    peakE1RMs: {
      squat: null,
      bench: null,
      deadlift: null
    },
    parserReport: {
      sheetName,
      groupsFound: 0,
      groups: [],
      warnings: warning ? [warning] : [],
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

function getDayIndexFromMarker(rawValue: unknown): number | null {
  const text = String(rawValue || '').trim();
  if (!text) {
    return null;
  }

  const match = text.match(/^day\s*(\d+)\b/i);
  if (!match) {
    return null;
  }

  const n = Number.parseInt(match[1], 10);
  return Number.isNaN(n) ? null : n;
}

function formatDayLabel(dayIndex: number | null): string {
  return dayIndex ? `Day ${dayIndex}` : 'Day ?';
}

function formatWeekLabel(weekIndex: number): string {
  return `Week ${weekIndex}`;
}

function isReferenceErrorText(value: unknown): boolean {
  const text = String(value || '').trim().toUpperCase();
  return text === '#REF!' || text === '#N/A' || text === '#VALUE!';
}

function isDisplayValueEmpty(value: unknown): boolean {
  const text = String(value === null || value === undefined ? '' : value).trim();
  return text === '' || text === '-' || text === '—' || isReferenceErrorText(text);
}

function getCellDisplayValue(data: string[][], rowIndex: number, colIndex: number): string {
  if (rowIndex < 0 || colIndex < 0) {
    return '';
  }

  if (!data[rowIndex] || data[rowIndex][colIndex] === undefined) {
    return '';
  }

  return String(data[rowIndex][colIndex] || '').trim();
}

function canonicalWeekInfo(weekIndex: number | null, fallbackIndex: number): {
  weekIndex: number;
  weekLabel: string;
} {
  const idx = weekIndex && weekIndex > 0 ? weekIndex : fallbackIndex;
  return {
    weekIndex: idx,
    weekLabel: formatWeekLabel(idx)
  };
}

function parseWeekInfoFromRaw(rawValue: unknown, fallbackIndex: number): {
  weekIndex: number;
  weekLabel: string;
} {
  const fallback = canonicalWeekInfo(fallbackIndex, 1);
  const text = String(rawValue || '').trim();
  if (!text) {
    return fallback;
  }

  const weekMatch = text.match(/week\s*(\d+)/i);
  if (weekMatch) {
    const weekIndex = Number.parseInt(weekMatch[1], 10);
    if (!Number.isNaN(weekIndex) && weekIndex > 0) {
      return canonicalWeekInfo(weekIndex, fallback.weekIndex);
    }
  }

  const directNumber = Number.parseInt(text, 10);
  if (!Number.isNaN(directNumber) && directNumber > 0 && directNumber < 100) {
    return canonicalWeekInfo(directNumber, fallback.weekIndex);
  }

  return fallback;
}

function sanitizeCandidateDayName(rawValue: unknown): string {
  const text = String(rawValue || '').trim();
  if (!text) {
    return '';
  }

  if (/^day\s*\d+/i.test(text)) {
    return '';
  }

  if (/^week\s*\d+/i.test(text)) {
    return '';
  }

  if (!Number.isNaN(Number.parseFloat(text))) {
    return '';
  }

  return text;
}

function chooseNearestHeaderColumn(
  row: string[],
  leftBound: number,
  rightBound: number,
  anchorCol: number,
  predicate: (value: string) => boolean
): number {
  let bestCol = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  const from = Math.max(0, leftBound);
  const to = Math.min(row.length - 1, rightBound);

  for (let c = from; c <= to; c++) {
    const norm = normalizeHeader(row[c]);
    if (!predicate(norm)) {
      continue;
    }

    const distance = Math.abs(c - anchorCol);
    if (distance < bestDistance) {
      bestCol = c;
      bestDistance = distance;
    }
  }

  return bestCol;
}

function chooseNearestColumnFromList(cols: number[], anchorCol: number): number {
  if (!cols.length) {
    return -1;
  }

  let bestCol = cols[0];
  let bestDistance = Math.abs(bestCol - anchorCol);

  for (let i = 1; i < cols.length; i++) {
    const distance = Math.abs(cols[i] - anchorCol);
    if (distance < bestDistance) {
      bestCol = cols[i];
      bestDistance = distance;
    }
  }

  return bestCol;
}

function parseWeekInfoForGroup(
  data: string[][],
  dayRowIndex: number,
  group: InternalWeekGroup,
  fallbackIndex: number
): { weekIndex: number; weekLabel: string } {
  if (dayRowIndex < 0 || !data[dayRowIndex]) {
    return canonicalWeekInfo(fallbackIndex, fallbackIndex);
  }

  const candidateCols = [group.repsCol, group.setsCol, group.labelCol, group.exerciseCol];
  for (const col of candidateCols) {
    if (col === -1) {
      continue;
    }

    const raw = getCellDisplayValue(data, dayRowIndex, col);
    if (!raw) {
      continue;
    }

    const info = parseWeekInfoFromRaw(raw, fallbackIndex);
    if (info.weekIndex !== fallbackIndex || /week\s*\d+/i.test(raw) || /^\d+$/.test(raw.trim())) {
      return info;
    }
  }

  return canonicalWeekInfo(fallbackIndex, fallbackIndex);
}

function getExerciseValueForRow(data: string[][], rowIndex: number, daySection: InternalDaySection): string {
  const direct = getCellDisplayValue(data, rowIndex, daySection.exerciseCol);
  if (!isDisplayValueEmpty(direct)) {
    return direct;
  }

  for (const group of daySection.weekGroups) {
    const labelCol = group.labelCol;
    if (labelCol === -1) {
      continue;
    }

    const candidate = getCellDisplayValue(data, rowIndex, labelCol);
    if (!isDisplayValueEmpty(candidate)) {
      return candidate;
    }
  }

  return '';
}

function rowHasGroupData(data: string[][], rowIndex: number, group: InternalWeekGroup): boolean {
  const cols = [
    group.setsCol,
    group.repsCol,
    group.targetLoadCol,
    group.actualLoadCol,
    group.rpeCol,
    group.e1rmCol
  ];

  for (const col of cols) {
    if (col === -1) {
      continue;
    }

    if (!isDisplayValueEmpty(getCellDisplayValue(data, rowIndex, col))) {
      return true;
    }
  }

  return false;
}

function detectWeekGroupsFromHeaderRow(
  data: string[][],
  headerRowIndex: number,
  dayRowIndex: number,
  daySectionId: string
): InternalWeekGroup[] {
  const row = data[headerRowIndex] || [];
  const actualCols: number[] = [];
  const exerciseHeaderCols: number[] = [];
  const labelHeaderCols: number[] = [];

  for (let c = 0; c < row.length; c++) {
    const norm = normalizeHeader(row[c]);
    if (!norm) {
      continue;
    }

    if (norm === 'exercise') {
      exerciseHeaderCols.push(c);
    }

    if (norm === 'label') {
      labelHeaderCols.push(c);
    }

    if (norm.includes('actual') && norm.includes('load')) {
      actualCols.push(c);
    }
  }

  if (!actualCols.length) {
    return [];
  }

  const groups: InternalWeekGroup[] = [];

  for (let i = 0; i < actualCols.length; i++) {
    const actualCol = actualCols[i];
    const leftBound = i === 0 ? 0 : actualCols[i - 1] + 1;
    const rightBound = i === actualCols.length - 1 ? row.length - 1 : actualCols[i + 1] - 1;

    const group: InternalWeekGroup = {
      daySectionId,
      headerRow: headerRowIndex,
      dayRow: dayRowIndex,
      labelCol: chooseNearestHeaderColumn(row, leftBound, rightBound, actualCol, (value) => value === 'label'),
      exerciseCol: chooseNearestHeaderColumn(
        row,
        leftBound,
        rightBound,
        actualCol,
        (value) => value === 'exercise'
      ),
      setsCol: chooseNearestHeaderColumn(row, leftBound, rightBound, actualCol, (value) => value === 'sets'),
      repsCol: chooseNearestHeaderColumn(row, leftBound, rightBound, actualCol, (value) => value === 'reps'),
      targetLoadCol: chooseNearestHeaderColumn(
        row,
        leftBound,
        rightBound,
        actualCol,
        (value) => value.includes('target') && value.includes('load')
      ),
      actualLoadCol: actualCol,
      rpeCol: chooseNearestHeaderColumn(
        row,
        leftBound,
        rightBound,
        actualCol,
        (value) => value.includes('rpe')
      ),
      e1rmCol: chooseNearestHeaderColumn(
        row,
        leftBound,
        rightBound,
        actualCol,
        (value) => value.includes('e1rm') && !value.includes('peak')
      ),
      notesCol: chooseNearestHeaderColumn(
        row,
        leftBound,
        rightBound,
        actualCol,
        (value) => value.includes('note')
      ),
      weekIndex: i + 1,
      weekLabel: formatWeekLabel(i + 1),
      weekSectionId: `${daySectionId}-week${i + 1}`
    };

    if (group.exerciseCol === -1) {
      group.exerciseCol = chooseNearestColumnFromList(exerciseHeaderCols, actualCol);
    }

    if (group.labelCol === -1) {
      group.labelCol = chooseNearestColumnFromList(labelHeaderCols, actualCol);
    }

    if (group.exerciseCol === -1) {
      group.exerciseCol = Math.max(0, actualCol - 5);
    }

    if (group.setsCol === -1 && actualCol - 4 >= leftBound) {
      group.setsCol = actualCol - 4;
    }
    if (group.repsCol === -1 && actualCol - 3 >= leftBound) {
      group.repsCol = actualCol - 3;
    }
    if (group.targetLoadCol === -1 && actualCol - 2 >= leftBound) {
      group.targetLoadCol = actualCol - 2;
    }
    if (group.rpeCol === -1 && actualCol + 1 <= rightBound) {
      group.rpeCol = actualCol + 1;
    }
    if (group.e1rmCol === -1 && actualCol + 2 <= rightBound) {
      group.e1rmCol = actualCol + 2;
    }

    const weekInfo = parseWeekInfoForGroup(data, dayRowIndex, group, i + 1);
    group.weekIndex = weekInfo.weekIndex;
    group.weekLabel = weekInfo.weekLabel;
    group.weekSectionId = `${daySectionId}-week${weekInfo.weekIndex}`;

    groups.push(group);
  }

  return groups;
}

function detectDaySectionsFromMarkers(data: string[][]): InternalDaySection[] {
  const sections: InternalDaySection[] = [];
  const markers: Array<{
    dayIndex: number;
    dayLabel: string;
    dayRow: number;
  }> = [];

  for (let r = 0; r < data.length; r++) {
    const row = data[r] || [];
    const searchLimit = Math.min(30, row.length);

    for (let c = 0; c < searchLimit; c++) {
      const dayIndex = getDayIndexFromMarker(row[c]);
      if (dayIndex === null) {
        continue;
      }

      markers.push({
        dayIndex,
        dayLabel: formatDayLabel(dayIndex),
        dayRow: r
      });
      break;
    }
  }

  if (!markers.length) {
    return [];
  }

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const nextBoundary = i + 1 < markers.length ? markers[i + 1].dayRow : data.length;
    const sectionId = `day${marker.dayIndex}`;

    let headerRow = -1;
    let weekGroups: InternalWeekGroup[] = [];

    for (let r = marker.dayRow + 1; r <= Math.min(marker.dayRow + 3, data.length - 1); r++) {
      const groups = detectWeekGroupsFromHeaderRow(data, r, marker.dayRow, sectionId);
      if (groups.length) {
        headerRow = r;
        weekGroups = groups;
        break;
      }
    }

    if (headerRow === -1 || !weekGroups.length) {
      continue;
    }

    const dayNameCandidates = [weekGroups[0].setsCol, weekGroups[0].labelCol, weekGroups[0].repsCol];
    let dayName = '';

    for (const col of dayNameCandidates) {
      if (col === -1) {
        continue;
      }

      const candidate = sanitizeCandidateDayName(getCellDisplayValue(data, marker.dayRow, col));
      if (candidate) {
        dayName = candidate;
        break;
      }
    }

    sections.push({
      sectionId,
      dayIndex: marker.dayIndex,
      dayLabel: marker.dayLabel,
      dayName,
      dayRowIndex: marker.dayRow,
      headerRow,
      startRow: headerRow + 1,
      endRowExclusive: nextBoundary,
      exerciseCol: weekGroups[0].exerciseCol,
      weekGroups
    });
  }

  return sections;
}

function detectFallbackDaySectionsFromHeaders(data: string[][]): InternalDaySection[] {
  const headers: Array<{ row: number; groups: InternalWeekGroup[] }> = [];

  for (let r = 0; r < data.length; r++) {
    const groups = detectWeekGroupsFromHeaderRow(data, r, -1, '');
    if (!groups.length) {
      continue;
    }

    headers.push({
      row: r,
      groups
    });
  }

  const sections: InternalDaySection[] = [];

  for (let i = 0; i < headers.length; i++) {
    const dayIndex = i + 1;
    const sectionId = `day${dayIndex}`;
    const nextBoundary = i + 1 < headers.length ? headers[i + 1].row : data.length;

    const groups = headers[i].groups.map((group, weekOffset) => {
      const cloned = {
        ...group
      };
      const weekInfo = canonicalWeekInfo(cloned.weekIndex || weekOffset + 1, weekOffset + 1);
      cloned.weekIndex = weekInfo.weekIndex;
      cloned.weekLabel = weekInfo.weekLabel;
      cloned.daySectionId = sectionId;
      cloned.weekSectionId = `${sectionId}-week${weekInfo.weekIndex}`;
      return cloned;
    });

    sections.push({
      sectionId,
      dayIndex,
      dayLabel: formatDayLabel(dayIndex),
      dayName: '',
      dayRowIndex: headers[i].row - 1,
      headerRow: headers[i].row,
      startRow: headers[i].row + 1,
      endRowExclusive: nextBoundary,
      exerciseCol: groups[0].exerciseCol,
      weekGroups: groups
    });
  }

  return sections;
}

function computePeakE1RMsFromRows(rows: BlockRow[]): BlockData['peakE1RMs'] {
  const peaks: BlockData['peakE1RMs'] = {
    squat: null,
    bench: null,
    deadlift: null
  };

  for (const row of rows) {
    const exercise = String(row.exercise || '').toLowerCase();
    const e1rm = parseDisplayNumberOrNull(row.e1rm);
    if (!e1rm) {
      continue;
    }

    if (exercise.includes('squat')) {
      peaks.squat = Math.max(peaks.squat || 0, e1rm);
    } else if (exercise.includes('bench')) {
      peaks.bench = Math.max(peaks.bench || 0, e1rm);
    } else if (exercise.includes('deadlift')) {
      peaks.deadlift = Math.max(peaks.deadlift || 0, e1rm);
    }
  }

  return peaks;
}

function extractRecapsFromBlockData(data: string[][]): Recaps {
  const recaps: Recaps = {
    squat: '',
    bench: '',
    deadlift: '',
    accessory: '',
    additions: '',
    coach: ''
  };

  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const cellText = String(data[r][c] || '').trim();
      if (!cellText) {
        continue;
      }

      const lower = cellText.toLowerCase();
      if (lower.includes('recap')) {
        if (lower.includes('squat')) {
          recaps.squat = String(data[r][c + 1] || data[r + 1]?.[c] || '');
        } else if (lower.includes('bench')) {
          recaps.bench = String(data[r][c + 1] || data[r + 1]?.[c] || '');
        } else if (lower.includes('deadlift')) {
          recaps.deadlift = String(data[r][c + 1] || data[r + 1]?.[c] || '');
        } else if (lower.includes('accessory')) {
          recaps.accessory = String(data[r][c + 1] || data[r + 1]?.[c] || '');
        }
      }

      if (lower.includes('additional things to fix')) {
        recaps.additions = String(data[r][c + 1] || data[r + 1]?.[c] || '');
      }

      if (lower.includes("coach's note") || lower.includes('coach note') || lower.includes('changes')) {
        recaps.coach = String(data[r][c + 1] || data[r + 1]?.[c] || '');
      }
    }
  }

  return recaps;
}

function parserGroupsFromSections(sections: InternalDaySection[]): ParserDayGroup[] {
  return sections.map((section) => ({
    daySectionId: section.sectionId,
    dayIndex: section.dayIndex,
    dayLabel: section.dayLabel,
    dayName: section.dayName,
    dayRowIndex: section.dayRowIndex + 1,
    headerRowIndex: section.headerRow + 1,
    weekGroups: section.weekGroups.map((group) => ({
      weekIndex: group.weekIndex,
      weekLabel: group.weekLabel,
      weekSectionId: group.weekSectionId,
      actualLoadCol: group.actualLoadCol === -1 ? null : group.actualLoadCol + 1,
      rpeCol: group.rpeCol === -1 ? null : group.rpeCol + 1,
      targetLoadCol: group.targetLoadCol === -1 ? null : group.targetLoadCol + 1
    }))
  }));
}

function parserDaySummaries(
  sections: InternalDaySection[],
  daySummaryMap: Map<string, DaySummary>
): DaySummary[] {
  return sections
    .map((section) => daySummaryMap.get(section.sectionId))
    .filter((summary): summary is DaySummary => Boolean(summary));
}

export function parseBlockFromVisualSheetData(sheetName: string, data: string[][]): BlockData {
  if (!data.length || !data[0]?.length) {
    return createEmptyBlockData(sheetName, 'Empty sheet');
  }

  const parserReport: ParserReport = {
    sheetName,
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
  };

  const recaps = extractRecapsFromBlockData(data);
  const parsedRows: BlockRow[] = [];

  let daySections = detectDaySectionsFromMarkers(data);
  if (daySections.length > 0) {
    parserReport.layoutVariant = 'day_marker_template';
  } else {
    parserReport.layoutVariant = 'header_repeat_fallback';
    parserReport.warnings.push(
      'No DAY markers found. Falling back to repeated header autodetection.'
    );
    daySections = detectFallbackDaySectionsFromHeaders(data);
  }

  parserReport.daySectionsFound = daySections.length;

  if (!daySections.length) {
    parserReport.warnings.push('No valid tracking groups found (missing ACTUAL LOAD headers).');
    return {
      rows: [],
      recaps,
      peakE1RMs: {
        squat: null,
        bench: null,
        deadlift: null
      },
      parserReport
    };
  }

  const activeWeekIndices: Record<string, boolean> = {};
  let plannedWeekCount = 0;
  const daySummaryMap = new Map<string, DaySummary>();

  for (const section of daySections) {
    plannedWeekCount = Math.max(plannedWeekCount, section.weekGroups.length);

    const weekSummaryMap = new Map<
      string,
      {
        weekIndex: number;
        weekLabel: string;
        weekSectionId: string;
        mappedRows: number;
        hasTargetOrActual: boolean;
      }
    >();

    for (const group of section.weekGroups) {
      weekSummaryMap.set(group.weekSectionId, {
        weekIndex: group.weekIndex,
        weekLabel: group.weekLabel,
        weekSectionId: group.weekSectionId,
        mappedRows: 0,
        hasTargetOrActual: false
      });
    }

    const seenExercises: Record<string, boolean> = {};
    let mappedRowsForDay = 0;

    for (let r = section.startRow; r < Math.min(section.endRowExclusive, data.length); r++) {
      const exercise = getExerciseValueForRow(data, r, section);
      if (isDisplayValueEmpty(exercise)) {
        continue;
      }

      let hasDataAcrossWeeks = false;
      for (const group of section.weekGroups) {
        if (rowHasGroupData(data, r, group)) {
          hasDataAcrossWeeks = true;
          break;
        }
      }

      if (!hasDataAcrossWeeks) {
        continue;
      }

      seenExercises[String(exercise).toLowerCase()] = true;

      for (const group of section.weekGroups) {
        if (!rowHasGroupData(data, r, group)) {
          continue;
        }

        const sets = getCellDisplayValue(data, r, group.setsCol);
        const reps = getCellDisplayValue(data, r, group.repsCol);
        const targetLoad = getCellDisplayValue(data, r, group.targetLoadCol);
        const actualLoad = getCellDisplayValue(data, r, group.actualLoadCol);
        const rpe = getCellDisplayValue(data, r, group.rpeCol);
        const e1rmRaw = getCellDisplayValue(data, r, group.e1rmCol);
        const notes = getCellDisplayValue(data, r, group.notesCol);

        const targetLoadKg = isDisplayValueEmpty(targetLoad) ? null : targetLoad;
        const actualLoadKg = parseDisplayNumberOrNull(actualLoad);

        let parsedE1rm = parseDisplayNumberOrNull(e1rmRaw);
        if (parsedE1rm === null && actualLoadKg !== null) {
          let repCount = parseDisplayNumberOrNull(reps);
          if ((repCount === null || repCount <= 0) && !isDisplayValueEmpty(rpe)) {
            repCount = 1;
          }

          if (repCount !== null && repCount > 0) {
            parsedE1rm = computeE1RM_Epley(actualLoadKg, repCount);
          }
        }

        const dayLabel = section.dayLabel || formatDayLabel(section.dayIndex);
        const dayName = section.dayName || '';
        const weekLabel = group.weekLabel || formatWeekLabel(group.weekIndex);
        const dayDisplay = dayName ? `${dayLabel} (${dayName})` : dayLabel;

        const hasTargetOrActual =
          !isDisplayValueEmpty(targetLoad) || !isDisplayValueEmpty(actualLoad);

        if (hasTargetOrActual) {
          activeWeekIndices[String(group.weekIndex)] = true;
          const summary = weekSummaryMap.get(group.weekSectionId);
          if (summary) {
            summary.hasTargetOrActual = true;
          }
        }

        const summary = weekSummaryMap.get(group.weekSectionId);
        if (summary) {
          summary.mappedRows++;
        }

        mappedRowsForDay++;
        parserReport.mappedRows++;

        parsedRows.push({
          sheetName,
          groupLabel: `${dayDisplay} - ${weekLabel}`,
          rowIndex: r + 1,
          exercise,
          sets: isDisplayValueEmpty(sets) ? '' : sets,
          reps: isDisplayValueEmpty(reps) ? '' : reps,
          targetLoadKg,
          actualLoadKg,
          actualLoadCell: group.actualLoadCol !== -1 ? colIndexToA1(group.actualLoadCol, r + 1) : null,
          rpe: isDisplayValueEmpty(rpe) ? null : rpe,
          rpeCell: group.rpeCol !== -1 ? colIndexToA1(group.rpeCol, r + 1) : null,
          e1rm: parsedE1rm,
          notes: isDisplayValueEmpty(notes) ? '' : notes,
          dayIndex: section.dayIndex,
          dayLabel,
          dayName,
          dayRowIndex: section.dayRowIndex + 1,
          daySectionId: section.sectionId,
          weekIndex: group.weekIndex,
          weekLabel,
          weekSectionId: group.weekSectionId
        });
      }
    }

    const weekSummaries = [...weekSummaryMap.values()].sort((a, b) => a.weekIndex - b.weekIndex);
    daySummaryMap.set(section.sectionId, {
      daySectionId: section.sectionId,
      dayIndex: section.dayIndex,
      dayLabel: section.dayLabel,
      dayName: section.dayName,
      dayRowIndex: section.dayRowIndex + 1,
      headerRowIndex: section.headerRow + 1,
      plannedWeekCount: section.weekGroups.length,
      exerciseCount: Object.keys(seenExercises).length,
      mappedRows: mappedRowsForDay,
      isActive: mappedRowsForDay > 0,
      weekSummaries
    });
  }

  parserReport.daySummaries = parserDaySummaries(daySections, daySummaryMap);
  parserReport.activeDays = parserReport.daySummaries.filter((d) => d.isActive).length;
  parserReport.plannedWeekCount = plannedWeekCount;
  parserReport.activeWeekCount = Object.keys(activeWeekIndices).length;
  parserReport.groupsFound = plannedWeekCount;
  parserReport.groups = parserGroupsFromSections(daySections);

  return {
    rows: parsedRows,
    recaps,
    peakE1RMs: computePeakE1RMsFromRows(parsedRows),
    parserReport
  };
}

export function isParseQualityInvalid(blockName: string, data: BlockData): boolean {
  if (BLOCK_RECAP_RE.test(blockName)) {
    return false;
  }

  if (!data.rows.length) {
    return true;
  }

  const report = data.parserReport || ({} as ParserReport);
  if ((report.groupsFound || 0) <= 0) {
    return true;
  }

  if ((report.mappedRows || 0) <= 0) {
    return true;
  }

  const warnings = report.warnings || [];
  if (warnings.some((w) => String(w).toLowerCase().includes('missing actual load'))) {
    return true;
  }

  const hasWeekMeta = data.rows.some((row) => parseIntOrNull(row.weekIndex) !== null);
  const hasDayMeta = data.rows.some((row) => parseIntOrNull(row.dayIndex) !== null);
  return !hasWeekMeta || !hasDayMeta;
}

export function hydrateLegacyDbMetadata(rows: BlockRow[]): BlockRow[] {
  return rows.map((row) => {
    const weekIndex = parseIntOrNull(row.weekIndex);
    const dayIndex = parseIntOrNull(row.dayIndex);

    const weekLabel = row.weekLabel || (weekIndex ? formatWeekLabel(weekIndex) : '');
    const dayLabel = row.dayLabel || (dayIndex ? formatDayLabel(dayIndex) : '');
    const daySectionId = row.daySectionId || (dayIndex ? `day${dayIndex}` : '');
    const weekSectionId =
      row.weekSectionId || (daySectionId && weekIndex ? `${daySectionId}-week${weekIndex}` : '');

    return {
      ...row,
      weekIndex,
      dayIndex,
      weekLabel,
      dayLabel,
      daySectionId,
      weekSectionId
    };
  });
}

export function parseDbValueToBlockRow(raw: Record<string, unknown>): BlockRow {
  const weekIndex = parseIntOrNull(raw.WeekIndex);
  const dayIndex = parseIntOrNull(raw.DayIndex);

  return {
    sheetName: String(raw.BlockName || ''),
    groupLabel: String(raw.GroupLabel || ''),
    rowIndex: raw.RowIndex === '' || raw.RowIndex === null ? '' : String(raw.RowIndex),
    exercise: String(raw.Exercise || ''),
    sets: String(raw.Sets || ''),
    reps: String(raw.Reps || ''),
    targetLoadKg: parseNumberOrNull(raw.TargetLoadKg),
    actualLoadKg: parseNumberOrNull(raw.ActualLoadKg),
    actualLoadCell: raw.ActualLoadCell ? String(raw.ActualLoadCell) : null,
    rpe: raw.RPE ? String(raw.RPE) : null,
    rpeCell: raw.RPECell ? String(raw.RPECell) : null,
    e1rm: parseNumberOrNull(raw.E1RM),
    notes: String(raw.Notes || ''),
    weekIndex,
    weekLabel: String(raw.WeekLabel || ''),
    dayIndex,
    dayLabel: String(raw.DayLabel || ''),
    dayName: String(raw.DayName || ''),
    dayRowIndex: parseIntOrNull(raw.DayRowIndex),
    weekSectionId: String(raw.WeekSectionId || ''),
    daySectionId: String(raw.DaySectionId || '')
  };
}
