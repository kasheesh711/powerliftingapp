import fs from 'node:fs/promises';
import path from 'node:path';

import { createLocalDevExcelStore } from './stores/excel-store.js';
import { GoogleSheetsStore } from './stores/google-sheets-store.js';
import { runParityComparison } from './parity.js';

interface AccessTokenResult {
  accessToken: string;
  expiryDate: number | null;
}

interface ParityArtifact {
  generatedAtISO: string;
  required: boolean;
  skipped: boolean;
  skipReason?: string;
  spreadsheetId?: string;
  blockNames: string[];
  failureCount: number;
  results: Array<{
    blockName: string;
    matches: boolean;
    mismatchCount: number;
    mismatches: Array<{ path: string; left: unknown; right: unknown }>;
  }>;
}

function parseBooleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }

  return !['0', 'false', 'no', 'off'].includes(raw.toLowerCase());
}

function parseIntegerEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

async function writeArtifact(artifactPath: string, payload: ParityArtifact): Promise<void> {
  const resolved = path.resolve(artifactPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Parity artifact written: ${resolved}`);
}

async function fetchGoogleAccessTokenFromRefreshToken(): Promise<AccessTokenResult | null> {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  if (!refreshToken || !clientId || !clientSecret) {
    return null;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Unable to fetch Google access token from refresh token (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new Error('Refresh token exchange succeeded but did not return access_token.');
  }

  const expiryDate = payload.expires_in ? Date.now() + payload.expires_in * 1000 : null;

  return {
    accessToken: payload.access_token,
    expiryDate
  };
}

async function resolveGoogleAccessToken(): Promise<AccessTokenResult | null> {
  const directToken = process.env.GOOGLE_ACCESS_TOKEN || '';
  if (directToken) {
    const directExpiry = process.env.GOOGLE_ACCESS_TOKEN_EXPIRES_AT
      ? Number.parseInt(process.env.GOOGLE_ACCESS_TOKEN_EXPIRES_AT, 10)
      : null;

    return {
      accessToken: directToken,
      expiryDate: Number.isFinite(directExpiry) ? directExpiry : null
    };
  }

  return fetchGoogleAccessTokenFromRefreshToken();
}

async function main(): Promise<void> {
  const spreadsheetId = process.env.PARITY_SPREADSHEET_ID || process.env.SOURCE_SPREADSHEET_ID || '';
  const parityRequired = parseBooleanEnv('PARITY_REQUIRED', false);
  const artifactPath = process.env.PARITY_ARTIFACT_PATH || 'parity-report.json';
  const maxMismatchSamples = parseIntegerEnv('PARITY_MAX_MISMATCHES', 10);

  const blockNames = process.env.PARITY_BLOCKS
    ? process.env.PARITY_BLOCKS.split(',').map((v) => v.trim()).filter(Boolean)
    : ['Block 2', 'Block 3', 'Block 4 (2026)', 'Block 5', 'Block 3 (Data)'];

  const artifactBase: Omit<ParityArtifact, 'skipped' | 'failureCount' | 'results'> = {
    generatedAtISO: new Date().toISOString(),
    required: parityRequired,
    spreadsheetId: spreadsheetId || undefined,
    blockNames
  };

  const accessTokenResult = await resolveGoogleAccessToken();
  if (!spreadsheetId || !accessTokenResult?.accessToken) {
    const reason =
      'Missing PARITY_SPREADSHEET_ID (or SOURCE_SPREADSHEET_ID) and Google token inputs. ' +
      'Provide GOOGLE_ACCESS_TOKEN, or GOOGLE_REFRESH_TOKEN with GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET.';

    const artifact: ParityArtifact = {
      ...artifactBase,
      skipped: true,
      skipReason: reason,
      failureCount: 0,
      results: []
    };

    await writeArtifact(artifactPath, artifact);

    if (parityRequired) {
      throw new Error(reason);
    }

    console.log('Parity check skipped:', reason);
    return;
  }

  const user = {
    userId: 'parity-cli',
    spreadsheetId
  };

  const excelStore = createLocalDevExcelStore();
  const googleStore = new GoogleSheetsStore({
    fallbackExcelOptions: {
      workbookPath: process.env.WORKBOOK_PATH || '../../Kev Ultimate Comeback.xlsx'
    },
    strict: true,
    accessTokenProvider: async () => accessTokenResult
  });

  const comparison = await runParityComparison({
    excelStore,
    googleStore,
    user,
    blockNames,
    floatTolerance: 1e-6
  });

  const results = comparison.map((result) => ({
    blockName: result.blockName,
    matches: result.matches,
    mismatchCount: result.mismatches.length,
    mismatches: result.mismatches.slice(0, maxMismatchSamples)
  }));

  const failures = results.filter((result) => !result.matches);

  const artifact: ParityArtifact = {
    ...artifactBase,
    skipped: false,
    failureCount: failures.length,
    results
  };

  await writeArtifact(artifactPath, artifact);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`Parity mismatches for ${failure.blockName}: ${failure.mismatchCount}`);
      for (const mismatch of failure.mismatches) {
        console.error(
          `  ${mismatch.path} | left=${JSON.stringify(mismatch.left)} right=${JSON.stringify(mismatch.right)}`
        );
      }
    }

    process.exitCode = 1;
    return;
  }

  console.log(`Parity check passed for ${results.length} blocks.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
