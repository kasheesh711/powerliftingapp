// SheetsParser.gs

const BLOCK_NAME_RE = /\bblock\s*(\d+)(?:\s*(?:\(|year)?\s*\d{4}?\)?)?/i;
const BLOCK_RECAP_RE = /\brecap\b/i;

function createEmptyBlockData_(sheetName, warning) {
  return {
    rows: [],
    recaps: {},
    peakE1RMs: {},
    parserReport: {
      sheetName: sheetName || "",
      groupsFound: 0,
      groups: [],
      warnings: warning ? [warning] : [],
      mappedRows: 0,
      daySectionsFound: 0,
      activeDays: 0,
      plannedWeekCount: 0,
      activeWeekCount: 0,
      daySummaries: [],
      layoutVariant: "unknown"
    }
  };
}

function parseJsonSafe_(raw, fallbackValue) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallbackValue;
  }
}

function parseNumberOrNull_(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

function parseIntOrNull_(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

function getDayIndexFromMarker_(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) return null;
  const match = text.match(/^day\s*(\d+)\b/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return isNaN(n) ? null : n;
}

function formatDayLabel_(dayIndex) {
  return dayIndex ? "Day " + dayIndex : "Day ?";
}

function formatWeekLabel_(weekIndex) {
  return "Week " + weekIndex;
}

function isReferenceErrorText_(value) {
  const text = String(value || "").trim().toUpperCase();
  return text === "#REF!" || text === "#N/A" || text === "#VALUE!";
}

function isDisplayValueEmpty_(value) {
  const text = String(value === null || value === undefined ? "" : value).trim();
  return text === "" || text === "-" || text === "—" || isReferenceErrorText_(text);
}

function parseDisplayNumberOrNull_(value) {
  if (value === "" || value === null || value === undefined) return null;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return null;
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return isNaN(n) ? null : n;
}

function getCellDisplayValue_(data, rowIndex, colIndex) {
  if (rowIndex < 0 || colIndex < 0) return "";
  if (!data[rowIndex] || data[rowIndex][colIndex] === undefined) return "";
  return String(data[rowIndex][colIndex] || "").trim();
}

function canonicalWeekInfo_(weekIndex, fallbackIndex) {
  const idx = weekIndex && weekIndex > 0 ? weekIndex : fallbackIndex;
  return {
    weekIndex: idx,
    weekLabel: formatWeekLabel_(idx)
  };
}

function parseWeekInfoFromRaw_(rawValue, fallbackIndex) {
  const fallback = canonicalWeekInfo_(fallbackIndex, 1);
  const text = String(rawValue || "").trim();
  if (!text) return fallback;

  const weekMatch = text.match(/week\s*(\d+)/i);
  if (weekMatch) {
    const weekIndex = parseInt(weekMatch[1], 10);
    if (!isNaN(weekIndex) && weekIndex > 0) {
      return canonicalWeekInfo_(weekIndex, fallback.weekIndex);
    }
  }

  const directNumber = parseInt(text, 10);
  if (!isNaN(directNumber) && directNumber > 0 && directNumber < 100) {
    return canonicalWeekInfo_(directNumber, fallback.weekIndex);
  }

  return fallback;
}

function sanitizeCandidateDayName_(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) return "";
  if (/^day\s*\d+/i.test(text)) return "";
  if (/^week\s*\d+/i.test(text)) return "";
  if (!isNaN(parseFloat(text))) return "";
  return text;
}

function chooseNearestHeaderColumn_(row, leftBound, rightBound, anchorCol, predicate) {
  let bestCol = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  const from = Math.max(0, leftBound);
  const to = Math.min(row.length - 1, rightBound);

  for (let c = from; c <= to; c++) {
    const norm = normalizeHeader(row[c]);
    if (!predicate(norm)) continue;
    const distance = Math.abs(c - anchorCol);
    if (distance < bestDistance) {
      bestCol = c;
      bestDistance = distance;
    }
  }
  return bestCol;
}

function chooseNearestColumnFromList_(cols, anchorCol) {
  if (!cols || !cols.length) return -1;
  let bestCol = cols[0];
  let bestDistance = Math.abs(bestCol - anchorCol);
  for (let i = 1; i < cols.length; i++) {
    const distance = Math.abs(cols[i] - anchorCol);
    if (distance < bestDistance) {
      bestCol = cols[i];
      bestDistance = distance;
    }
  }
  return bestCol;
}

function parseWeekInfoForGroup_(data, dayRowIndex, group, fallbackIndex) {
  if (dayRowIndex < 0 || !data[dayRowIndex]) {
    return canonicalWeekInfo_(fallbackIndex, fallbackIndex);
  }

  const candidateCols = [group.repsCol, group.setsCol, group.labelCol, group.exerciseCol];
  for (let i = 0; i < candidateCols.length; i++) {
    const col = candidateCols[i];
    if (col === -1) continue;
    const raw = getCellDisplayValue_(data, dayRowIndex, col);
    if (!raw) continue;
    const info = parseWeekInfoFromRaw_(raw, fallbackIndex);
    if (info.weekIndex !== fallbackIndex || /week\s*\d+/i.test(raw) || /^\d+$/.test(raw.trim())) {
      return info;
    }
  }

  return canonicalWeekInfo_(fallbackIndex, fallbackIndex);
}

function getExerciseValueForRow_(data, rowIndex, daySection) {
  const direct = getCellDisplayValue_(data, rowIndex, daySection.exerciseCol);
  if (!isDisplayValueEmpty_(direct)) return direct;

  for (let i = 0; i < daySection.weekGroups.length; i++) {
    const labelCol = daySection.weekGroups[i].labelCol;
    if (labelCol === -1) continue;
    const candidate = getCellDisplayValue_(data, rowIndex, labelCol);
    if (!isDisplayValueEmpty_(candidate)) return candidate;
  }
  return "";
}

function rowHasGroupData_(data, rowIndex, group) {
  const cols = [
    group.setsCol,
    group.repsCol,
    group.targetLoadCol,
    group.actualLoadCol,
    group.rpeCol,
    group.e1rmCol
  ];
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    if (col === -1) continue;
    if (!isDisplayValueEmpty_(getCellDisplayValue_(data, rowIndex, col))) {
      return true;
    }
  }
  return false;
}

