// ShadowDB.gs

const DB_BLOCKS_SHEET_NAME = "_DB_Blocks";
const DB_METADATA_SHEET_NAME = "_DB_Metadata";
const DB_METADATA_STALE_MS = 12 * 60 * 60 * 1000; // 12 hours

const DB_BLOCKS_HEADERS = [
  "BlockName",
  "GroupLabel",
  "RowIndex",
  "Exercise",
  "Sets",
  "Reps",
  "TargetLoadKg",
  "ActualLoadKg",
  "ActualLoadCell",
  "RPE",
  "RPECell",
  "E1RM",
  "Notes",
  "WeekIndex",
  "DayIndex",
  "DayLabel",
  "WeekLabel",
  "DayName",
  "DayRowIndex",
  "WeekSectionId",
  "DaySectionId"
];

const DB_METADATA_HEADERS = [
  "BlockName",
  "RecapsJSON",
  "PeakE1RMsJSON",
  "ParserReportJSON",
  "SyncedAtISO"
];

function ensureShadowDbSheet_(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.hideSheet();
  } else if (!sheet.isSheetHidden()) {
    sheet.hideSheet();
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function ensureShadowDbSheets_(spreadsheet) {
  const ss = spreadsheet || getSourceSpreadsheet_();
  const dbBlocksSheet = ensureShadowDbSheet_(ss, DB_BLOCKS_SHEET_NAME, DB_BLOCKS_HEADERS);
  const dbMetaSheet = ensureShadowDbSheet_(ss, DB_METADATA_SHEET_NAME, DB_METADATA_HEADERS);
  return { dbBlocksSheet, dbMetaSheet };
}

function clearDataRows_(sheet, width) {
  if (sheet.getLastRow() <= 1) return;
  const cols = Math.max(width || 1, sheet.getLastColumn());
  sheet.getRange(2, 1, sheet.getLastRow() - 1, cols).clearContent();
}

function normalizeRowWidth_(row, width) {
  const out = [];
  for (let i = 0; i < width; i++) {
    out.push(row && row[i] !== undefined ? row[i] : "");
  }
  return out;
}

function serializeBlockRowsForDb_(blockName, parsedData) {
  const rows = [];
  const parsedRows = parsedData && parsedData.rows ? parsedData.rows : [];
  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    rows.push([
      blockName,
      row.groupLabel || "",
      row.rowIndex || "",
      row.exercise || "",
      row.sets || "",
      row.reps || "",
      row.targetLoadKg === null || row.targetLoadKg === undefined ? "" : row.targetLoadKg,
      row.actualLoadKg === null || row.actualLoadKg === undefined ? "" : row.actualLoadKg,
      row.actualLoadCell || "",
      row.rpe === null || row.rpe === undefined ? "" : row.rpe,
      row.rpeCell || "",
      row.e1rm === null || row.e1rm === undefined ? "" : row.e1rm,
      row.notes || "",
      row.weekIndex === null || row.weekIndex === undefined ? "" : row.weekIndex,
      row.dayIndex === null || row.dayIndex === undefined ? "" : row.dayIndex,
      row.dayLabel || "",
      row.weekLabel || "",
      row.dayName || "",
      row.dayRowIndex === null || row.dayRowIndex === undefined ? "" : row.dayRowIndex,
      row.weekSectionId || "",
      row.daySectionId || ""
    ]);
  }
  return rows;
}

function serializeMetaRowForDb_(blockName, parsedData, syncedAtISO) {
  return [
    blockName,
    JSON.stringify((parsedData && parsedData.recaps) || {}),
    JSON.stringify((parsedData && parsedData.peakE1RMs) || {}),
    JSON.stringify((parsedData && parsedData.parserReport) || {}),
    syncedAtISO
  ];
}

