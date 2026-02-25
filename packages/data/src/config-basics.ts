import { createDefaultBasics, createDefaultConfig } from '@powerlifting/domain';
import type { AppConfig, Basics } from '@powerlifting/domain';

import { normalizeHeader } from './utils';

const CALENDAR_INFO_SHEET_NAME = 'Calendar  Split  Info  PRs';

function extractNumericValues(value: unknown): number[] {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return [value];
  }

  const str = String(value);
  const matches = str.match(/-?\d[\d,]*(?:\.\d+)?/g);
  if (!matches) {
    return [];
  }

  const out: number[] = [];
  for (const m of matches) {
    const parsed = Number.parseFloat(m.replace(/,/g, ''));
    if (Number.isFinite(parsed)) {
      out.push(parsed);
    }
  }

  return out;
}

function pickFirstNumberInRange(numbers: number[], min: number, max: number): number | null {
  for (const n of numbers) {
    if (n >= min && n <= max) {
      return n;
    }
  }
  return null;
}

function pickMaxNumberInRange(numbers: number[], min: number, max: number): number | null {
  let best: number | null = null;
  for (const n of numbers) {
    if (n < min || n > max) {
      continue;
    }

    if (best === null || n > best) {
      best = n;
    }
  }

  return best;
}

function parseSexValue(value: unknown): Basics['sex'] | null {
  const text = normalizeHeader(value);
  if (!text) {
    return null;
  }

  if (text.startsWith('f')) {
    return 'female';
  }

  if (text.startsWith('m')) {
    return 'male';
  }

  return null;
}

function canonicalLiftFromLabel(label: unknown): 'squat' | 'bench' | 'deadlift' | null {
  const key = normalizeHeader(label);
  if (key === 'squat') {
    return 'squat';
  }

  if (key === 'bench' || key === 'bench press') {
    return 'bench';
  }

  if (key === 'deadlift' || key === 'sumo deadlift' || key === 'dl') {
    return 'deadlift';
  }

  return null;
}

function applyBasicsFromBasicsSheet(data: string[][], basics: Basics): void {
  for (const row of data) {
    const key = normalizeHeader(row[0]);
    const val = row[1];

    if (!key) {
      continue;
    }

    if (key.includes('bodyweight') || key === 'body weight' || key === 'bw') {
      const bw = pickFirstNumberInRange(extractNumericValues(val), 30, 250);
      if (bw !== null) {
        basics.bodyweight = bw;
      }
      continue;
    }

    if (key === 'sex' || key === 'gender') {
      const parsedSex = parseSexValue(val);
      if (parsedSex) {
        basics.sex = parsedSex;
      }
      continue;
    }

    if (key.includes('squat baseline')) {
      const baseline = pickMaxNumberInRange(extractNumericValues(val), 30, 600);
      if (baseline !== null) {
        basics.squatBaseline = baseline;
      }
      continue;
    }

    if (key.includes('bench baseline')) {
      const baseline = pickMaxNumberInRange(extractNumericValues(val), 30, 600);
      if (baseline !== null) {
        basics.benchBaseline = baseline;
      }
      continue;
    }

    if (key.includes('deadlift baseline')) {
      const baseline = pickMaxNumberInRange(extractNumericValues(val), 30, 600);
      if (baseline !== null) {
        basics.deadliftBaseline = baseline;
      }
    }
  }
}

function parseBasicsFromCalendarInfoSheet(data: string[][], basics: Basics): void {
  for (const row of data) {
    for (let c = 0; c < row.length; c++) {
      const key = normalizeHeader(row[c]);
      if (!key) {
        continue;
      }

      if (key === 'gender' || key === 'sex') {
        const parsedSex = parseSexValue(row[c + 1]);
        if (parsedSex) {
          basics.sex = parsedSex;
        }
      }

      if (
        key.includes('starting bw') ||
        key.includes('starting bodyweight') ||
        key.includes('bodyweight') ||
        (key === 'weight class' && basics.bodyweight === 80)
      ) {
        const bw = pickFirstNumberInRange(extractNumericValues(row[c + 1]), 30, 250);
        if (bw !== null) {
          basics.bodyweight = bw;
        }
      }

      const lift = canonicalLiftFromLabel(key);
      if (lift) {
        const rowNumbers: number[] = [];
        for (const raw of row) {
          rowNumbers.push(...extractNumericValues(raw));
        }

        const baseline = pickMaxNumberInRange(rowNumbers, 30, 600);
        if (baseline !== null) {
          if (lift === 'squat') {
            basics.squatBaseline = baseline;
          } else if (lift === 'bench') {
            basics.benchBaseline = baseline;
          } else {
            basics.deadliftBaseline = baseline;
          }
        }
      }
    }
  }
}

export function parseBasicsFromSheets(getSheetData: (sheetName: string) => string[][]): Basics {
  const basics = createDefaultBasics();
  const basicsSheet = getSheetData('BASICS');

  if (basicsSheet.length > 0) {
    applyBasicsFromBasicsSheet(basicsSheet, basics);
    return basics;
  }

  const fallbackSheet = getSheetData(CALENDAR_INFO_SHEET_NAME);
  if (fallbackSheet.length > 0) {
    parseBasicsFromCalendarInfoSheet(fallbackSheet, basics);
  }

  return basics;
}

export function parseConfigFromSheet(getSheetData: (sheetName: string) => string[][]): AppConfig {
  const config = createDefaultConfig();
  const configData = getSheetData('Config');

  if (!configData.length) {
    return config;
  }

  for (const row of configData) {
    const key = String(row[0] || '').trim();
    const val = row[1];

    if (!key) {
      continue;
    }

    if (key.startsWith('DOTS_') || key.startsWith('WILKS_') || key.startsWith('GLPOINTS_')) {
      try {
        config.coefficients[key] = JSON.parse(String(val || '{}')) as Record<string, number>;
      } catch {
        // Ignore invalid custom coefficient JSON.
      }
      continue;
    }

    if (key === 'disableWrites') {
      config.disableWrites = String(val).toLowerCase() === 'true';
    }
  }

  return config;
}
