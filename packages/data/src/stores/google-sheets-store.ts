import {
  computeAllStats,
  computeOverallPrimaryProgress,
  createDefaultConfig,
  AppConfig,
  Basics,
  BlockData,
  BlockDescriptor,
  CellUpdateInput,
  DashboardPayload,
  IDataStore,
  InitialPayload,
  OverallPrimaryProgress,
  UpdateResult,
  UserContext
} from '@powerlifting/domain';

import { parseBasicsFromSheets, parseConfigFromSheet } from '../config-basics';
import { TimedCache } from '../cache';
import { BLOCK_NAME_RE, BLOCK_RECAP_RE } from '../constants';
import { parseBlockFromVisualSheetData } from '../parser';
import { ExcelStore, type ExcelStoreOptions } from './excel-store';

interface ValueRange {
  range?: string;
  values?: string[][];
}

interface SheetsValuesBatchGetResponse {
  valueRanges?: ValueRange[];
}

interface SheetsValuesGetResponse {
  values?: string[][];
}

interface SheetsListResponse {
  sheets?: Array<{
    properties?: {
      sheetId?: number;
      title?: string;
    };
  }>;
}

interface GoogleAccessToken {
  accessToken: string;
  expiryDate: number | null;
}

type AccessTokenProvider = (
  userId: string
) => Promise<GoogleAccessToken | null> | GoogleAccessToken | null;

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

export interface GoogleSheetsStoreOptions {
  fallbackExcelOptions?: ExcelStoreOptions;
  accessTokenProvider?: AccessTokenProvider;
  strict?: boolean;
}

/**
 * Runtime Google backend adapter.
 *
 * In strict mode this class fails fast when OAuth access tokens are unavailable.
 * In non-strict mode it falls back to ExcelStore for local parity workflows.
 */
export class GoogleSheetsStore implements IDataStore {
  private fallback: ExcelStore | null;
  private fallbackExcelOptions?: ExcelStoreOptions;
  private strict: boolean;
  private accessTokenProvider: AccessTokenProvider | null;
  private cache: TimedCache;
  private readonly ttl = {
    blocks: 5 * 60 * 1000,
    blockData: 5 * 60 * 1000,
    basics: 10 * 60 * 1000,
    config: 10 * 60 * 1000,
    overall: 5 * 60 * 1000
  };

  constructor(options: GoogleSheetsStoreOptions) {
    this.fallbackExcelOptions = options.fallbackExcelOptions;
    this.fallback = options.fallbackExcelOptions ? new ExcelStore(options.fallbackExcelOptions) : null;
    this.strict = options.strict || false;
    this.accessTokenProvider = options.accessTokenProvider || null;
    this.cache = new TimedCache();
  }

  private getFallbackStore(): ExcelStore {
    if (!this.fallback) {
      if (!this.fallbackExcelOptions) {
        throw new Error('Excel fallback is not configured for GoogleSheetsStore.');
      }
      this.fallback = new ExcelStore(this.fallbackExcelOptions);
    }

    return this.fallback;
  }

  private cacheKey(user: UserContext, suffix: string): string {
    return `google:${user.userId}:${user.spreadsheetId}:${suffix}`;
  }

  private normalizeValues(values?: string[][]): string[][] {
    if (!values) {
      return [];
    }

    return values.map((row) => row.map((value) => String(value || '').trim()));
  }

  private toA1Range(sheetName: string, a1: string): string {
    return `'${sheetName.replace(/'/g, "''")}'!${a1}`;
  }

  private async resolveAccessToken(user: UserContext): Promise<string | null> {
    if (!this.accessTokenProvider) {
      if (this.strict) {
        throw new Error('Google access-token provider is not configured.');
      }
      return null;
    }

    const token = await this.accessTokenProvider(user.userId);
    if (!token?.accessToken) {
      if (this.strict) {
        throw new Error('Google credential not found for user.');
      }
      return null;
    }

    return token.accessToken;
  }