function upsertBlockToDB_(blockName, parsedData, spreadsheet) {
  const ss = spreadsheet || getSourceSpreadsheet_();
  const db = ensureShadowDbSheets_(ss);
  const syncedAtISO = new Date().toISOString();

  const currentBlocksData = db.dbBlocksSheet.getDataRange().getValues();
  const keptBlockRows = [];
  for (let i = 1; i < currentBlocksData.length; i++) {
    if (currentBlocksData[i][0] && currentBlocksData[i][0] !== blockName) {
      keptBlockRows.push(normalizeRowWidth_(currentBlocksData[i], DB_BLOCKS_HEADERS.length));
    }
  }
  const mergedBlockRows = keptBlockRows.concat(serializeBlockRowsForDb_(blockName, parsedData));
  clearDataRows_(db.dbBlocksSheet, DB_BLOCKS_HEADERS.length);
  if (mergedBlockRows.length > 0) {
    db.dbBlocksSheet
      .getRange(2, 1, mergedBlockRows.length, DB_BLOCKS_HEADERS.length)
      .setValues(mergedBlockRows);
  }

  const currentMetaData = db.dbMetaSheet.getDataRange().getValues();
  const keptMetaRows = [];
  for (let i = 1; i < currentMetaData.length; i++) {
    if (currentMetaData[i][0] && currentMetaData[i][0] !== blockName) {
      const row = [];
      for (let c = 0; c < DB_METADATA_HEADERS.length; c++) {
        row.push(currentMetaData[i][c] || "");
      }
      keptMetaRows.push(row);
    }
  }
  keptMetaRows.push(serializeMetaRowForDb_(blockName, parsedData, syncedAtISO));
  clearDataRows_(db.dbMetaSheet, DB_METADATA_HEADERS.length);
  db.dbMetaSheet
    .getRange(2, 1, keptMetaRows.length, DB_METADATA_HEADERS.length)
    .setValues(keptMetaRows);

  removeCachedData("BLOCK_DB_" + blockName);
  removeCachedData("OVERALL_PRIMARY_PROGRESS");

  return {
    blockName: blockName,
    syncedAtISO: syncedAtISO,
    rowCount: parsedData && parsedData.rows ? parsedData.rows.length : 0
  };
}

/**
 * Syncs all available blocks into the hidden database sheets.
 * This can be run via a time-driven trigger or manually via menu.
 */
function syncAllBlocksToDB() {
  const ss = getSourceSpreadsheet_();

  // Get all blocks using existing function
  const blocks = getAvailableBlocks(true); // force refresh
  const db = ensureShadowDbSheets_(ss);

  // Clear old data, keep headers
  clearDataRows_(db.dbBlocksSheet, DB_BLOCKS_HEADERS.length);
  clearDataRows_(db.dbMetaSheet, DB_METADATA_HEADERS.length);

  const allRows = [];
  const allMeta = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!(block.isBlock || block.isRecap)) continue;

    try {
      const data = parseBlockFromVisualSheet(block.name);
      const syncedAtISO = new Date().toISOString();

      const blockRows = serializeBlockRowsForDb_(block.name, data);
      for (let r = 0; r < blockRows.length; r++) {
        allRows.push(blockRows[r]);
      }
      allMeta.push(serializeMetaRowForDb_(block.name, data, syncedAtISO));
    } catch (e) {
      console.error("Error parsing block " + block.name + " during sync: " + e);
    }
  }

  // Bulk write for speed
  if (allRows.length > 0) {
    db.dbBlocksSheet
      .getRange(2, 1, allRows.length, DB_BLOCKS_HEADERS.length)
      .setValues(allRows);
  }
  if (allMeta.length > 0) {
    db.dbMetaSheet
      .getRange(2, 1, allMeta.length, DB_METADATA_HEADERS.length)
      .setValues(allMeta);
  }

  removeCachedData("AVAILABLE_BLOCKS");
  removeCachedData("OVERALL_PRIMARY_PROGRESS");
  Logger.log("Shadow DB sync complete! Parsed " + blocks.length + " blocks.");
}

/**
 * Creates a nightly time-driven trigger to run syncAllBlocksToDB
 * Run this function once manually to set up automatic syncing.
 */
function createSyncTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "syncAllBlocksToDB") {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Run every night automatically
  ScriptApp.newTrigger("syncAllBlocksToDB")
    .timeBased()
    .everyDays(1)
    .atHour(2) // Runs between 2 AM and 3 AM
    .create();

  Logger.log("Nightly trigger created for syncAllBlocksToDB.");
}

/**
 * Adds an admin menu to the spreadsheet UI to trigger sync manually.
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("⚡️ Powerlifting App")
      .addItem("Sync Blocks to Database", "syncAllBlocksToDB")
      .addItem("Setup Nightly Auto-Sync", "createSyncTrigger")
      .addToUi();
  } catch (e) {
    // getUi() fails when triggered headlessly
  }
}
