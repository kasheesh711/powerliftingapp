import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { WorkBook } from 'xlsx';

import { a1ToRowCol } from './utils';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx') as typeof import('xlsx');

export class WorkbookReader {
  private workbook: WorkBook | null = null;
  private matrixCache = new Map<string, string[][]>();

  constructor(private readonly workbookPath: string) {}

  private loadWorkbook(): WorkBook {
    if (!this.workbook) {
      const resolved = path.resolve(this.workbookPath);
      try {
        fs.accessSync(resolved, fs.constants.R_OK);
      } catch {
        throw new Error(`Workbook file is not readable at "${resolved}".`);
      }

      let bytes: Buffer;
      try {
        bytes = fs.readFileSync(resolved);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read workbook file at "${resolved}": ${message}`);
      }

      try {
        this.workbook = XLSX.read(bytes, {
          type: 'buffer',
          cellText: true,
          raw: false
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse workbook at "${resolved}": ${message}`);
      }
    }

    return this.workbook;
  }

  listSheetNames(): string[] {
    return this.loadWorkbook().SheetNames;
  }

  hasSheet(sheetName: string): boolean {
    return this.listSheetNames().includes(sheetName);
  }

  getSheetData(sheetName: string): string[][] {
    if (this.matrixCache.has(sheetName)) {
      return this.matrixCache.get(sheetName)!;
    }

    const workbook = this.loadWorkbook();
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return [];
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: ''
    }) as Array<Array<string | number | null | undefined>>;

    const normalized = rows.map((row) => row.map((cell) => String(cell ?? '').trim()));
    this.matrixCache.set(sheetName, normalized);
    return normalized;
  }

  getCellDisplayValue(sheetName: string, cellA1: string): string {
    const data = this.getSheetData(sheetName);
    const { rowIndex, colIndex } = a1ToRowCol(cellA1);
    if (rowIndex < 0 || colIndex < 0) {
      return '';
    }

    if (!data[rowIndex]) {
      return '';
    }

    const value = data[rowIndex][colIndex];
    return String(value || '').trim();
  }
}
