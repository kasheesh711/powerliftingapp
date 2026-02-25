# Demo Runbook (Excel MVP Path)

Date: 2026-02-25

## Goal
Run a consistent 5-7 minute demo for potential users showing the core flow:
load block -> edit values -> save -> handle conflicts -> confirm persisted state.

## Preconditions
- Deployment URL is reachable.
- `DATA_BACKEND=excel`.
- Demo workbook state is frozen for the session.
- Quality gates pass on the selected release commit.

## Pre-Demo Gate Commands
Run from repo root:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## Demo Script
1. Open dashboard.
2. Show block load and block switch.
3. Edit one `actualLoad` and one `rpe` value.
4. Save row and confirm status returns to `Clean`.
5. Edit two cells and use `Save All`.
6. Trigger or explain conflict handling (`Reload Data` vs `Overwrite Anyway`).
7. Force refresh and confirm values persist.
8. Close with value summary and next-step roadmap.

## Smoke Checks (Deployed URL)
Use your deployment URL:

```bash
BASE_URL="https://<your-url>"
curl -sf "$BASE_URL/api/dashboard/initial" >/dev/null
curl -sf "$BASE_URL/api/dashboard/blocks" >/dev/null
curl -sf "$BASE_URL/api/dashboard/block/Block%205" >/dev/null
```

## Contingency Plan
- Keep a backup block ready for walkthrough.
- Keep previous known-good deployment URL available.
- If a conflict appears unexpectedly:
  1. Explain collaborative safety behavior.
  2. Use `Reload Data`.
  3. Re-run save step.

## Session Record
- Date:
- Deployment URL:
- Release commit:
- Presenter:
- Observers:
- Outcome:

