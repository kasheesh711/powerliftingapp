# Data Model

Date: 2026-02-24

## Workbook inventory (proxy dataset)
Worksheet names detected in `Kev Ultimate Comeback.xlsx` (24 total):
- `Warm up`
- `Competition Card`
- `Block 5`
- `_DB_Blocks`
- `_DB_Metadata`
- `Block RECAP`
- `Block 4 (2026)`
- `Calendar  Split  Info  PRs`
- `Growth Stats`
- `Block 3`
- `Block 2`
- `Block 1 (continuation)`
- `Block 1 - Introductory`
- `Protocol`
- `Personal Record`
- `Copy of Chart with RPE Cal`
- `Coach`
- `RPE CHART`
- `Macrocycle Data`
- `Calendar`
- `Gut Cut`
- `Water Loading`
- `Attempt CARD`
- `Block 3 (Data)`

## Header patterns observed
- Block templates repeat wide training headers with fields like `LABEL`, `EXERCISE`, `SETS`, `REPS`, `TARGET LOAD (Kg)`, `ACTUAL LOAD (Kg)`, `Last Set / Actual RPE`, `E1RM`, `Notes`.
- `_DB_Blocks` columns are:
  - `BlockName`, `GroupLabel`, `RowIndex`, `Exercise`, `Sets`, `Reps`, `TargetLoadKg`, `ActualLoadKg`, `ActualLoadCell`, `RPE`, `RPECell`, `E1RM`, `Notes`
- `_DB_Metadata` columns are:
  - `BlockName`, `RecapsJSON`, `PeakE1RMsJSON`, `ParserReportJSON`, `SyncedAtISO`

## Canonical entities (domain)
Source types: `packages/domain/src/types.ts`.

### `UserContext`
- `userId: string`
- `spreadsheetId: string`

### `BlockDescriptor`
- `sheetId?: string`
- `name: string`
- `blockNum: string | null`
- `year: string | null`
- `isRecap: boolean`
- `isBlock: boolean`

### `BlockRow`
- Identity/context: `sheetName`, `groupLabel`, `rowIndex`
- Exercise prescription: `exercise`, `sets`, `reps`, `targetLoadKg`
- Editable actuals: `actualLoadKg`, `actualLoadCell`, `rpe`, `rpeCell`
- Derived metrics: `e1rm`
- Section metadata: `weekIndex`, `dayIndex`, `weekLabel`, `dayLabel`, `dayName`, `dayRowIndex`, `weekSectionId`, `daySectionId`

### `BlockData`
- `rows: BlockRow[]`
- `recaps`
- `peakE1RMs`
- `parserReport`

### `InitialPayload`
- `blocks`, `basics`, `config`

### `UpdateResult`
- `status: "ok"` with `updatedRows`, `stats`, `parserReport`
- or `status: "conflict"` with `conflicts[]`, `message`

## Field mapping

### `_DB_Blocks` -> `BlockRow`
- `BlockName` -> `sheetName`
- `GroupLabel` -> `groupLabel`
- `RowIndex` -> `rowIndex`
- `Exercise` -> `exercise`
- `Sets` -> `sets`
- `Reps` -> `reps`
- `TargetLoadKg` -> `targetLoadKg`
- `ActualLoadKg` -> `actualLoadKg`
- `ActualLoadCell` -> `actualLoadCell`
- `RPE` -> `rpe`
- `RPECell` -> `rpeCell`
- `E1RM` -> `e1rm`
- `Notes` -> `notes`

### `_DB_Metadata` -> `BlockData` metadata
- `RecapsJSON` -> `recaps`
- `PeakE1RMsJSON` -> `peakE1RMs`
- `ParserReportJSON` -> `parserReport`
- `SyncedAtISO` -> staleness/repair decision

## IDs and relationships
- `BlockDescriptor.name` joins to worksheet name and `_DB_Blocks.BlockName`.
- `BlockRow.actualLoadCell` and `BlockRow.rpeCell` are the write-address keys for updates.
- Update workflow uses `(userId, spreadsheetId, blockName, cellA1, field)` as override identity in migration store.

## Type inference and normalization rules
- `actualLoad` input: numeric, `0..2000` enforced in write path.
- `rpe` input: normalized to `@ <number>` when numeric content detected.
- `e1rm` and load fields are parsed as nullable numbers.
- Conflict comparison uses server display value vs `originalValue` string match.

## Known schema mismatch
- Current Apps Script parser can consume richer week/day metadata columns when present in `_DB_Blocks`.
- Local workbook `_DB_Blocks` remains on older 13-column schema, so week/day metadata may require visual parse fallback.
- Evidence: DB mapping + parse-quality invalidation checks in `app/src/SheetsParser.gs:L612-L683` and `app/src/SheetsParser.gs:L525-L551`.

## NOT FOUND
- Stable athlete primary key column in workbook snapshot: NOT FOUND.
  - Searched: `_DB_Blocks`, `Calendar  Split  Info  PRs`, block templates for `athleteId`, `athlete_id`, `user_id`.
- Dedicated meet entity table for dashboard: NOT FOUND.
  - Searched for sheet names/headers containing `MeetId`, `Meets`, `Competition` (outside `Competition Card` view sheet).

## ASSUMPTION
- v1 dashboard remains single-athlete centered (current behavior) and does not require multi-athlete relational modeling until a future product expansion.