function detectWeekGroupsFromHeaderRow_(data, headerRowIndex, dayRowIndex, daySectionId) {
  const row = data[headerRowIndex] || [];
  const actualCols = [];
  const exerciseHeaderCols = [];
  const labelHeaderCols = [];

  for (let c = 0; c < row.length; c++) {
    const norm = normalizeHeader(row[c]);
    if (!norm) continue;
    if (norm === "exercise") exerciseHeaderCols.push(c);
    if (norm === "label") labelHeaderCols.push(c);
    if (norm.includes("actual") && norm.includes("load")) actualCols.push(c);
  }

  if (!actualCols.length) return [];

  const groups = [];
  for (let i = 0; i < actualCols.length; i++) {
    const actualCol = actualCols[i];
    const leftBound = i === 0 ? 0 : actualCols[i - 1] + 1;
    const rightBound = i === actualCols.length - 1 ? row.length - 1 : actualCols[i + 1] - 1;

    const group = {
      daySectionId: daySectionId,
      headerRow: headerRowIndex,
      dayRow: dayRowIndex,
      labelCol: chooseNearestHeaderColumn_(
        row,
        leftBound,
        rightBound,
        actualCol,
        function (norm) {
          return norm === "label";
        }
      ),
      exerciseCol: chooseNearestHeaderColumn_(
        row,
        leftBound,
        rightBound,
        actualCol,
        function (norm) {
          return norm === "exercise";
        }
      ),
      setsCol: chooseNearestHeaderColumn_(
        row,
        leftBound,
        rightBound,
        actualCol,
        function (norm) {
          return norm === "sets";
        }
      ),
      repsCol: chooseNearestHeaderColumn_(
        row,
        leftBound,
        rightBound,
        actualCol,
        function (norm) {
          return norm === "reps";
        }
      ),
      targetLoadCol: chooseNearestHeaderColumn_(
        row,
        leftBound,
        rightBound,
        actualCol,
        function (norm) {
          return norm.includes("target") && norm.includes("load");
        }
      ),
      actualLoadCol: actualCol,
      rpeCol: chooseNearestHeaderColumn_(
        row,
        leftBound,
        rightBound,
        actualCol,
        function (norm) {
          return norm.includes("rpe");
        }
      ),
      e1rmCol: chooseNearestHeaderColumn_(
        row,
        leftBound,
        rightBound,
        actualCol,
        function (norm) {
          return norm.includes("e1rm") && !norm.includes("peak");
        }
      ),
      notesCol: chooseNearestHeaderColumn_(
        row,
        leftBound,
        rightBound,
        actualCol,
        function (norm) {
          return norm.includes("note");
        }
      )
    };

    if (group.exerciseCol === -1) {
      group.exerciseCol = chooseNearestColumnFromList_(exerciseHeaderCols, actualCol);
    }
    if (group.labelCol === -1) {
      group.labelCol = chooseNearestColumnFromList_(labelHeaderCols, actualCol);
    }
    if (group.exerciseCol === -1) {
      group.exerciseCol = Math.max(0, actualCol - 5);
    }

    // Fallback offsets for heavily templated blocks where header cells are partially blank.
    if (group.setsCol === -1 && actualCol - 4 >= leftBound) group.setsCol = actualCol - 4;
    if (group.repsCol === -1 && actualCol - 3 >= leftBound) group.repsCol = actualCol - 3;
    if (group.targetLoadCol === -1 && actualCol - 2 >= leftBound) group.targetLoadCol = actualCol - 2;
    if (group.rpeCol === -1 && actualCol + 1 <= rightBound) group.rpeCol = actualCol + 1;
    if (group.e1rmCol === -1 && actualCol + 2 <= rightBound) group.e1rmCol = actualCol + 2;

    const weekInfo = parseWeekInfoForGroup_(data, dayRowIndex, group, i + 1);
    group.weekIndex = weekInfo.weekIndex;
    group.weekLabel = weekInfo.weekLabel;
    group.weekSectionId = daySectionId + "-week" + weekInfo.weekIndex;

    groups.push(group);
  }

  return groups;
}

