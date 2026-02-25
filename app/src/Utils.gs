// Utilities

function normalizeHeader(str) {
  if (!str) return "";
  return str.toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

function getSourceSpreadsheet_() {
  const info = getSourceSpreadsheetInfo_();
  if (info.spreadsheet) return info.spreadsheet;
  throw new Error(
    "Source spreadsheet is not configured. Set Script Property SOURCE_SPREADSHEET_ID to a valid Google Sheet ID, or run this as a bound spreadsheet script."
  );
}

function getSourceSpreadsheetInfo_() {
  const props = PropertiesService.getScriptProperties();
  const configuredId = String(props.getProperty("SOURCE_SPREADSHEET_ID") || "").trim();

  if (configuredId) {
    try {
      const ss = SpreadsheetApp.openById(configuredId);
      return {
        spreadsheet: ss,
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        source: "script_property"
      };
    } catch (e) {
      throw new Error(
        "Failed to open SOURCE_SPREADSHEET_ID '" + configuredId + "': " + e.message
      );
    }
  }

  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      return {
        spreadsheet: active,
        spreadsheetId: active.getId(),
        spreadsheetName: active.getName(),
        source: "active_spreadsheet_fallback"
      };
    }
  } catch (e) {
    // no-op: this can fail in some headless contexts
  }

  return {
    spreadsheet: null,
    spreadsheetId: "",
    spreadsheetName: "",
    source: "unresolved"
  };
}

function resolveSheetByIdOrName_(spreadsheet, sheetIdOrName) {
  if (!spreadsheet || sheetIdOrName === null || sheetIdOrName === undefined) return null;
  const key = String(sheetIdOrName);

  const byName = spreadsheet.getSheetByName(key);
  if (byName) return byName;

  const sheets = spreadsheet.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    if (String(s.getSheetId()) === key || s.getName() === key) {
      return s;
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// Chunked Caching (handles >100KB payloads)
// CacheService has a 100KB per-key limit.
// We split large payloads into numbered chunks.
// ─────────────────────────────────────────────
const CACHE_CHUNK_SIZE = 90000; // ~90KB to leave headroom

function getCachedData(key) {
  const cache = CacheService.getScriptCache();
  const meta = cache.get(key + "__meta");
  if (!meta) return null;
  
  try {
    const metaObj = JSON.parse(meta);
    if (metaObj.chunks === 1) {
      // Single chunk – fast path
      const raw = cache.get(key + "__0");
      return raw ? JSON.parse(raw) : null;
    }
    
    // Multi-chunk: fetch all chunk keys in one batch call
    const chunkKeys = [];
    for (let i = 0; i < metaObj.chunks; i++) {
      chunkKeys.push(key + "__" + i);
    }
    const chunkValues = cache.getAll(chunkKeys);
    
    let combined = "";
    for (let i = 0; i < metaObj.chunks; i++) {
      const chunkVal = chunkValues[key + "__" + i];
      if (!chunkVal) return null; // partial expiry → cache miss
      combined += chunkVal;
    }
    return JSON.parse(combined);
  } catch (e) {
    console.warn("Cache read error for " + key, e);
    return null;
  }
}

function setCachedData(key, data, expirationInSeconds) {
  if (expirationInSeconds === undefined) expirationInSeconds = 300;
  const cache = CacheService.getScriptCache();
  const json = JSON.stringify(data);
  const numChunks = Math.ceil(json.length / CACHE_CHUNK_SIZE);
  
  const allPuts = {};
  for (let i = 0; i < numChunks; i++) {
    allPuts[key + "__" + i] = json.substring(i * CACHE_CHUNK_SIZE, (i + 1) * CACHE_CHUNK_SIZE);
  }
  allPuts[key + "__meta"] = JSON.stringify({ chunks: numChunks, ts: Date.now() });
  
  // putAll is a single batch RPC – much faster than individual puts
  cache.putAll(allPuts, expirationInSeconds);
}

function removeCachedData(key) {
  const cache = CacheService.getScriptCache();
  const meta = cache.get(key + "__meta");
  if (!meta) return;
  
  try {
    const metaObj = JSON.parse(meta);
    const keysToRemove = [key + "__meta"];
    for (let i = 0; i < metaObj.chunks; i++) {
      keysToRemove.push(key + "__" + i);
    }
    cache.removeAll(keysToRemove);
  } catch (e) {
    cache.remove(key + "__meta");
  }
}

// ─────────────────────────────────────────────
// Singleton memo cache (in-memory, per execution)
// ─────────────────────────────────────────────
const _memoCache = {};

function getMemo(key) {
  return _memoCache[key] || null;
}

function setMemo(key, value) {
  _memoCache[key] = value;
  return value;
}

// ─────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────
function logChange(changeRecord) {
  try {
    const ss = getSourceSpreadsheet_();
    let changeLog = ss.getSheetByName("ChangeLog");
    if (!changeLog) {
      changeLog = ss.insertSheet("ChangeLog");
      changeLog.appendRow(["Timestamp", "UserEmail", "SheetName", "CellA1", "Field", "OldValue", "NewValue", "BlockId", "ParserReportId", "Note"]);
    }
    
    changeLog.appendRow([
      changeRecord.timestamp || new Date().toISOString(),
      getCurrentUserEmail(),
      changeRecord.sheetName || "",
      changeRecord.cellA1 || "",
      changeRecord.field || "",
      changeRecord.oldValue === undefined ? "" : changeRecord.oldValue,
      changeRecord.newValue === undefined ? "" : changeRecord.newValue,
      changeRecord.blockId || "",
      changeRecord.parserReportId || "",
      changeRecord.note || ""
    ]);
  } catch (e) {
    console.error("Failed to log change: ", e);
  }
}

function logParserReport(reportId, reportJson) {
  try {
    const ss = getSourceSpreadsheet_();
    let reportSheet = ss.getSheetByName("ParserReports");
    if (!reportSheet) {
      reportSheet = ss.insertSheet("ParserReports");
      reportSheet.appendRow(["Timestamp", "ReportId", "ReportJSON"]);
    }
    reportSheet.appendRow([new Date().toISOString(), reportId, JSON.stringify(reportJson)]);
  } catch(e) {
    console.error("Failed to log parser report: ", e);
  }
}

function getCurrentUserEmail() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (email) return email;
  } catch (e) {}
  try {
    const email = Session.getEffectiveUserEmail();
    if (email) return email;
  } catch (e) {}
  return "unknown";
}
