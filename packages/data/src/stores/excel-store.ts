import {
  computeAllStats,
  computeOverallPrimaryProgress,
  type AppConfig,
  type Basics,
  type BlockData,
  type BlockDescriptor,
  type CellUpdateInput,
  type IDataStore,
  type InitialPayload,
  type OverallPrimaryProgress,
  type UpdateResult,
  type UserContext
} from '@powerlifting/domain';

import {
  BASICS_CACHE_TTL_MS,
  BLOCK_DATA_CACHE_TTL_MS,
  BLOCK_NAME_RE,
  BLOCK_RECAP_RE,
  BLOCKS_CACHE_TTL_MS,
  CONFIG_CACHE_TTL_MS,
  OVERALL_PROGRESS_TTL_MS
} from '../constants';
import { parseBasicsFromSheets, parseConfigFromSheet } from '../config-basics';
import { readBlockDataFromDb } from '../db-reader';
import { type ChangeRecord, InMemoryOverrideRepository, type OverrideRepository } from '../overrides';
import { isParseQualityInvalid, parseBlockFromVisualSheetData } from '../parser';
import { TimedCache } from '../cache';
import { isA1Cell, parseDisplayNumberOrNull } from '../utils';
import { WorkbookReader } from '../workbook';

function parseBlockMeta(sheetName: string): Pick<BlockDescriptor, 'blockNum' | 'year' | 'isRecap' | 'isBlock'> {
  const blockMatch = sheetName.match(BLOCK_NAME_RE);
  const blockNum = blockMatch ? blockMatch[1] : null;
  const yearMatch = sheetName.match(/\b(20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : null;
  const isRecap = BLOCK_RECAP_RE.test(sheetName);
  const isBlock = Boolean(blockMatch);

  return {
    blockNum,
    year,
    isRecap,
    isBlock
  };
}

export interface ExcelStoreOptions {
  workbookPath: string;
  overrides?: OverrideRepository;
  cache?: TimedCache;
}

export class ExcelStore implements IDataStore {
  private reader: WorkbookReader;
  private overrides: OverrideRepository;
  private cache: TimedCache;
  private changeLog: ChangeRecord[] = [];

  constructor(options: ExcelStoreOptions) {
    this.reader = new WorkbookReader(options.workbookPath);
    this.overrides = options.overrides || new InMemoryOverrideRepository();
    this.cache = options.cache || new TimedCache();
  }

  getChangeLog(): ChangeRecord[] {
    return this.changeLog;
  }

  private cacheKey(prefix: string, user: UserContext, extra = ''): string {
    return `${prefix}:${user.userId}:${user.spreadsheetId}:${extra}`;
  }

  private resolveBlockName(blockIdOrName: string): string {
    const names = this.reader.listSheetNames();
    const direct = names.find((name) => name === blockIdOrName);
    if (direct) {
      return direct;
    }

    throw new Error(`Sheet not found: ${blockIdOrName}`);
  }

  private getConfig(user: UserContext, forceRefresh = false): AppConfig {
    const key = this.cacheKey('config', user);
    if (!forceRefresh) {
      const cached = this.cache.get<AppConfig>(key);
      if (cached) {
        return cached;
      }
    }

    const config = parseConfigFromSheet((sheetName) => this.reader.getSheetData(sheetName));
    this.cache.set(key, config, CONFIG_CACHE_TTL_MS);
    return config;
  }

  private getBasics(user: UserContext, forceRefresh = false): Basics {
    const key = this.cacheKey('basics', user);
    if (!forceRefresh) {
      const cached = this.cache.get<Basics>(key);
      if (cached) {
        return cached;
      }
    }

    const basics = parseBasicsFromSheets((sheetName) => this.reader.getSheetData(sheetName));
    this.cache.set(key, basics, BASICS_CACHE_TTL_MS);
    return basics;
  }

  async getInitialPayload(user: UserContext): Promise<InitialPayload> {
    const [blocks, basics, config] = await Promise.all([
      this.getAvailableBlocks(user),
      Promise.resolve(this.getBasics(user)),
      Promise.resolve(this.getConfig(user))
    ]);

    return {
      blocks,
      basics,
      config
    };
  }

  async getAvailableBlocks(
    user: UserContext,
    opts: { forceRefresh?: boolean } = {}
  ): Promise<BlockDescriptor[]> {
    const key = this.cacheKey('blocks', user);
    if (!opts.forceRefresh) {
      const cached = this.cache.get<BlockDescriptor[]>(key);
      if (cached) {
        return cached;
      }
    }

    const blocks = this.reader
      .listSheetNames()
      .filter((name) => !name.startsWith('_DB_'))
      .map((name) => {
        const meta = parseBlockMeta(name);
        return {
          name,
          sheetId: name,
          blockNum: meta.blockNum,
          year: meta.year,
          isRecap: meta.isRecap,
          isBlock: meta.isBlock
        };
      })
      .filter((entry) => entry.isBlock || entry.isRecap);

    this.cache.set(key, blocks, BLOCKS_CACHE_TTL_MS);
    return blocks;
  }

  private applyOverrides(blockName: string, blockData: BlockData): BlockData {
    const overrideRows = this.overrides.entriesForBlock(blockName);
    if (!overrideRows.length) {
      return blockData;
    }

    const byCell = new Map(overrideRows.map((override) => [override.cellA1.toUpperCase(), override]));

    const rows = blockData.rows.map((row) => {
      let next = row;

      if (row.actualLoadCell) {
        const actualOverride = byCell.get(row.actualLoadCell.toUpperCase());
        if (actualOverride && actualOverride.field === 'actualLoad') {
          const parsed = parseDisplayNumberOrNull(actualOverride.value);
          next = {
            ...next,
            actualLoadKg: parsed
          };
        }
      }

      if (row.rpeCell) {
        const rpeOverride = byCell.get(row.rpeCell.toUpperCase());
        if (rpeOverride && rpeOverride.field === 'rpe') {
          next = {
            ...next,
            rpe: String(rpeOverride.value)
          };
        }
      }

      return next;
    });

    return {
      ...blockData,
      rows
    };
  }

  async getBlockData(
    user: UserContext,
    blockIdOrName: string,
    opts: { forceRefresh?: boolean } = {}
  ): Promise<BlockData> {
    const blockName = this.resolveBlockName(blockIdOrName);
    const key = this.cacheKey('block', user, blockName);

    if (!opts.forceRefresh) {
      const cached = this.cache.get<BlockData>(key);
      if (cached) {
        return this.applyOverrides(blockName, cached);
      }
    }

    let result: BlockData | null = null;

    const dbRead = readBlockDataFromDb(this.reader, blockName);
    if (dbRead && !opts.forceRefresh && dbRead.hasMeta && dbRead.hasRows && !dbRead.isStale) {
      if (!isParseQualityInvalid(blockName, dbRead.data)) {
        result = dbRead.data;
      }
    }

    if (!result) {
      const visual = this.reader.getSheetData(blockName);
      result = parseBlockFromVisualSheetData(blockName, visual);
    }

    this.cache.set(key, result, BLOCK_DATA_CACHE_TTL_MS);
    return this.applyOverrides(blockName, result);
  }

  async getOverallPrimaryProgress(
    user: UserContext,
    opts: { forceRefresh?: boolean } = {}
  ): Promise<OverallPrimaryProgress> {
    const key = this.cacheKey('overall-progress', user);

    if (!opts.forceRefresh) {
      const cached = this.cache.get<OverallPrimaryProgress>(key);
      if (cached) {
        return cached;
      }
    }

    const blocks = await this.getAvailableBlocks(user);
    const result = await computeOverallPrimaryProgress(
      blocks,
      (blockName, forceRefresh) => this.getBlockData(user, blockName, { forceRefresh }),
      opts.forceRefresh || false
    );

    this.cache.set(key, result, OVERALL_PROGRESS_TTL_MS);
    return result;
  }

  private getCellServerValue(blockName: string, cellA1: string): string {
    const override = this.overrides.get(blockName, cellA1);
    if (override) {
      return String(override.value ?? '');
    }

    return this.reader.getCellDisplayValue(blockName, cellA1);
  }

  private formatUpdateValue(update: CellUpdateInput): string | number {
    if (update.field === 'actualLoad') {
      const numericValue = Number.parseFloat(String(update.newValue).replace(/,/g, ''));
      if (Number.isNaN(numericValue) || numericValue < 0 || numericValue > 2000) {
        throw new Error(`Invalid actualLoad value: ${update.newValue} for cell ${update.cellA1}`);
      }

      return numericValue;
    }

    const rpeStr = String(update.newValue).trim();
    const match = rpeStr.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      return `@ ${match[1]}`;
    }

    return rpeStr;
  }

  async updateBlockCells(
    user: UserContext,
    blockIdOrName: string,
    updates: CellUpdateInput[],
    forceOverwrite = false
  ): Promise<UpdateResult> {
    const blockName = this.resolveBlockName(blockIdOrName);

    const config = this.getConfig(user);
    if (config.disableWrites) {
      throw new Error('Writes are disabled by Config.');
    }

    for (const update of updates) {
      if (update.field !== 'actualLoad' && update.field !== 'rpe') {
        throw new Error(`Invalid field requested for update: ${update.field}`);
      }

      if (!isA1Cell(update.cellA1)) {
        throw new Error(`Invalid cell reference: ${update.cellA1}`);
      }
    }

    const conflicts: Array<{
      cellA1: string;
      serverValue: string;
      requestedOriginal: string | number | null;
    }> = [];

    for (const update of updates) {
      const serverValue = this.getCellServerValue(blockName, update.cellA1);
      if (!forceOverwrite && serverValue !== String(update.originalValue || '')) {
        conflicts.push({
          cellA1: update.cellA1,
          serverValue,
          requestedOriginal: update.originalValue
        });
      }
    }

    if (conflicts.length > 0) {
      return {
        status: 'conflict',
        conflicts,
        message: 'Some cells have changed on the sheet since you loaded the block.'
      };
    }

    for (const update of updates) {
      const formattedValue = this.formatUpdateValue(update);
      const oldValue = this.getCellServerValue(blockName, update.cellA1);

      this.overrides.set({
        blockName,
        cellA1: update.cellA1,
        field: update.field,
        value: formattedValue,
        updatedAtISO: new Date().toISOString()
      });

      this.changeLog.push({
        timestamp: new Date().toISOString(),
        sheetName: blockName,
        cellA1: update.cellA1,
        field: update.field,
        oldValue,
        newValue: formattedValue,
        blockId: blockName,
        userId: user.userId
      });
    }

    this.cache.delete(this.cacheKey('block', user, blockName));
    this.cache.delete(this.cacheKey('overall-progress', user));

    const blockData = await this.getBlockData(user, blockName, { forceRefresh: true });
    const basics = this.getBasics(user, true);
    const configAfter = this.getConfig(user, true);
    const stats = computeAllStats(blockData, basics, configAfter);

    return {
      status: 'ok',
      updatedRows: blockData.rows,
      stats,
      parserReport: blockData.parserReport
    };
  }
}

export function createLocalDevExcelStore(): ExcelStore {
  return new ExcelStore({
    workbookPath: process.env.WORKBOOK_PATH || '../../Kev Ultimate Comeback.xlsx'
  });
}