function detectDaySectionsFromMarkers_(data) {
  const sections = [];
  const markers = [];

  for (let r = 0; r < data.length; r++) {
    const row = data[r] || [];
    const searchLimit = Math.min(30, row.length);
    for (let c = 0; c < searchLimit; c++) {
      const dayIndex = getDayIndexFromMarker_(row[c]);
      if (dayIndex === null) continue;
      markers.push({
        dayIndex: dayIndex,
        dayLabel: formatDayLabel_(dayIndex),
        dayRow: r,
        markerCol: c
      });
      break;
    }
  }

  if (!markers.length) return [];

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const nextBoundary = i + 1 < markers.length ? markers[i + 1].dayRow : data.length;
    const sectionId = "day" + marker.dayIndex;

    let headerRow = -1;
    let weekGroups = [];
    for (let r = marker.dayRow + 1; r <= Math.min(marker.dayRow + 3, data.length - 1); r++) {
      const groups = detectWeekGroupsFromHeaderRow_(data, r, marker.dayRow, sectionId);
      if (groups.length) {
        headerRow = r;
        weekGroups = groups;
        break;
      }
    }

    if (headerRow === -1 || !weekGroups.length) continue;

    const dayNameCandidates = [
      weekGroups[0].setsCol,
      weekGroups[0].labelCol,
      weekGroups[0].repsCol
    ];
    let dayName = "";
    for (let c = 0; c < dayNameCandidates.length; c++) {
      const col = dayNameCandidates[c];
      if (col === -1) continue;
      const candidate = sanitizeCandidateDayName_(getCellDisplayValue_(data, marker.dayRow, col));
      if (candidate) {
        dayName = candidate;
        break;
      }
    }

    const sectionExerciseCol = weekGroups[0].exerciseCol;
    sections.push({
      sectionId: sectionId,
      dayIndex: marker.dayIndex,
      dayLabel: marker.dayLabel,
      dayName: dayName,
      dayRowIndex: marker.dayRow,
      headerRow: headerRow,
      startRow: headerRow + 1,
      endRowExclusive: nextBoundary,
      exerciseCol: sectionExerciseCol,
      weekGroups: weekGroups
    });
  }

  return sections;
}

function detectFallbackDaySectionsFromHeaders_(data) {
  const sections = [];
  const headers = [];

  for (let r = 0; r < data.length; r++) {
    const groups = detectWeekGroupsFromHeaderRow_(data, r, -1, "");
    if (!groups.length) continue;
    headers.push({
      row: r,
      groups: groups
    });
  }

  for (let i = 0; i < headers.length; i++) {
    const dayIndex = i + 1;
    const sectionId = "day" + dayIndex;
    const nextBoundary = i + 1 < headers.length ? headers[i + 1].row : data.length;
    const groups = headers[i].groups.map(function (group, weekOffset) {
      const cloned = JSON.parse(JSON.stringify(group));
      const weekInfo = canonicalWeekInfo_(cloned.weekIndex || weekOffset + 1, weekOffset + 1);
      cloned.weekIndex = weekInfo.weekIndex;
      cloned.weekLabel = weekInfo.weekLabel;
      cloned.daySectionId = sectionId;
      cloned.weekSectionId = sectionId + "-week" + weekInfo.weekIndex;
      return cloned;
    });

    sections.push({
      sectionId: sectionId,
      dayIndex: dayIndex,
      dayLabel: formatDayLabel_(dayIndex),
      dayName: "",
      dayRowIndex: headers[i].row - 1,
      headerRow: headers[i].row,
      startRow: headers[i].row + 1,
      endRowExclusive: nextBoundary,
      exerciseCol: groups[0].exerciseCol,
      weekGroups: groups
    });
  }

  return sections;
}

