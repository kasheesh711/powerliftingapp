# Demo Runbook (Excel MVP)

Date: 2026-02-25

## Goal
Deliver a stable 5-7 minute product demo to potential users using the Excel-backed runtime path.

## Preconditions
- Deployment URL is reachable.
- `DATA_BACKEND=excel`.
- `ALLOW_LOCAL_DEV_AUTH_BYPASS=false` in deployed environment.
- Workbook path configured and readable in runtime environment.
- All quality gates pass on the selected commit.

## Demo Script (Suggested)
1. Context: explain problem and outcome target (faster, reliable training dashboard updates).
2. Open `/dashboard` and confirm selected block loads.
3. Switch to another block and show stats/table update.
4. Edit one `actualLoad` and one `rpe` row value.
5. Save one row and show `Clean` status.
6. Edit two rows and run `Save All`.
7. Force refresh and confirm values persist.
8. Show conflict modal behavior narrative:
   - `Reload Data` for safe reconcile.
   - `Overwrite Anyway` for intentional override.
9. Close with recap of parity-first migration path.

## Day-of Demo Command Gate
Run from repo root:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## Smoke Checklist (Deployed URL)
1. `GET /api/dashboard/initial` returns `200`.
2. `GET /api/dashboard/blocks` returns `200`.
3. `GET /api/dashboard/block/{blockName}` returns `200`.
4. `POST /api/dashboard/block/{blockName}/updates` succeeds for `actualLoad` and `rpe`.

## Contingency Plan
### Backup data flow
- Keep one alternate known-good block preselected for fallback.
- Keep a backup spreadsheet ID ready for manual selection.

### Backup runtime
- Keep latest successful preview deployment URL in notes.
- Keep previous release URL in notes for immediate rollback demo fallback.

### Narrative fallback
- If save conflict appears unexpectedly:
  1. explain collaborative safety behavior,
  2. use `Reload Data`,
  3. re-run save sequence.

## Final Recording Fields
- Demo date:
- Demo URL:
- Release commit:
- Presenter:
- Observers:
- Key feedback summary:

