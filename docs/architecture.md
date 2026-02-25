# Architecture

Date: 2026-02-24

## Repository structure (multi-agent ready)
- `apps/web`: Next.js App Router app, API routes, Auth.js wiring, Prisma schema.
- `packages/domain`: domain types, `IDataStore`, validators, scoring/aggregation logic, OpenAPI.
- `packages/data`: datastore adapters, parser/data access helpers, cache, token crypto helpers, parity harness.
- `packages/ui`: shared React components.
- `packages/config`: shared TS/ESLint/Prettier/Vitest/Playwright config.
- `docs`: specs, ADRs, migration governance artifacts.
- `.github`: CI, templates, CODEOWNERS.

## Contract spine (frozen)
Primary interface is frozen in `packages/domain/src/datastore.ts:L15-L29`:
- `getInitialPayload(userContext)`
- `getAvailableBlocks(userContext, opts)`
- `getBlockData(userContext, blockIdOrName, opts)`
- `getOverallPrimaryProgress(userContext, opts)`
- `updateBlockCells(userContext, blockIdOrName, updates, forceOverwrite)`

HTTP contract is declared in `packages/domain/openapi.yaml:L7-L104` and implemented by:
- `GET /api/dashboard/initial`
- `GET /api/dashboard/blocks`
- `GET /api/dashboard/block/{blockName}`
- `POST /api/dashboard/block/{blockName}/updates`
- `POST /api/spreadsheets/select`
- `GET /api/spreadsheets/select`
- `GET /api/spreadsheets/picker-token`
- `GET /api/spreadsheets/picker-config`

## Runtime flow
1. API route resolves user context (`apps/web/src/lib/user-context.ts`).
2. Route resolves datastore backend (`apps/web/src/lib/datastore.ts:L16-L35`).
3. Store implementation returns domain DTOs.
4. UI renders DTO payload and posts updates back through the update endpoint.

## Data backend abstraction
### Excel backend (working baseline)
- `ExcelStore` currently provides read/write parity against local workbook.
- Uses `_DB_*` snapshot read when valid and visual parse fallback when stale/insufficient.
- Enforces write allowlist and conflict payload parity.
- Caches by user+sheet+resource key with TTL constants.

Evidence: `packages/data/src/stores/excel-store.ts:L113-L366`.

### Google backend (current state)
- `GoogleSheetsStore` in active export path uses per-user OAuth access tokens and Google Sheets API read/write operations.
- In strict mode it fails when OAuth token access is unavailable; in non-strict mode it can fall back to ExcelStore for local parity workflows.

Evidence: `packages/data/src/stores/google-sheets-store.ts`.

## Auth and token security
### Implemented controls
- Google OAuth scopes include `spreadsheets` and `drive.file`; offline access is requested via `access_type=offline` + `prompt=consent`: `apps/web/src/auth.ts:L12-L18`.
- OAuth payload is encrypted at rest with AES-256-GCM before persistence (`TOKEN_ENCRYPTION_KEY_BASE64`): `packages/data/src/token-vault.ts:L18-L44` and usage in `apps/web/src/lib/token-vault-repo.ts:L64-L84`.
- Refresh-token non-overwrite rule is enforced by `mergeRefreshToken`: `packages/data/src/token-vault.ts:L62-L74` and applied in save flow: `apps/web/src/lib/token-vault-repo.ts:L61-L63`.
- Access-token refresh path exists and persists refreshed payload: `apps/web/src/lib/token-vault-repo.ts:L97-L169`.

### Persistence
- Spreadsheet selection persistence model: `UserSpreadsheetSelection` (`apps/web/prisma/schema.prisma:L10-L17`).
- Token vault persistence model: `OAuthTokenVault` (`apps/web/prisma/schema.prisma:L19-L28`).

## Performance and caching
- Legacy Apps Script uses chunked cache + in-memory memo (`app/src/Utils.gs:L80-L160`).
- Migration Excel store uses explicit TTL caches:
  - blocks/config/basics/block/overall progress keyed by user+spreadsheet context.
- Write path invalidates block + overall progress keys (`packages/data/src/stores/excel-store.ts:L352-L353`).

## Delivery governance (parallel lanes)
- CODEOWNERS establishes package ownership boundaries (`.github/CODEOWNERS:L1-L19`).
- CI runs lint/typecheck/test/build/parity with Postgres and Prisma setup (`.github/workflows/ci.yml:L10-L55`).
- Freeze and signoff artifacts exist in `docs/migration-drift.md` and `docs/signoff-checklist.md`.

## Gaps to production target
1. Cross-store parity evidence should be collected against live Google sheets in CI or gated environments.
2. Runtime smoke coverage should continue expanding across auth and write-path scenarios.

## Decision summary
- Keep contract/UI stable on `IDataStore` and route contracts.
- Use ExcelStore as deterministic parity baseline in development and tests.
- Complete Google backend as a swappable adapter behind the same interface without changing UI/domain contracts.