function computePeakE1RMsFromRows_(rows) {
  const peaks = { squat: null, bench: null, deadlift: null };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lift = String(row.exercise || "").toLowerCase();
    const e1 = parseDisplayNumberOrNull_(row.e1rm);
    if (!e1) continue;

    if (lift.includes("squat")) peaks.squat = Math.max(peaks.squat || 0, e1);
    else if (lift.includes("bench")) peaks.bench = Math.max(peaks.bench || 0, e1);
    else if (lift.includes("deadlift")) peaks.deadlift = Math.max(peaks.deadlift || 0, e1);
  }
  return peaks;
}

function extractRecapsFromBlockData_(data) {
  const recaps = { squat: "", bench: "", deadlift: "", accessory: "", additions: "", coach: "" };

  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const cellText = String(data[r][c] || "").trim();
      if (!cellText) continue;

      const lower = cellText.toLowerCase();
      if (lower.includes("recap")) {
        if (lower.includes("squat")) recaps.squat = String(data[r][c + 1] || data[r + 1]?.[c] || "");
        else if (lower.includes("bench")) recaps.bench = String(data[r][c + 1] || data[r + 1]?.[c] || "");
        else if (lower.includes("deadlift")) recaps.deadlift = String(data[r][c + 1] || data[r + 1]?.[c] || "");
        else if (lower.includes("accessory")) recaps.accessory = String(data[r][c + 1] || data[r + 1]?.[c] || "");
      }
      if (lower.includes("additional things to fix")) {
        recaps.additions = String(data[r][c + 1] || data[r + 1]?.[c] || "");
      }
      if (lower.includes("coach's note") || lower.includes("coach note") || lower.includes("changes")) {
        recaps.coach = String(data[r][c + 1] || data[r + 1]?.[c] || "");
      }
    }
  }

  return recaps;
}

function resolveBlockName_(spreadsheet, blockIdOrName) {
  const sheet = resolveSheetByIdOrName_(spreadsheet, blockIdOrName);
  if (!sheet) throw new Error("Sheet not found: " + blockIdOrName);
  return sheet.getName();
}

function getDbColumnMap_(headerRow, defaults) {
  const map = {};
  for (const key in defaults) {
    const headerName = defaults[key].header;
    const fallback = defaults[key].fallback;
    const found = headerRow.indexOf(headerName);
    map[key] = found === -1 ? fallback : found;
  }
  return map;
}

function isDbMetaStale_(syncedAtISO) {
  if (!syncedAtISO) return true;
  const timestamp = new Date(syncedAtISO).getTime();
  if (!isFinite(timestamp)) return true;
  return Date.now() - timestamp > DB_METADATA_STALE_MS;
}

function isParseQualityInvalid_(blockName, data) {
  if (BLOCK_RECAP_RE.test(blockName)) return false;
  if (!data || !data.rows || data.rows.length === 0) return true;

  const report = data.parserReport || {};
  if ((report.groupsFound || 0) <= 0) return true;
  if ((report.mappedRows || 0) <= 0) return true;

  const warnings = report.warnings || [];
  for (let i = 0; i < warnings.length; i++) {
    if (String(warnings[i]).toLowerCase().includes("missing actual load")) {
      return true;
    }
  }

  // Older DB snapshots may miss normalized week/day metadata required for
  // primary-day progress analysis.
  const hasWeekMeta = data.rows.some(function (row) {
    return parseIntOrNull_(row.weekIndex) !== null;
  });
  const hasDayMeta = data.rows.some(function (row) {
    return parseIntOrNull_(row.dayIndex) !== null;
  });
  if (!hasWeekMeta || !hasDayMeta) return true;

  return false;
}

function shouldRepairBlockFromVisual_(blockName, dbRead) {
  if (!dbRead) return true;
  const isRecap = BLOCK_RECAP_RE.test(blockName);

  if (!dbRead.hasMeta) return true;
  if (dbRead.isStale) return true;
  if (!isRecap && !dbRead.hasRows) return true;
  if (!isRecap && isParseQualityInvalid_(blockName, dbRead.data)) return true;
  return false;
}

