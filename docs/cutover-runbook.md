# Cutover Runbook (v1 Parity Target)

Date: 2026-02-25

## Purpose
This runbook defines the operational checklist for switching the migration target from Excel-only development posture to parity-ready Google-backed operation.

## Preconditions
- `ci-excel` green on target commit.
- `ci-e2e` green on target commit.
- `ci-google-parity` green with no block mismatches.
- Security checklist complete in [`docs/signoff-checklist.md`](./signoff-checklist.md).
- No active freeze drift entries requiring unresolved rollback actions.

## Promotion Steps
1. Confirm runtime environment variables:
   - `DATA_BACKEND=google`
   - `NEXTAUTH_SECRET` configured
   - `TOKEN_ENCRYPTION_KEY_BASE64` configured
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` configured
   - `GOOGLE_PICKER_API_KEY` / `GOOGLE_PICKER_APP_ID` configured
   - `ALLOW_LOCAL_DEV_AUTH_BYPASS=false`
2. Run database readiness checks:
   - `npm run prisma:generate --workspace @powerlifting/web`
   - `npm run prisma:push --workspace @powerlifting/web`
3. Execute smoke checks against production build:
   - authenticate using credentials/Google session
   - `GET /api/dashboard/initial`
   - `GET /api/dashboard/blocks?forceRefresh=true`
   - `GET /api/dashboard/block/{blockName}`
   - `POST /api/dashboard/block/{blockName}/updates` for `actualLoad`/`rpe`
4. Verify dashboard UX acceptance:
   - spreadsheet selection via Drive Picker
   - spreadsheet selection via manual URL/ID fallback
   - force-refresh behavior
   - save-row and save-all behavior
   - conflict reload and overwrite flows
5. Confirm parity evidence artifacts are retained:
   - `packages/data/parity-report-excel.json`
   - `packages/data/parity-report-google.json`

## Rollback Plan
1. Set `DATA_BACKEND=excel`.
2. Redeploy web app.
3. Re-run smoke checks on Excel path.
4. Record incident and rollback rationale in `docs/migration-drift.md`.

## Exit Criteria
- All checklist items in `docs/signoff-checklist.md` are checked.
- No open parity mismatches for frozen target blocks.
- Cutover and rollback actions validated by lane owners.
