# Current State (Legacy + Migration Baseline)

Date: 2026-02-24

## Scope
This document captures the current behavior of the legacy Google Apps Script dashboard and the current migration baseline in this repository.

## Step 1: High-level tree
```text
Powerlifting App/
├── app/
│   ├── appsscript.json
│   ├── html/
│   │   ├── index.html
│   │   ├── dashboard.html
│   │   ├── dashboard_css.html
│   │   └── dashboard_js.html
│   └── src/
│       ├── Code.gs
│       ├── Config.gs
│       ├── SheetsParser.gs
│       ├── ShadowDB.gs
│       ├── Stats.gs
│       ├── Tests.gs
│       └── Utils.gs
├── apps/web/
├── packages/{domain,data,ui,config}/
├── docs/
├── .github/
└── Kev Ultimate Comeback.xlsx
```

## Entrypoints and rendering path
- Web entrypoint is `doGet`, rendering `html/index.html`: `app/src/Code.gs:L3-L9`.
- HTML shell inlines three partials: `app/html/index.html:L9-L16`.
- Frontend bootstrap uses one initial Apps Script call (`apiGetInitialPayload`): `app/html/dashboard_js.html:L101-L116`.
- Frontend block load uses `apiLoadDashboardData`: `app/html/dashboard_js.html:L131-L177`.
- Frontend writes use `updateBlockCells`: `app/html/dashboard_js.html:L814-L861`.
- Spreadsheet UI menu/trigger entrypoint is `onOpen` for DB sync ops: `app/src/ShadowDB.gs:L241-L248`.

## Server API surface (legacy)
- `apiGetInitialPayload`: `app/src/Code.gs:L20-L41`
- `apiGetAvailableBlocks`: `app/src/Code.gs:L71-L73`
- `apiLoadDashboardData`: `app/src/Code.gs:L75-L77`
- `apiGetConfig`: `app/src/Code.gs:L79-L81`
- `apiSetConfig`: `app/src/Code.gs:L83-L85`
- `updateBlockCells`: `app/src/Code.gs:L87-L176`

## Data access and parsing patterns
- Source spreadsheet resolution: script property `SOURCE_SPREADSHEET_ID`, fallback to active spreadsheet: `app/src/Utils.gs:L16-L56`.
- Block list discovery ignores `_DB_` sheets and classifies block/recap names: `app/src/SheetsParser.gs:L702-L755`.
- Parser primary path is visual wide-sheet parsing with day/week detection: `app/src/SheetsParser.gs:L761-L860`.
- Parser supports day-marker detection and repeated-header fallback: `app/src/SheetsParser.gs:L341-L457`, `app/src/SheetsParser.gs:L796-L805`.
- DB snapshot read path exists and flags stale/invalid parse quality: `app/src/SheetsParser.gs:L564-L683`, `app/src/SheetsParser.gs:L525-L562`.

## KPI/stat computation location
- Aggregate block stats (totals, score metrics, growth, primary progress): `app/src/Stats.gs:L308-L388`.
- Cross-block primary progress timeline and summary: `app/src/Stats.gs:L243-L306`.

## Legacy write semantics
- Write allowlist is strictly `actualLoad` and `rpe`: `app/src/Code.gs:L106-L109`.
- Conflict detection compares server value vs client original and returns `status: "conflict"`: `app/src/Code.gs:L114-L129`.
- RPE normalization and actual load numeric validation are enforced server-side: `app/src/Code.gs:L135-L145`.
- Cache invalidation after writes for block and overall progress: `app/src/Code.gs:L160-L163`.
- Change logging writes to `ChangeLog` sheet: `app/src/Code.gs:L149-L157`, `app/src/Utils.gs:L165-L189`.

## Feature inventory (legacy parity scope)
- Block selector and force refresh.
- KPI cards for current/projected totals and growth.
- Recap panel (`squat`, `bench`, `deadlift`, `accessory`, additions, coach notes).
- Score chart values (DOTS/Wilks/GL from computed stats).
- Primary-progress timeline across blocks/weeks.
- Editable table cells (`actualLoad`, `rpe`) with save-all/save-single.
- Conflict modal with overwrite/reload flows.

Evidence: UI call flow and conflict modal are in `app/html/dashboard_js.html:L131-L177` and `app/html/dashboard_js.html:L863-L906`.

## Workbook proxy observations (`Kev Ultimate Comeback.xlsx`)
- 24 worksheets detected locally.
- `_DB_Blocks` header is 13 columns (`BlockName..Notes`) and lacks week/day metadata columns expected by newer parser branch.
- `_DB_Metadata` includes `RecapsJSON`, `PeakE1RMsJSON`, `ParserReportJSON`, `SyncedAtISO`.
- Block template sheets use repeated wide headers containing `LABEL/EXERCISE/SETS/REPS/TARGET LOAD/ACTUAL LOAD/RPE/E1RM` across week groups.

## NOT FOUND
- `doPost` entrypoint: NOT FOUND.
  - Searched: `rg -n "doPost" app/src app/html`
- Legacy docs folder in Apps Script code (`app/docs`): NOT FOUND.
  - Searched: `find app -maxdepth 3 -type d -name docs`
- Legacy explicit export/report endpoint for dashboard data: NOT FOUND.
  - Searched keywords: `export`, `download`, `csv`, `pdf` in `app/src` and `app/html`.

## Current migration baseline in repo
- Monorepo with Next.js/App Router and package split exists.
- API routes implement frozen dashboard/select/picker-token (and picker-config) paths.
- ExcelStore parity path is functional.
- Token vault encryption + refresh-token merge logic exists.
- GoogleSheetsStore now supports live Sheets API reads/writes behind the active datastore export path, with strict/non-strict fallback modes in local parity workflows: `packages/data/src/stores/google-sheets-store.ts`.