function readBlockDataFromDb_(spreadsheet, blockName) {
  const dbBlocksSheet = spreadsheet.getSheetByName(DB_BLOCKS_SHEET_NAME);
  const dbMetaSheet = spreadsheet.getSheetByName(DB_METADATA_SHEET_NAME);
  if (!dbBlocksSheet || !dbMetaSheet) return null;
  if (dbMetaSheet.getLastRow() < 2) return null;

  const result = {
    data: {
      rows: [],
      recaps: {},
      peakE1RMs: {},
      parserReport: { sheetName: blockName, warnings: [] }
    },
    hasRows: false,
    hasMeta: false,
    syncedAtISO: "",
    isStale: true
  };

  const metaData = dbMetaSheet.getDataRange().getValues();
  const metaMap = getDbColumnMap_(metaData[0] || [], {
    blockName: { header: "BlockName", fallback: 0 },
    recaps: { header: "RecapsJSON", fallback: 1 },
    peaks: { header: "PeakE1RMsJSON", fallback: 2 },
    parser: { header: "ParserReportJSON", fallback: 3 },
    syncedAt: { header: "SyncedAtISO", fallback: 4 }
  });

  for (let i = 1; i < metaData.length; i++) {
    const row = metaData[i];
    if (String(row[metaMap.blockName] || "") !== blockName) continue;
    result.hasMeta = true;
    result.resultRow = i + 1;
    result.data.recaps = parseJsonSafe_(row[metaMap.recaps] || "{}", {});
    result.data.peakE1RMs = parseJsonSafe_(row[metaMap.peaks] || "{}", {});
    result.data.parserReport = parseJsonSafe_(row[metaMap.parser] || "{}", {
      sheetName: blockName,
      warnings: []
    });
    result.syncedAtISO = String(row[metaMap.syncedAt] || "");
    result.isStale = isDbMetaStale_(result.syncedAtISO);
    break;
  }

  if (!result.hasMeta) return result;

  if (dbBlocksSheet.getLastRow() < 2) return result;
  const blocksData = dbBlocksSheet.getDataRange().getValues();
  const blocksMap = getDbColumnMap_(blocksData[0] || [], {
    blockName: { header: "BlockName", fallback: 0 },
    groupLabel: { header: "GroupLabel", fallback: 1 },
    rowIndex: { header: "RowIndex", fallback: 2 },
    exercise: { header: "Exercise", fallback: 3 },
    sets: { header: "Sets", fallback: 4 },
    reps: { header: "Reps", fallback: 5 },
    targetLoadKg: { header: "TargetLoadKg", fallback: 6 },
    actualLoadKg: { header: "ActualLoadKg", fallback: 7 },
    actualLoadCell: { header: "ActualLoadCell", fallback: 8 },
    rpe: { header: "RPE", fallback: 9 },
    rpeCell: { header: "RPECell", fallback: 10 },
    e1rm: { header: "E1RM", fallback: 11 },
    notes: { header: "Notes", fallback: 12 },
    weekIndex: { header: "WeekIndex", fallback: -1 },
    weekLabel: { header: "WeekLabel", fallback: -1 },
    dayIndex: { header: "DayIndex", fallback: -1 },
    dayLabel: { header: "DayLabel", fallback: -1 },
    dayName: { header: "DayName", fallback: -1 },
    dayRowIndex: { header: "DayRowIndex", fallback: -1 },
    weekSectionId: { header: "WeekSectionId", fallback: -1 },
    daySectionId: { header: "DaySectionId", fallback: -1 }
  });

  for (let i = 1; i < blocksData.length; i++) {
    const row = blocksData[i];
    if (String(row[blocksMap.blockName] || "") !== blockName) continue;
    const weekIndex =
      blocksMap.weekIndex === -1 ? null : parseIntOrNull_(row[blocksMap.weekIndex]);
    const dayIndex = blocksMap.dayIndex === -1 ? null : parseIntOrNull_(row[blocksMap.dayIndex]);
    const weekLabelRaw =
      blocksMap.weekLabel === -1 ? "" : String(row[blocksMap.weekLabel] || "");
    const dayLabelRaw = blocksMap.dayLabel === -1 ? "" : String(row[blocksMap.dayLabel] || "");
    const daySectionIdRaw =
      blocksMap.daySectionId === -1 ? "" : String(row[blocksMap.daySectionId] || "");
    const weekSectionIdRaw =
      blocksMap.weekSectionId === -1 ? "" : String(row[blocksMap.weekSectionId] || "");
    const resolvedDayLabel = dayLabelRaw || (dayIndex ? formatDayLabel_(dayIndex) : "");
    const resolvedWeekLabel = weekLabelRaw || (weekIndex ? formatWeekLabel_(weekIndex) : "");
    const resolvedDaySectionId = daySectionIdRaw || (dayIndex ? "day" + dayIndex : "");
    const resolvedWeekSectionId =
      weekSectionIdRaw ||
      (resolvedDaySectionId && weekIndex ? resolvedDaySectionId + "-week" + weekIndex : "");

    result.data.rows.push({
      sheetName: row[blocksMap.blockName],
      groupLabel: row[blocksMap.groupLabel],
      rowIndex: row[blocksMap.rowIndex],
      exercise: row[blocksMap.exercise],
      sets: row[blocksMap.sets],
      reps: row[blocksMap.reps],
      targetLoadKg: parseNumberOrNull_(row[blocksMap.targetLoadKg]),
      actualLoadKg: parseNumberOrNull_(row[blocksMap.actualLoadKg]),
      actualLoadCell: row[blocksMap.actualLoadCell],
      rpe: row[blocksMap.rpe] === "" ? null : String(row[blocksMap.rpe]),
      rpeCell: row[blocksMap.rpeCell],
      e1rm: parseNumberOrNull_(row[blocksMap.e1rm]),
      notes: row[blocksMap.notes],
      weekIndex: weekIndex,
      weekLabel: resolvedWeekLabel,
      dayIndex: dayIndex,
      dayLabel: resolvedDayLabel,
      dayName: blocksMap.dayName === -1 ? "" : String(row[blocksMap.dayName] || ""),
      dayRowIndex:
        blocksMap.dayRowIndex === -1 ? null : parseIntOrNull_(row[blocksMap.dayRowIndex]),
      weekSectionId: resolvedWeekSectionId,
      daySectionId: resolvedDaySectionId
    });
  }
  result.hasRows = result.data.rows.length > 0;
  return result;
}

