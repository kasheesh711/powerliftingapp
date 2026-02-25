export const BLOCK_NAME_RE = /\bblock\s*(\d+)(?:\s*(?:\(|year)?\s*\d{4}?\)?)?/i;
export const BLOCK_RECAP_RE = /\brecap\b/i;

export const DB_BLOCKS_SHEET_NAME = '_DB_Blocks';
export const DB_METADATA_SHEET_NAME = '_DB_Metadata';

export const BLOCKS_CACHE_TTL_MS = 5 * 60 * 1000;
export const BLOCK_DATA_CACHE_TTL_MS = 5 * 60 * 1000;
export const BASICS_CACHE_TTL_MS = 10 * 60 * 1000;
export const CONFIG_CACHE_TTL_MS = 10 * 60 * 1000;
export const OVERALL_PROGRESS_TTL_MS = 5 * 60 * 1000;

export const DB_METADATA_STALE_MS = 12 * 60 * 60 * 1000;
