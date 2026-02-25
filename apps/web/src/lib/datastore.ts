import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { IDataStore } from '@powerlifting/domain';
import { ExcelStore, GoogleSheetsStore } from '@powerlifting/data';
import { getValidGoogleAccessToken } from './token-vault-repo';

let store: IDataStore | null = null;
let resolvedWorkbookPath: string | null = null;

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const DEFAULT_WORKBOOK_FILE = 'Kev Ultimate Comeback.xlsx';

function canRead(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveExplicitPath(inputPath: string, baseDir: string): string {
  if (path.isAbsolute(inputPath)) {
    return path.resolve(inputPath);
  }

  return path.resolve(baseDir, inputPath);
}

function resolveWorkbookPath(): string {
  if (resolvedWorkbookPath) {
    return resolvedWorkbookPath;
  }

  const tried: string[] = [];
  const seen = new Set<string>();

  function probe(candidate: string): string | null {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) {
      return null;
    }
    seen.add(resolved);
    tried.push(resolved);

    if (canRead(resolved)) {
      return resolved;
    }

    return null;
  }

  const envPaths = [process.env.WORKBOOK_PATH, process.env.EXCEL_PROXY_PATH]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter(Boolean);

  const baseDirs = [process.cwd(), REPO_ROOT];

  for (const envPath of envPaths) {
    for (const baseDir of baseDirs) {
      const found = probe(resolveExplicitPath(envPath, baseDir));
      if (found) {
        resolvedWorkbookPath = found;
        return found;
      }
    }
  }

  const fallbackCandidates = [
    path.resolve(process.cwd(), DEFAULT_WORKBOOK_FILE),
    path.resolve(process.cwd(), '..', DEFAULT_WORKBOOK_FILE),
    path.resolve(process.cwd(), '..', '..', DEFAULT_WORKBOOK_FILE),
    path.resolve(process.cwd(), '..', '..', '..', DEFAULT_WORKBOOK_FILE),
    path.resolve(REPO_ROOT, DEFAULT_WORKBOOK_FILE)
  ];

  for (const candidate of fallbackCandidates) {
    const found = probe(candidate);
    if (found) {
      resolvedWorkbookPath = found;
      return found;
    }
  }

  throw new Error(
    `Unable to locate workbook file "${DEFAULT_WORKBOOK_FILE}". Tried:\n- ${tried.join('\n- ')}`
  );
}

export function getDataStore(): IDataStore {
  if (store) {
    return store;
  }

  const backend = (process.env.DATA_BACKEND || 'excel').toLowerCase();

  if (backend === 'google') {
    let fallbackWorkbookPath: string | null = null;
    try {
      fallbackWorkbookPath = resolveWorkbookPath();
    } catch {
      fallbackWorkbookPath = null;
    }

    store = new GoogleSheetsStore({
      fallbackExcelOptions: fallbackWorkbookPath
        ? {
            workbookPath: fallbackWorkbookPath
          }
        : undefined,
      strict: true,
      accessTokenProvider: (userId) => getValidGoogleAccessToken(userId)
    });
    return store;
  }

  if (backend !== 'excel') {
    throw new Error(`Invalid DATA_BACKEND "${backend}". Expected "excel" or "google".`);
  }

  const workbookPath = resolveWorkbookPath();
  store = new ExcelStore({ workbookPath });
  return store;
}