function parseBlockAndRepairDb_(spreadsheet, blockName) {
  const parsed = parseBlockFromVisualSheet(blockName);
  try {
    upsertBlockToDB_(blockName, parsed, spreadsheet);
  } catch (e) {
    const msg = "Failed to upsert block '" + blockName + "' into shadow DB: " + e;
    console.warn(msg);
    if (!parsed.parserReport) parsed.parserReport = { warnings: [] };
    if (!parsed.parserReport.warnings) parsed.parserReport.warnings = [];
    parsed.parserReport.warnings.push(msg);
  }
  return parsed;
}

/**
 * Get available blocks with caching (TTL: 5 min).
 */
function getAvailableBlocks(forceRefresh) {
  const CACHE_KEY = "AVAILABLE_BLOCKS";

  if (!forceRefresh) {
    const memo = getMemo(CACHE_KEY);
    if (memo) return memo;

    const cached = getCachedData(CACHE_KEY);
    if (cached) return setMemo(CACHE_KEY, cached);
  }

  const ss = getSourceSpreadsheet_();
  const sheets = ss.getSheets();
  const blocks = [];

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const name = sheet.getName();

    // Skip internal database sheets
    if (name.startsWith("_DB_")) continue;

    let isBlock = false;
    let blockNum = null;
    let year = null;
    let isRecap = false;

    const blockMatch = name.match(BLOCK_NAME_RE);
    if (blockMatch) {
      isBlock = true;
      blockNum = blockMatch[1];
      const yearMatch = name.match(/\b(20\d{2})\b/);
      if (yearMatch) year = yearMatch[1];
    }

    if (BLOCK_RECAP_RE.test(name)) {
      isRecap = true;
    }

    if (isBlock || isRecap) {
      blocks.push({
        sheetId: sheet.getSheetId(),
        name: name,
        blockNum: blockNum,
        year: year,
        isRecap: isRecap,
        isBlock: isBlock
      });
    }
  }

  setCachedData(CACHE_KEY, blocks, 300); // 5 min TTL
  return setMemo(CACHE_KEY, blocks);
}

/**
 * Original parser that reads from visually wide template.
 * Used by shadow DB sync and live fallback repair.
 */
