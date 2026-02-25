# ADR 0001: Dual Datastore Abstraction and OAuth Token Vault

- Status: Accepted
- Date: 2026-02-24

## Context
The legacy dashboard is Google Apps Script bound to a spreadsheet and not suitable for multi-agent team development. The migration requires:
- local/offline development without live Google access,
- production Google Sheets read/write with per-user OAuth,
- contract and UI parity with legacy behavior.

Legacy evidence:
- Apps Script entrypoint + RPC calls: `app/src/Code.gs:L3-L9`, `app/html/dashboard_js.html:L105-L177`, `app/html/dashboard_js.html:L829-L861`.
- Write conflict contract and allowlist: `app/src/Code.gs:L106-L129`.

## Decision
1. Freeze a domain-level `IDataStore` as the only dependency surface for app/domain logic.
2. Implement two datastore backends behind that interface:
   - `ExcelStore` for local parity development and tests.
   - `GoogleSheetsStore` for production per-user OAuth Google Sheets.
3. Persist OAuth credentials/tokens server-side only in Postgres and encrypt at rest with AES-256-GCM.
4. Preserve refresh tokens when refresh responses omit `refresh_token`.

Contract evidence:
- `packages/domain/src/datastore.ts:L15-L29`
- `packages/domain/openapi.yaml:L7-L104`

Security evidence:
- Encryption/merge helper: `packages/data/src/token-vault.ts:L18-L74`
- Vault persistence/refresh logic: `apps/web/src/lib/token-vault-repo.ts:L57-L169`

## Consequences
### Positive
- UI/domain remain backend-agnostic.
- Offline dev/test can progress without Google dependencies.
- Production can satisfy per-user OAuth requirements without service-account coupling.
- Contract stability supports parallel lane execution.

### Negative
- Two adapter implementations increase maintenance cost.
- Parity harness and fixtures are required to avoid drift.
- Temporary risk exists when one backend is scaffolded while the other is incomplete.

## Current implementation state
- `ExcelStore` is active and functional in main path.
- Token vault encryption and refresh-token preservation are implemented.
- `GoogleSheetsStore` in active export path is live and OAuth-backed; remaining work is production hardening and parity evidence.

## Alternatives considered
1. Direct Google Sheets-only integration from Day 1.
   - Rejected due to offline dev constraints and slower feedback loops.
2. Service account model.
   - Rejected because requirement mandates per-user OAuth.
3. No abstraction (UI calls backend-specific modules directly).
   - Rejected due to high coupling and poor multi-agent parallelization.

## Follow-up actions
1. Complete live GoogleSheets adapter behind existing `IDataStore` signatures.
2. Add parity job that compares Excel vs Google outputs for frozen golden blocks.
3. Remove duplicate/unused data implementation tracks once live adapter is merged into the active export path.
