# Migration Plan (Parallel Acceleration)

Date: 2026-02-24

## Objective
Compress calendar time by running independent lanes in parallel while preserving parity and contract stability.

## Critical path
1. Contract freeze and DTO lock.
2. Parser/stats parity on golden fixtures.
3. ExcelStore write/conflict parity.
4. OAuth token vault + sheet selection flow.
5. GoogleSheetsStore true adapter implementation.
6. Cross-store parity harness green.

## Lane model
| Lane | Owner | Start | Depends On | Scope | Done Gate |
|---|---|---|---|---|---|
| Lane 0 Program/Control | Migration owner | Day 0 | None | Freeze policy, board, signoff governance, cutover criteria | Freeze enforced + signoff checklist active |
| Lane 1 Foundation | Platform | Day 0 | None | Workspaces/turbo, Next shell, package skeletons, Postgres/Prisma baseline | App boots + DB up + quality commands wired |
| Lane 2 Contract Spine | Backend | Day 1 | Lane 1 | `IDataStore`, DTOs, OpenAPI, Zod validators, route contract tests | Contract package and typed routes merged |
| Lane 3 Domain Port | Domain | Day 1 | Lane 2 types | Parser/stats/config logic in TS + fixture parity | Golden parity tests pass |
| Lane 4 ExcelStore + Writes | Data | Day 2 | Lanes 2-3 | Workbook mapping, override layer, conflicts, changelog | E2E Excel read/write parity |
| Lane 5 Auth/OAuth/Picker | Auth | Day 1 | Lane 1 | Auth.js, token vault, refresh handling, sheet URL/picker token routes | Sign-in + encrypted token persistence + refresh tests |
| Lane 6 UI Parity | Frontend | Day 1 | Lane 2 | App Router dashboard parity first on mock then real API | UI parity checklist passes |
| Lane 7 Parity Harness + QA | QA/Infra | Day 0 | None | Golden fixture capture, parity comparator, tolerance rules, Playwright skeleton | Automated parity diffs in CI |

## Integration cadence
- Merge windows: 1:00 PM and 5:00 PM local.
- Outside merge windows: emergency fixes only.
- Contract-first rule: Lane 2 merges before dependent lane merges.
- Ownership boundaries are strict by package.
- Every lane PR must include one artifact:
  - contract diff, parity diff, or test evidence.

## Governance controls
- Legacy feature freeze active; only P0 fixes allowed and logged (`docs/migration-drift.md`).
- Daily signoff checkpoints (midday/end-of-day) tracked in `docs/signoff-checklist.md`.
- Contract change requires explicit migration note + owner approval.

## 10-business-day schedule
- Days 0-1: Lanes 0, 1, 7 start; lanes 2 and 5 start after scaffold ready.
- Days 2-4: Lanes 3, 4, 6 in parallel on frozen contracts.
- Day 5: Gate A (Excel read parity + UI render parity).
- Days 6-7: Write-path parity + conflict semantics + token vault hardening.
- Days 8-9: GoogleSheetsStore live adapter + cross-store parity.
- Day 10: RC hardening, docs lock, cutover checklist.

## Current status (repo)
- Lane 1 baseline: complete (workspace, app shell, docker, Prisma, CI).
- Lane 2 baseline: complete for contract definitions/routes.
- Lane 4 baseline: complete for Excel parity and conflict semantics.
- Lane 5 baseline: partial (token vault + refresh exists, Drive picker full UX pending).
- Lane 7 baseline: complete for golden fixture export + parity CLI execution.
- GoogleSheetsStore live adapter: implemented in active export path; remaining work is live parity hardening and picker UX integration.

## Acceptance gates
### Gate A (Day 5)
- Excel-backed API returns full dashboard payload.
- UI can render and switch blocks from Excel data.
- Conflict modal behavior parity verified.

### Gate B (Day 9)
- Google backend enabled per-user OAuth tokens.
- Excel vs Google parity harness passes on target blocks.
- No contract drift.

### Gate C (Day 10 RC)
- CI green: lint, typecheck, test, build, parity.
- Security checklist completed (token encryption, refresh retention, no token logging).
- Migration runbook and ADRs finalized.

## Risks and mitigations
- Risk: contract drift under parallel PR load.
  - Mitigation: merge window enforcement + contract-owner approval.
- Risk: stale `_DB_Blocks` schema mismatch causing parser drift.
  - Mitigation: visual parse fallback + golden fixtures + parity tests.
- Risk: OAuth refresh edge cases and token loss.
  - Mitigation: refresh-token merge preservation tests and encrypted vault persistence.

## NOT FOUND
- Automated merge-window enforcement script in repo: NOT FOUND.
  - Searched: `.github/workflows`, `scripts/`, keywords `merge window`, `integration branch`.

## ASSUMPTION
- Team executes merge windows and lane boundaries operationally (manual process) until automation is introduced.