function parseBlockFromVisualSheet(blockIdOrName) {
  const ss = getSourceSpreadsheet_();
  const sheet = resolveSheetByIdOrName_(ss, blockIdOrName);

  if (!sheet) {
    throw new Error("Sheet not found: " + blockIdOrName);
  }

  const sheetName = sheet.getName();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) {
    return createEmptyBlockData_(sheetName, "Empty sheet");
  }

  // Use getLastRow/getLastColumn to avoid reading empty trailing rows/cols
  const data = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

  const parserReport = {
    sheetName: sheetName,
    groupsFound: 0,
    groups: [],
    warnings: [],
    mappedRows: 0,
    daySectionsFound: 0,
    activeDays: 0,
    plannedWeekCount: 0,
    activeWeekCount: 0,
    daySummaries: [],
    layoutVariant: "unknown"
  };

  const recaps = extractRecapsFromBlockData_(data);
  const parsedRows = [];

  let daySections = detectDaySectionsFromMarkers_(data);
  if (daySections.length > 0) {
    parserReport.layoutVariant = "day_marker_template";
  } else {
    parserReport.layoutVariant = "header_repeat_fallback";
    parserReport.warnings.push(
      "No DAY markers found. Falling back to repeated header autodetection."
    );
    daySections = detectFallbackDaySectionsFromHeaders_(data);
  }

  parserReport.daySectionsFound = daySections.length;
  if (!daySections.length) {
    parserReport.warnings.push("No valid tracking groups found (missing ACTUAL LOAD headers).");
    return {
      rows: [],
      recaps: recaps,
      peakE1RMs: { squat: null, bench: null, deadlift: null },
      parserReport: parserReport
    };
  }

  const activeWeekIndices = {};
  const daySummaries = [];
  let plannedWeekCount = 0;

  for (let d = 0; d < daySections.length; d++) {
    const section = daySections[d];
    plannedWeekCount = Math.max(plannedWeekCount, section.weekGroups.length);

    const weekSummaryMap = {};
    for (let w = 0; w < section.weekGroups.length; w++) {
      const group = section.weekGroups[w];
      weekSummaryMap[group.weekSectionId] = {
        weekIndex: group.weekIndex,
        weekLabel: group.weekLabel,
        weekSectionId: group.weekSectionId,
        mappedRows: 0,
        hasTargetOrActual: false
      };
    }

    const seenExercises = {};
    let mappedRowsForDay = 0;

    for (let r = section.startRow; r < Math.min(section.endRowExclusive, data.length); r++) {
      const exercise = getExerciseValueForRow_(data, r, section);
      if (isDisplayValueEmpty_(exercise)) continue;

      let hasDataAcrossWeeks = false;
      for (let w = 0; w < section.weekGroups.length; w++) {
        if (rowHasGroupData_(data, r, section.weekGroups[w])) {
          hasDataAcrossWeeks = true;
          break;
        }
      }
      if (!hasDataAcrossWeeks) continue;

      seenExercises[String(exercise).toLowerCase()] = true;

      for (let w = 0; w < section.weekGroups.length; w++) {
        const group = section.weekGroups[w];
        if (!rowHasGroupData_(data, r, group)) continue;

        const sets = getCellDisplayValue_(data, r, group.setsCol);
        const reps = getCellDisplayValue_(data, r, group.repsCol);
        const targetLoad = getCellDisplayValue_(data, r, group.targetLoadCol);
        const actualLoad = getCellDisplayValue_(data, r, group.actualLoadCol);
        const rpe = getCellDisplayValue_(data, r, group.rpeCol);
        const e1rm = getCellDisplayValue_(data, r, group.e1rmCol);
        const notes = getCellDisplayValue_(data, r, group.notesCol);

        const targetLoadKg = isDisplayValueEmpty_(targetLoad) ? null : targetLoad;
        const actualLoadKg = parseDisplayNumberOrNull_(actualLoad);
        let parsedE1rm = parseDisplayNumberOrNull_(e1rm);
        if (parsedE1rm === null && actualLoadKg !== null) {
          let repCount = parseDisplayNumberOrNull_(reps);
          if ((repCount === null || repCount <= 0) && !isDisplayValueEmpty_(rpe)) {
            repCount = 1;
          }
          if (repCount !== null && repCount > 0) {
            parsedE1rm = computeE1RM_Epley(actualLoadKg, repCount);
          }
        }

        const dayLabel = section.dayLabel || formatDayLabel_(section.dayIndex);
        const dayName = section.dayName || "";
        const weekLabel = group.weekLabel || formatWeekLabel_(group.weekIndex || w + 1);
        const dayDisplay = dayName ? dayLabel + " (" + dayName + ")" : dayLabel;

        const hasTargetOrActual =
          !isDisplayValueEmpty_(targetLoad) || !isDisplayValueEmpty_(actualLoad);
        if (hasTargetOrActual) {
          activeWeekIndices[String(group.weekIndex)] = true;
          weekSummaryMap[group.weekSectionId].hasTargetOrActual = true;
        }

        weekSummaryMap[group.weekSectionId].mappedRows++;
        mappedRowsForDay++;
        parserReport.mappedRows++;

        parsedRows.push({
          sheetName: sheetName,
          groupLabel: dayDisplay + " - " + weekLabel,
          rowIndex: r + 1,
          exercise: exercise,
          sets: isDisplayValueEmpty_(sets) ? "" : sets,
          reps: isDisplayValueEmpty_(reps) ? "" : reps,
          targetLoadKg: targetLoadKg,
          actualLoadKg: actualLoadKg,
          actualLoadCell: group.actualLoadCol !== -1 ? colIndexToA1(group.actualLoadCol, r + 1) : null,
          rpe: isDisplayValueEmpty_(rpe) ? null : rpe,
          rpeCell: group.rpeCol !== -1 ? colIndexToA1(group.rpeCol, r + 1) : null,
          e1rm: parsedE1rm,
          notes: isDisplayValueEmpty_(notes) ? "" : notes,
          dayIndex: section.dayIndex,
          dayLabel: dayLabel,
          dayName: dayName,
          dayRowIndex: section.dayRowIndex + 1,
          daySectionId: section.sectionId,
          weekIndex: group.weekIndex || w + 1,
          weekLabel: weekLabel,
          weekSectionId: group.weekSectionId
        });
      }
    }

    const weekSummaries = Object.keys(weekSummaryMap)
      .map(function (key) {
        return weekSummaryMap[key];
      })
      .sort(function (a, b) {
        return a.weekIndex - b.weekIndex;
      });

    daySummaries.push({
      daySectionId: section.sectionId,
      dayIndex: section.dayIndex,
      dayLabel: section.dayLabel,
      dayName: section.dayName,
      dayRowIndex: section.dayRowIndex + 1,
      headerRowIndex: section.headerRow + 1,
      plannedWeekCount: section.weekGroups.length,
      exerciseCount: Object.keys(seenExercises).length,
      mappedRows: mappedRowsForDay,
      isActive: mappedRowsForDay > 0,
      weekSummaries: weekSummaries
    });
  }

  parserReport.daySummaries = daySummaries;
  parserReport.activeDays = daySummaries.filter(function (day) {
    return day.isActive;
  }).length;
  parserReport.plannedWeekCount = plannedWeekCount;
  parserReport.activeWeekCount = Object.keys(activeWeekIndices).length;
  parserReport.groupsFound = plannedWeekCount;
  parserReport.groups = daySections.map(function (section) {
    return {
      daySectionId: section.sectionId,
      dayIndex: section.dayIndex,
      dayLabel: section.dayLabel,
      dayName: section.dayName,
      dayRowIndex: section.dayRowIndex + 1,
      headerRowIndex: section.headerRow + 1,
      weekGroups: section.weekGroups.map(function (group) {
        return {
          weekIndex: group.weekIndex,
          weekLabel: group.weekLabel,
          weekSectionId: group.weekSectionId,
          actualLoadCol: group.actualLoadCol === -1 ? null : group.actualLoadCol + 1,
          rpeCol: group.rpeCol === -1 ? null : group.rpeCol + 1,
          targetLoadCol: group.targetLoadCol === -1 ? null : group.targetLoadCol + 1
        };
      })
    };
  });

  return {
    rows: parsedRows,
    recaps: recaps,
    peakE1RMs: computePeakE1RMsFromRows_(parsedRows),
    parserReport: parserReport
  };
}

