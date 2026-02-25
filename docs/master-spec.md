# Master Spec (Implementation Ready)

Date: 2026-02-24

## 1) Hard requirements
1. Next.js App Router + React + TypeScript.
2. Auth.js with Google provider, offline access.
3. Postgres + Prisma for per-user spreadsheet selection and OAuth token vault persistence.
4. Server-side-only Google Sheets integration for production.
5. Local/offline development against `Kev Ultimate Comeback.xlsx`.
6. `IDataStore` abstraction is mandatory; UI/domain must not depend on backend specifics.
7. Update allowlist is restricted to `actualLoad` and `rpe`.

## 2) Frozen contracts
### `IDataStore`
```ts
interface IDataStore {
  getInitialPayload(userContext): Promise<InitialPayload>
  getAvailableBlocks(userContext, opts?): Promise<BlockDescriptor[]>
  getBlockData(userContext, blockIdOrName, opts?): Promise<BlockData>
  getOverallPrimaryProgress(userContext, opts?): Promise<OverallPrimaryProgress>
  updateBlockCells(userContext, blockIdOrName, updates, forceOverwrite?): Promise<UpdateResult>
}
```
Canonical source: `packages/domain/src/datastore.ts:L15-L29`.

### HTTP endpoints
- `GET /api/dashboard/initial`
- `GET /api/dashboard/blocks`
- `GET /api/dashboard/block/{blockName}`
- `POST /api/dashboard/block/{blockName}/updates`
- `POST /api/spreadsheets/select`
- `GET /api/spreadsheets/select`
- `GET /api/spreadsheets/picker-token`
- `GET /api/spreadsheets/picker-config`

Canonical source: `packages/domain/openapi.yaml:L7-L104`.

### DTO invariants
- Row shape keeps exercise/set/rep/target/actual/rpe/e1rm + week/day metadata + cell refs.
- Conflict payload shape remains:
```json
{ "status": "conflict", "conflicts": [...], "message": "..." }
```
- Update fields allowed: `actualLoad`, `rpe` only (`packages/domain/src/contracts.ts:L3-L13`).

## 3) Security spec
1. Refresh tokens never exposed to browser; browser receives access token only for picker flow.
2. Encrypt OAuth payload at rest (AES-256-GCM) with `TOKEN_ENCRYPTION_KEY_BASE64`.
3. Never overwrite non-empty refresh token with null/empty refresh token.
4. Auto-refresh access token before/at expiry.
5. Never log raw tokens.

Implemented evidence:
- Encryption/merge helpers: `packages/data/src/token-vault.ts:L18-L74`.
- Vault persistence + refresh flow: `apps/web/src/lib/token-vault-repo.ts:L57-L169`.
- OAuth scope/offline params: `apps/web/src/auth.ts:L12-L18`.

## 4) Data backend spec
### ExcelStore (required now)
- Source: local workbook file.
- Prefer `_DB_*` snapshot when valid; fallback to visual parse when stale/invalid.
- Write path supports conflict checks and override persistence.
- Invalidate block + overall-progress caches after write.

Evidence: `packages/data/src/stores/excel-store.ts:L195-L366`.

### GoogleSheetsStore (required for production)
- Must use per-user OAuth token from vault.
- Must use batch read/write operations.
- Must preserve same DTOs and conflict semantics as ExcelStore.

Current status:
- Active exported implementation is a live OAuth-backed adapter (`packages/data/src/stores/google-sheets-store.ts`).
- In non-strict mode, the adapter can fall back to ExcelStore for local parity workflows.

## 5) Persistence spec (Prisma)
Current schema:
- `UserSpreadsheetSelection` (`apps/web/prisma/schema.prisma:L10-L17`)
- `OAuthTokenVault` (`apps/web/prisma/schema.prisma:L19-L28`)

Required behavior:
- One selected spreadsheet per user context.
- One encrypted token vault record per user+provider.

## 6) Environment variables
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TOKEN_ENCRYPTION_KEY_BASE64`
- `SOURCE_SPREADSHEET_ID` (optional default)
- `WORKBOOK_PATH` / `EXCEL_PROXY_PATH` (local proxy path)
- `DATA_BACKEND` (`excel` or `google`)
- `ALLOW_LOCAL_DEV_AUTH_BYPASS` (non-production local fallback guard, defaults true outside production)
- `GOOGLE_PICKER_API_KEY`
- `GOOGLE_PICKER_APP_ID`
- `PARITY_REQUIRED` (fails parity command when Google parity inputs are missing)

## 7) Performance spec
- Cache key dimensions: user + spreadsheet + resource + filter hash.
- TTL defaults:
  - blocks: 5m
  - block data: 5m
  - basics/config: 10m
  - overall progress: 5m
- Invalidation on writes must include block payload and overall progress.

## 8) Test spec
### Unit tests
- Parser day/week detection and fallback behavior.
- Stats correctness (total + score + growth + primary timeline).
- Update validation and conflict contract.
- Token crypto + refresh-token preservation.

### Integration tests
- ExcelStore end-to-end read/write + invalidation.
- API contract validation via Zod schemas.
- Authenticated user context + selected spreadsheet guardrails.

### Parity tests
- Compare at least: `Block 2`, `Block 3`, `Block 4 (2026)`, `Block 5`, `Block 3 (Data)`.
- Integer fields exact match; float fields tolerance `1e-6`.
- Parity command should produce CI artifact-ready pass/fail output.

### E2E tests
- Sign-in, sheet selection, dashboard load.
- Edit/save and conflict modal behavior.
- Block switching and force refresh.

## 9) CI spec
Pipeline must run:
1. `npm ci`
2. `npm run prisma:generate --workspace @powerlifting/web`
3. `npm run prisma:push --workspace @powerlifting/web`
4. `npm run lint`
5. `npm run typecheck`
6. `npm run test`
7. `npm run build`
8. `npm run parity --workspace @powerlifting/data`

Canonical workflow file: `.github/workflows/ci.yml:L10-L55`.

## 10) Parallel execution policy
- Merge windows at 1:00 PM and 5:00 PM local.
- Contract changes are blocked unless lane owner approves.
- Ownership by package is enforced via CODEOWNERS.
- Every PR includes contract diff, parity diff, or test proof.

## 11) Current implementation deltas
1. Google live backend is active in exported datastore path; remaining work is production-hardening and parity evidence against real sheets.
2. Picker-token route exists, but full Drive Picker UI flow is not fully integrated.
3. Runtime smoke checks and e2e coverage should continue expanding to prevent regressions in API bootstrap paths.

## 12) Definition of done (v1 parity cutover)
- All CI gates green.
- Excel parity validated for target blocks.
- Google live backend passes same contract tests and parity harness.
- Security checklist complete (token encryption, refresh retention, no token leakage).
- Migration docs + ADRs locked.
