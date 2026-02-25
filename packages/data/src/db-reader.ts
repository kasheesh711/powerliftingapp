import type { BlockData, BlockRow } from '@powerlifting/domain';

import { DB_BLOCKS_SHEET_NAME, DB_METADATA_SHEET_NAME, DB_METADATA_STALE_MS } from './constants';
import { hydrateLegacyDbMetadata, parseDbValueToBlockRow } from './parser';
import { parseIntOrNull } from './utils';
import type { WorkbookReader } from './workbook';

export interface DbReadResult {
  data: BlockData;
  hasRows: boolean;
  hasMeta: boolean;
  syncedAtISO: string;
  isStale: boolean;
}

function parseJsonSafe<T>(raw: string, fallbackValue: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallbackValue;
  }
}

function isDbMetaStale(syncedAtISO: string, now: number): boolean {
  if (!syncedAtISO) {
    return true;
  }

  const timestamp = new Date(syncedAtISO).getTime();
  if (!Number.isFinite(timestamp)) {
    return true;
  }

  return now - timestamp > DB_METADATA_STALE_MS;
}

function mapHeaderIndexes(headerRow: string[], defaults: Record<string, { header: string; fallback: number }>): Record<string, number> {
  const map: Record<string, number> = {};

  for (const key of Object.keys(defaults)) {
    const def = defaults[key];
    const found = headerRow.indexOf(def.header);
    map[key] = found === -1 ? def.fallback : found;
  }

  return map;
}

function readRowsFromDbBlocks(rows: string[][], blockName: string): BlockRow[] {
  const header = rows[0] || [];
  const idx = mapHeaderIndexes(header, {
    blockName: { header: 'BlockName', fallback: 0 },
    groupLabel: { header: 'GroupLabel', fallback: 1 },
    rowIndex: { header: 'RowIndex', fallback: 2 },
    exercise: { header: 'Exercise', fallback: 3 },
    sets: { header: 'Sets', fallback: 4 },
    reps: { header: 'Reps', fallback: 5 },
    targetLoadKg: { header: 'TargetLoadKg', fallback: 6 },
    actualLoadKg: { header: 'ActualLoadKg', fallback: 7 },
    actualLoadCell: { header: 'ActualLoadCell', fallback: 8 },
    rpe: { header: 'RPE', fallback: 9 },
    rpeCell: { header: 'RPECell', fallback: 10 },
    e1rm: { header: 'E1RM', fallback: 11 },
    notes: { header: 'Notes', fallback: 12 },
    weekIndex: { header: 'WeekIndex', fallback: -1 },
    weekLabel: { header: 'WeekLabel', fallback: -1 },
    dayIndex: { header: 'DayIndex', fallback: -1 },
    dayLabel: { header: 'DayLabel', fallback: -1 },
    dayName: { header: 'DayName', fallback: -1 },
    dayRowIndex: { header: 'DayRowIndex', fallback: -1 },
    weekSectionId: { header: 'WeekSectionId', fallback: -1 },
    daySectionId: { header: 'DaySectionId', fallback: -1 }
  });

  const out: BlockRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[idx.blockName] || '') !== blockName) {
      continue;
    }

    const parsed = parseDbValueToBlockRow({
      BlockName: row[idx.blockName],
      GroupLabel: row[idx.groupLabel],
      RowIndex: row[idx.rowIndex],
      Exercise: row[idx.exercise],
      Sets: row[idx.sets],
      Reps: row[idx.reps],
      TargetLoadKg: row[idx.targetLoadKg],
      ActualLoadKg: row[idx.actualLoadKg],
      ActualLoadCell: row[idx.actualLoadCell],
      RPE: row[idx.rpe],
      RPECell: row[idx.rpeCell],
      E1RM: row[idx.e1rm],
      Notes: row[idx.notes],
      WeekIndex: idx.weekIndex === -1 ? '' : row[idx.weekIndex],
      WeekLabel: idx.weekLabel === -1 ? '' : row[idx.weekLabel],
      DayIndex: idx.dayIndex === -1 ? '' : row[idx.dayIndex],
      DayLabel: idx.dayLabel === -1 ? '' : row[idx.dayLabel],
      DayName: idx.dayName === -1 ? '' : row[idx.dayName],
      DayRowIndex: idx.dayRowIndex === -1 ? '' : row[idx.dayRowIndex],
      WeekSectionId: idx.weekSectionId === -1 ? '' : row[idx.weekSectionId],
      DaySectionId: idx.daySectionId === -1 ? '' : row[idx.daySectionId]
    });

    out.push(parsed);
  }

  return hydrateLegacyDbMetadata(out);
}

export function readBlockDataFromDb(
  reader: WorkbookReader,
  blockName: string,
  now = Date.now()
): DbReadResult | null {
  if (!reader.hasSheet(DB_BLOCKS_SHEET_NAME) || !reader.hasSheet(DB_METADATA_SHEET_NAME)) {
    return null;
  }

  const metaData = reader.getSheetData(DB_METADATA_SHEET_NAME);
  if (metaData.length < 2) {
    return null;
  }

  const result: DbReadResult = {
    data: {
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
        sheetName: blockName,
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
    },
    hasRows: false,
    hasMeta: false,
    syncedAtISO: '',
    isStale: true
  };

  const metaHeader = metaData[0] || [];
  const metaIdx = mapHeaderIndexes(metaHeader, {
    blockName: { header: 'BlockName', fallback: 0 },
    recaps: { header: 'RecapsJSON', fallback: 1 },
    peaks: { header: 'PeakE1RMsJSON', fallback: 2 },
    parser: { header: 'ParserReportJSON', fallback: 3 },
    syncedAt: { header: 'SyncedAtISO', fallback: 4 }
  });

  for (let i = 1; i < metaData.length; i++) {
    const row = metaData[i];
    if (String(row[metaIdx.blockName] || '') !== blockName) {
      continue;
    }

    result.hasMeta = true;
    result.data.recaps = parseJsonSafe(row[metaIdx.recaps] || '{}', result.data.recaps);
    result.data.peakE1RMs = parseJsonSafe(row[metaIdx.peaks] || '{}', result.data.peakE1RMs);
    result.data.parserReport = parseJsonSafe(row[metaIdx.parser] || '{}', result.data.parserReport);
    result.syncedAtISO = String(row[metaIdx.syncedAt] || '');
    result.isStale = isDbMetaStale(result.syncedAtISO, now);
    break;
  }

  if (!result.hasMeta) {
    return result;
  }

  const blockRows = reader.getSheetData(DB_BLOCKS_SHEET_NAME);
  if (blockRows.length < 2) {
    return result;
  }

  result.data.rows = readRowsFromDbBlocks(blockRows, blockName);
  result.hasRows = result.data.rows.length > 0;

  if (!result.data.parserReport.sheetName) {
    result.data.parserReport.sheetName = blockName;
  }

  const report = result.data.parserReport;
  report.groupsFound = report.groupsFound || 0;
  report.mappedRows = report.mappedRows || result.data.rows.length;
  report.activeDays = report.activeDays || 0;
  report.plannedWeekCount = report.plannedWeekCount || 0;
  report.activeWeekCount = report.activeWeekCount || 0;

  const hasWeek = result.data.rows.some((row) => parseIntOrNull(row.weekIndex) !== null);
  const hasDay = result.data.rows.some((row) => parseIntOrNull(row.dayIndex) !== null);
  if (!hasWeek || !hasDay) {
    result.isStale = true;
  }

  return result;
}