/**
 * Hybrid read path:
 * 1) Read from `_DB_` for speed
 * 2) Auto-repair from visual sheet when block data is missing/stale/invalid
 */
function getBlockData(blockIdOrName, forceRefresh) {
  const CACHE_KEY = "BLOCK_DB_" + blockIdOrName;

  if (!forceRefresh) {
    const memo = getMemo(CACHE_KEY);
    if (memo) return memo;

    const cached = getCachedData(CACHE_KEY);
    if (cached) return setMemo(CACHE_KEY, cached);
  }

  const ss = getSourceSpreadsheet_();
  const blockName = resolveBlockName_(ss, blockIdOrName);

  let result;

  if (forceRefresh) {
    result = parseBlockAndRepairDb_(ss, blockName);
    setCachedData(CACHE_KEY, result, 300);
    return setMemo(CACHE_KEY, result);
  }

  const dbRead = readBlockDataFromDb_(ss, blockName);
  if (shouldRepairBlockFromVisual_(blockName, dbRead)) {
    result = parseBlockAndRepairDb_(ss, blockName);
  } else {
    result = dbRead.data;
  }

  setCachedData(CACHE_KEY, result, 300);
  return setMemo(CACHE_KEY, result);
}

function colIndexToA1(colIndex, rowNumber) {
  let temp;
  let letter = "";
  let c = colIndex + 1;
  while (c > 0) {
    temp = (c - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    c = (c - temp - 1) / 26;
  }
  return letter + rowNumber;
}
