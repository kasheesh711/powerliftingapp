// Code.gs

function doGet(e) {
  return HtmlService.createTemplateFromFile('html/index.html')
    .evaluate()
    .setTitle('Powerlifting Dashboard')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * NEW: Single API call to bootstrap the frontend.
 * Returns blocks list + config + basics in ONE round-trip
 * instead of the previous 2 separate calls (fetchBlocks + loadStats).
 */
function apiGetInitialPayload() {
  try {
    const source = getSourceSpreadsheetInfo_();
    Logger.log("Fetching initial payload...");
    Logger.log(
      "Source spreadsheet mode: " +
        source.source +
        ", id: " +
        source.spreadsheetId +
        ", name: " +
        source.spreadsheetName
    );
    const blocks = getAvailableBlocks();
    const basics = getBasics();
    const config = getConfig();
    Logger.log("Payload ready. Blocks: " + (blocks ? blocks.length : 0));
    return { blocks: blocks, basics: basics, config: config };
  } catch (e) {
    Logger.log("Error in apiGetInitialPayload: " + e.toString());
    throw e;
  }
}

/**
 * Load dashboard data for a specific block.
 * Each sub-function (getBlockData, getBasics, getConfig) now self-caches,
 * so this orchestrator is lean – it just composes results.
 */
function loadDashboardData(blockIdOrName, forceRefresh) {
  if (forceRefresh === undefined) forceRefresh = false;
  
  // When force-refreshing, bust the block data cache
  if (forceRefresh) {
    removeCachedData("BLOCK_DB_" + blockIdOrName);
  }
  
  const blockData = getBlockData(blockIdOrName, forceRefresh);
  const basics = getBasics();       // Uses its own cache
  const config = getConfig();       // Uses its own cache
  const stats = computeAllStats(blockData, basics, config);
  const overallProgress = computeOverallPrimaryProgress(forceRefresh);
  
  return {
    blockData: blockData,
    stats: stats,
    basics: basics,
    config: config,
    overallProgress: overallProgress
  };
}

function apiGetAvailableBlocks() {
  return getAvailableBlocks();
}

function apiLoadDashboardData(blockIdOrName, forceRefresh) {
  return loadDashboardData(blockIdOrName, forceRefresh);
}

function apiGetConfig() {
  return getConfig();
}

function apiSetConfig(updates) {
  return setConfig(updates);
}

function updateBlockCells(blockIdOrName, updates, force) {
  if (force === undefined) force = false;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("Could not acquire lock to save data.");
  }
  
  try {
    const ss = getSourceSpreadsheet_();
    let sheet = resolveSheetByIdOrName_(ss, blockIdOrName);
    
    if (!sheet) throw new Error("Sheet not found");

    const config = getConfig();
    if (config.disableWrites) throw new Error("Writes are disabled by Config.");

    const conflicts = [];
    const successfulUpdates = [];
    
    for (const update of updates) {
      if (update.field !== "actualLoad" && update.field !== "rpe") {
        throw new Error("Invalid field requested for update: " + update.field);
      }
      
      const range = sheet.getRange(update.cellA1);
      const serverValue = String(range.getValue());
      
      if (!force && serverValue !== String(update.originalValue || "")) {
         conflicts.push({
           cellA1: update.cellA1,
           serverValue: serverValue,
           requestedOriginal: update.originalValue
         });
      }
    }
    
    if (conflicts.length > 0) {
       return {
         status: "conflict",
         conflicts: conflicts,
         message: "Some cells have changed on the sheet since you loaded the block."
       };
    }
    
    for (const update of updates) {
      const range = sheet.getRange(update.cellA1);
      
      let valToWrite = update.newValue;
      if (update.field === "actualLoad") {
         const numericValue = parseFloat(String(valToWrite).replace(/,/g, ''));
         if (isNaN(numericValue) || numericValue < 0 || numericValue > 2000) {
            throw new Error(`Invalid actualLoad value: ${valToWrite} for cell ${update.cellA1}`);
         }
         valToWrite = numericValue;
      } else if (update.field === "rpe") {
         let rpeStr = String(valToWrite).trim();
         const match = rpeStr.match(/(\d+(?:\.\d+)?)/);
         if (match) valToWrite = "@ " + match[1];
      }
      
      range.setValue(valToWrite);
      
      logChange({
        sheetName: sheet.getName(),
        cellA1: update.cellA1,
        field: update.field,
        oldValue: update.originalValue,
        newValue: valToWrite,
        blockId: blockIdOrName
      });
      successfulUpdates.push(update);
    }
    
    // Bust caches for this block
    removeCachedData("BLOCK_DB_" + blockIdOrName);
    removeCachedData("OVERALL_PRIMARY_PROGRESS");
    
    const updatedData = loadDashboardData(blockIdOrName, true);
    
    return {
      status: "ok",
      updatedRows: updatedData.blockData.rows,
      stats: updatedData.stats,
      parserReport: updatedData.blockData.parserReport
    };
    
  } finally {
    lock.releaseLock();
  }
}