  private async googleJson<T>(
    accessToken: string,
    url: string,
    init: RequestInit = {}
  ): Promise<T> {
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${accessToken}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...init,
      headers
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Sheets API request failed (${response.status}): ${text || 'empty body'}`);
    }

    return (await response.json()) as T;
  }

  private async loadBasics(
    user: UserContext,
    accessToken: string,
    forceRefresh = false
  ): Promise<Basics> {
    const key = this.cacheKey(user, 'basics');
    if (!forceRefresh) {
      const cached = this.cache.get<Basics>(key);
      if (cached) {
        return cached;
      }
    }

    const basicsResp = await this.googleJson<SheetsValuesGetResponse>(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(user.spreadsheetId)}/values/BASICS!A:B`
    ).catch(() => ({ values: [] }));

    const calendarResp = await this.googleJson<SheetsValuesGetResponse>(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        user.spreadsheetId
      )}/values/${encodeURIComponent('Calendar  Split  Info  PRs!A:ZZ')}`
    ).catch(() => ({ values: [] }));

    const bySheet = new Map<string, string[][]>([
      ['BASICS', this.normalizeValues(basicsResp.values)],
      ['Calendar  Split  Info  PRs', this.normalizeValues(calendarResp.values)]
    ]);

    const basics = parseBasicsFromSheets((sheetName) => bySheet.get(sheetName) || []);
    this.cache.set(key, basics, this.ttl.basics);
    return basics;
  }

  private async loadConfig(
    user: UserContext,
    accessToken: string,
    forceRefresh = false
  ): Promise<AppConfig> {
    const key = this.cacheKey(user, 'config');
    if (!forceRefresh) {
      const cached = this.cache.get<AppConfig>(key);
      if (cached) {
        return cached;
      }
    }

    const configResp = await this.googleJson<SheetsValuesGetResponse>(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(user.spreadsheetId)}/values/Config!A:B`
    ).catch(() => ({ values: [] }));

    const bySheet = new Map<string, string[][]>([['Config', this.normalizeValues(configResp.values)]]);
    const config = parseConfigFromSheet((sheetName) => bySheet.get(sheetName) || []) || createDefaultConfig();
    this.cache.set(key, config, this.ttl.config);
    return config;
  }

  private async getAvailableBlocksFromGoogle(
    user: UserContext,
    accessToken: string,
    forceRefresh = false
  ): Promise<BlockDescriptor[]> {
    const key = this.cacheKey(user, 'blocks');
    if (!forceRefresh) {
      const cached = this.cache.get<BlockDescriptor[]>(key);
      if (cached) {
        return cached;
      }
    }

    const response = await this.googleJson<SheetsListResponse>(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(user.spreadsheetId)}?fields=sheets(properties(sheetId,title))`
    );

    const byNameId = new Map<string, string>();
    for (const sheet of response.sheets || []) {
      const title = sheet.properties?.title;
      const sheetId = sheet.properties?.sheetId;
      if (!title || sheetId === undefined) {
        continue;
      }
      byNameId.set(title, String(sheetId));
    }

    const blocks = [...byNameId.keys()]
      .map((name) => {
        const meta = parseBlockMeta(name);
        return {
          name,
          sheetId: byNameId.get(name),
          blockNum: meta.blockNum,
          year: meta.year,
          isRecap: meta.isRecap,
          isBlock: meta.isBlock
        };
      })
      .filter((entry) => entry.isBlock || entry.isRecap);

    this.cache.set(key, blocks, this.ttl.blocks);
    return blocks;
  }

  private async parseBlockFromGoogle(
    user: UserContext,
    accessToken: string,
    blockName: string
  ): Promise<BlockData> {
    const visualResponse = await this.googleJson<SheetsValuesGetResponse>(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        user.spreadsheetId
      )}/values/${encodeURIComponent(this.toA1Range(blockName, 'A:ZZ'))}`
    );

    return parseBlockFromVisualSheetData(blockName, this.normalizeValues(visualResponse.values));
  }

  private validateUpdate(update: CellUpdateInput): CellUpdateInput {
    if (update.field !== 'actualLoad' && update.field !== 'rpe') {
      throw new Error(`Invalid field requested for update: ${update.field}`);
    }

    if (update.field === 'actualLoad') {
      const numericValue = Number.parseFloat(String(update.newValue).replace(/,/g, ''));
      if (Number.isNaN(numericValue) || numericValue < 0 || numericValue > 2000) {
        throw new Error(`Invalid actualLoad value: ${update.newValue} for cell ${update.cellA1}`);
      }
      return {
        ...update,
        newValue: numericValue
      };
    }

    const match = String(update.newValue).trim().match(/(\d+(?:\.\d+)?)/);
    return {
      ...update,
      newValue: match ? `@ ${match[1]}` : String(update.newValue)
    };
  }

  private async loadDashboardDataFromGoogle(
    user: UserContext,
    blockName: string,
    accessToken: string,
    opts?: { forceRefresh?: boolean }
  ): Promise<DashboardPayload> {
    const [blockData, basics, config, overallProgress] = await Promise.all([
      this.getBlockDataFromGoogle(user, blockName, accessToken, opts),
      this.loadBasics(user, accessToken, opts?.forceRefresh),
      this.loadConfig(user, accessToken, opts?.forceRefresh),
      this.getOverallPrimaryProgressFromGoogle(user, accessToken, opts)
    ]);

    return {
      blockData,
      basics,
      config,
      overallProgress,
      stats: computeAllStats(blockData, basics, config)
    };
  }

  private async getBlockDataFromGoogle(
    user: UserContext,
    blockIdOrName: string,
    accessToken: string,
    opts?: { forceRefresh?: boolean }
  ): Promise<BlockData> {
    const blocks = await this.getAvailableBlocksFromGoogle(user, accessToken, opts?.forceRefresh);
    const block = blocks.find(
      (candidate) => candidate.name === blockIdOrName || candidate.sheetId === String(blockIdOrName)
    );
    if (!block) {
      throw new Error(`Sheet not found: ${blockIdOrName}`);
    }

    const key = this.cacheKey(user, `block:${block.name}`);
    if (!opts?.forceRefresh) {
      const cached = this.cache.get<BlockData>(key);
      if (cached) {
        return cached;
      }
    }

    const parsed = await this.parseBlockFromGoogle(user, accessToken, block.name);
    this.cache.set(key, parsed, this.ttl.blockData);
    return parsed;
  }

  private async getOverallPrimaryProgressFromGoogle(
    user: UserContext,
    accessToken: string,
    opts?: { forceRefresh?: boolean }
  ): Promise<OverallPrimaryProgress> {
    const key = this.cacheKey(user, 'overall');
    if (!opts?.forceRefresh) {
      const cached = this.cache.get<OverallPrimaryProgress>(key);
      if (cached) {
        return cached;
      }
    }

    const blocks = await this.getAvailableBlocksFromGoogle(user, accessToken, opts?.forceRefresh);
    const result = await computeOverallPrimaryProgress(blocks, async (blockName, forceRefresh) =>
      this.getBlockDataFromGoogle(user, blockName, accessToken, { forceRefresh })
    );

    this.cache.set(key, result, this.ttl.overall);
    return result;
  }

  private async withGoogle<T>(
    user: UserContext,
    run: (accessToken: string) => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    const accessToken = await this.resolveAccessToken(user);
    if (!accessToken) {
      return fallback();
    }
    return run(accessToken);
  }

  async getInitialPayload(user: UserContext): Promise<InitialPayload> {
    return this.withGoogle(
      user,
      async (accessToken) => {
        const [blocks, basics, config] = await Promise.all([
          this.getAvailableBlocksFromGoogle(user, accessToken),
          this.loadBasics(user, accessToken),
          this.loadConfig(user, accessToken)
        ]);

        return {
          blocks,
          basics,
          config
        };
      },
      () => this.getFallbackStore().getInitialPayload(user)
    );
  }

  async getAvailableBlocks(
    user: UserContext,
    opts: { forceRefresh?: boolean } = {}
  ): Promise<BlockDescriptor[]> {
    return this.withGoogle(
      user,
      (accessToken) => this.getAvailableBlocksFromGoogle(user, accessToken, opts.forceRefresh),
      () => this.getFallbackStore().getAvailableBlocks(user, opts)
    );
  }

  async getBlockData(
    user: UserContext,
    blockIdOrName: string,
    opts?: { forceRefresh?: boolean }
  ): Promise<BlockData> {
    return this.withGoogle(
      user,
      (accessToken) => this.getBlockDataFromGoogle(user, blockIdOrName, accessToken, opts),
      () => this.getFallbackStore().getBlockData(user, blockIdOrName, opts)
    );
  }

  async getOverallPrimaryProgress(
    user: UserContext,
    opts?: { forceRefresh?: boolean }
  ): Promise<OverallPrimaryProgress> {
    return this.withGoogle(
      user,
      (accessToken) => this.getOverallPrimaryProgressFromGoogle(user, accessToken, opts),
      () => this.getFallbackStore().getOverallPrimaryProgress(user, opts)
    );
  }

  async updateBlockCells(
    user: UserContext,
    blockIdOrName: string,
    updates: CellUpdateInput[],
    forceOverwrite?: boolean
  ): Promise<UpdateResult> {
    return this.withGoogle(
      user,
      async (accessToken) => {
        const blocks = await this.getAvailableBlocksFromGoogle(user, accessToken);
        const block = blocks.find(
          (candidate) => candidate.name === blockIdOrName || candidate.sheetId === String(blockIdOrName)
        );
        if (!block) {
          throw new Error(`Sheet not found: ${blockIdOrName}`);
        }

        const config = await this.loadConfig(user, accessToken);
        if (config.disableWrites) {
          throw new Error('Writes are disabled by Config.');
        }

        const validatedUpdates = updates.map((update) => this.validateUpdate(update));

        const ranges = validatedUpdates
          .map((update) => `ranges=${encodeURIComponent(this.toA1Range(block.name, update.cellA1))}`)
          .join('&');

        const conflictChecks = await this.googleJson<SheetsValuesBatchGetResponse>(
          accessToken,
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
            user.spreadsheetId
          )}/values:batchGet?${ranges}`
        );

        const conflicts: Array<{
          cellA1: string;
          serverValue: string;
          requestedOriginal: string | number | null;
        }> = [];

        validatedUpdates.forEach((update, index) => {
          const serverValue = String(conflictChecks.valueRanges?.[index]?.values?.[0]?.[0] ?? '');
          if (!forceOverwrite && serverValue !== String(update.originalValue || '')) {
            conflicts.push({
              cellA1: update.cellA1,
              serverValue,
              requestedOriginal: update.originalValue
            });
          }
        });

        if (conflicts.length > 0) {
          return {
            status: 'conflict',
            conflicts,
            message: 'Some cells have changed on the sheet since you loaded the block.'
          };
        }

        await this.googleJson<unknown>(
          accessToken,
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
            user.spreadsheetId
          )}/values:batchUpdate`,
          {
            method: 'POST',
            body: JSON.stringify({
              valueInputOption: 'USER_ENTERED',
              data: validatedUpdates.map((update) => ({
                range: this.toA1Range(block.name, update.cellA1),
                values: [[update.newValue]]
              }))
            })
          }
        );

        this.cache.delete(this.cacheKey(user, `block:${block.name}`));
        this.cache.delete(this.cacheKey(user, `block:${blockIdOrName}`));
        this.cache.delete(this.cacheKey(user, 'overall'));

        const updatedPayload = await this.loadDashboardDataFromGoogle(user, block.name, accessToken, {
          forceRefresh: true
        });

        return {
          status: 'ok',
          updatedRows: updatedPayload.blockData.rows,
          stats: updatedPayload.stats,
          parserReport: updatedPayload.blockData.parserReport
        };
      },
      () => this.getFallbackStore().updateBlockCells(user, blockIdOrName, updates, forceOverwrite)
    );
  }
}
