// Config.gs

const DEFAULT_COEFFICIENTS = {
  DOTS_male: { a: -307.582, b: 24.0900756, c: -0.1918759221, d: 0.0007391293, e: -0.000001093 },
  DOTS_female: { a: -57.96288, b: 13.6175032, c: -0.1126655495, d: 0.0005158568, e: -0.0000010706 },
  WILKS_male: { a: -216.0475144, b: 16.2606339, c: -0.002388645, d: -0.00113732, e: 0.00000701863, f: -0.00000001291 },
  WILKS_female: { a: 594.31747775582, b: -27.23842536447, c: 0.82112226871, d: -0.00930733913, e: 0.00004731582, f: -0.00000009054 },
  GLPOINTS_male: { a: 1199.72839, b: 102.5181, c: 0.00921 },
  GLPOINTS_female: { a: 610.32796, b: 1045.59282, c: 0.03048 }
};

const CALENDAR_INFO_SHEET_NAME = "Calendar  Split  Info  PRs";

function createDefaultConfig_() {
  return {
    coefficients: JSON.parse(JSON.stringify(DEFAULT_COEFFICIENTS)),
    disableWrites: false
  };
}

function createDefaultBasics_() {
  return {
    bodyweight: 80,
    sex: "male",
    squatBaseline: null,
    benchBaseline: null,
    deadliftBaseline: null
  };
}

function extractNumericValues_(value) {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "number" && isFinite(value)) return [value];

  const str = String(value);
  const matches = str.match(/-?\d[\d,]*(?:\.\d+)?/g);
  if (!matches) return [];

  const out = [];
  for (let i = 0; i < matches.length; i++) {
    const n = parseFloat(matches[i].replace(/,/g, ""));
    if (isFinite(n)) out.push(n);
  }
  return out;
}

function pickFirstNumberInRange_(numbers, min, max) {
  if (!numbers) return null;
  for (let i = 0; i < numbers.length; i++) {
    const n = numbers[i];
    if (n >= min && n <= max) return n;
  }
  return null;
}

function pickMaxNumberInRange_(numbers, min, max) {
  if (!numbers || numbers.length === 0) return null;
  let best = null;
  for (let i = 0; i < numbers.length; i++) {
    const n = numbers[i];
    if (n < min || n > max) continue;
    if (best === null || n > best) best = n;
  }
  return best;
}

function parseSexValue_(value) {
  const text = normalizeHeader(value);
  if (!text) return null;
  if (text.startsWith("f")) return "female";
  if (text.startsWith("m")) return "male";
  return null;
}

function canonicalLiftFromLabel_(label) {
  const key = normalizeHeader(label);
  if (key === "squat") return "squat";
  if (key === "bench" || key === "bench press") return "bench";
  if (key === "deadlift" || key === "sumo deadlift" || key === "dl") return "deadlift";
  return null;
}

function applyBasicsFromBasicsSheet_(sheet, basics) {
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    const key = normalizeHeader(data[i][0]);
    const val = data[i][1];
    if (!key) continue;

    if (key.includes("bodyweight") || key === "body weight" || key === "bw") {
      const bw = pickFirstNumberInRange_(extractNumericValues_(val), 30, 250);
      if (bw !== null) basics.bodyweight = bw;
    } else if (key === "sex" || key === "gender") {
      const parsedSex = parseSexValue_(val);
      if (parsedSex) basics.sex = parsedSex;
    } else if (key.includes("squat baseline")) {
      const value = pickMaxNumberInRange_(extractNumericValues_(val), 30, 600);
      if (value !== null) basics.squatBaseline = value;
    } else if (key.includes("bench baseline")) {
      const value = pickMaxNumberInRange_(extractNumericValues_(val), 30, 600);
      if (value !== null) basics.benchBaseline = value;
    } else if (key.includes("deadlift baseline")) {
      const value = pickMaxNumberInRange_(extractNumericValues_(val), 30, 600);
      if (value !== null) basics.deadliftBaseline = value;
    }
  }
}

function parseBasicsFromCalendarInfoSheet_(sheet, basics) {
  const data = sheet.getDataRange().getDisplayValues();
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    for (let c = 0; c < row.length; c++) {
      const key = normalizeHeader(row[c]);
      if (!key) continue;

      if (key === "gender" || key === "sex") {
        const parsedSex = parseSexValue_(row[c + 1]);
        if (parsedSex) basics.sex = parsedSex;
      }

      if (key.includes("starting bw") || key.includes("starting bodyweight")) {
        const bw = pickFirstNumberInRange_(extractNumericValues_(row[c + 1]), 30, 250);
        if (bw !== null) basics.bodyweight = bw;
      } else if (key.includes("bodyweight")) {
        const bw = pickFirstNumberInRange_(extractNumericValues_(row[c + 1]), 30, 250);
        if (bw !== null) basics.bodyweight = bw;
      } else if (key === "weight class" && basics.bodyweight === 80) {
        const bw = pickFirstNumberInRange_(extractNumericValues_(row[c + 1]), 30, 250);
        if (bw !== null) basics.bodyweight = bw;
      }

      const lift = canonicalLiftFromLabel_(key);
      if (lift) {
        const rowNumbers = [];
        for (let i = 0; i < row.length; i++) {
          const values = extractNumericValues_(row[i]);
          for (let j = 0; j < values.length; j++) rowNumbers.push(values[j]);
        }
        const baseline = pickMaxNumberInRange_(rowNumbers, 30, 600);
        if (baseline !== null) {
          basics[lift + "Baseline"] = baseline;
        }
      }
    }
  }
}

/**
 * Get config with two-tier cache: in-memory memo → CacheService → Sheets read.
 * TTL: 10 minutes (config rarely changes).
 */
function getConfig(forceRefresh) {
  const CACHE_KEY = "APP_CONFIG";

  // Tier 1: in-memory memo (free, same execution context)
  if (!forceRefresh) {
    const memo = getMemo(CACHE_KEY);
    if (memo) return memo;

    // Tier 2: CacheService (persists across executions)
    const cached = getCachedData(CACHE_KEY);
    if (cached) return setMemo(CACHE_KEY, cached);
  }

  const ss = getSourceSpreadsheet_();
  const configSheet = ss.getSheetByName("Config");
  const config = createDefaultConfig_();

  if (!configSheet) {
    setCachedData(CACHE_KEY, config, 600);
    return setMemo(CACHE_KEY, config);
  }

  const data = configSheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    const key = data[i][0];
    const val = data[i][1];
    if (key && typeof key === "string") {
      const trimmedKey = key.trim();
      if (
        trimmedKey.startsWith("DOTS_") ||
        trimmedKey.startsWith("WILKS_") ||
        trimmedKey.startsWith("GLPOINTS_")
      ) {
        try {
          config.coefficients[trimmedKey] = JSON.parse(val);
        } catch (e) {
          console.warn("Invalid JSON for key " + trimmedKey);
        }
      } else if (trimmedKey === "disableWrites") {
        config.disableWrites = String(val).toLowerCase() === "true";
      }
    }
  }

  setCachedData(CACHE_KEY, config, 600); // 10 min TTL
  return setMemo(CACHE_KEY, config);
}

function setConfig(updates) {
  const ss = getSourceSpreadsheet_();
  let configSheet = ss.getSheetByName("Config");
  if (!configSheet) {
    configSheet = ss.insertSheet("Config");
    configSheet.appendRow(["Key", "Value"]);
  }

  const data = configSheet.getDataRange().getValues();
  const keyMap = {};
  for (let i = 1; i < data.length; i++) {
    keyMap[data[i][0]] = i + 1; // 1-based row index
  }

  for (const key in updates) {
    const stringVal = typeof updates[key] === "object" ? JSON.stringify(updates[key]) : updates[key];
    if (keyMap[key]) {
      configSheet.getRange(keyMap[key], 2).setValue(stringVal);
    } else {
      configSheet.appendRow([key, stringVal]);
      keyMap[key] = configSheet.getLastRow();
    }
  }

  // Bust caches after write
  removeCachedData("APP_CONFIG");
  return getConfig(true);
}

/**
 * Get basics with two-tier cache: in-memory memo → CacheService → Sheets read.
 * TTL: 10 minutes (bodyweight/sex rarely change mid-session).
 */
function getBasics(forceRefresh) {
  const CACHE_KEY = "APP_BASICS";

  if (!forceRefresh) {
    const memo = getMemo(CACHE_KEY);
    if (memo) return memo;

    const cached = getCachedData(CACHE_KEY);
    if (cached) return setMemo(CACHE_KEY, cached);
  }

  const basics = createDefaultBasics_();
  const ss = getSourceSpreadsheet_();
  const basicsSheet = ss.getSheetByName("BASICS");

  if (basicsSheet) {
    applyBasicsFromBasicsSheet_(basicsSheet, basics);
  } else {
    const calendarInfoSheet = ss.getSheetByName(CALENDAR_INFO_SHEET_NAME);
    if (calendarInfoSheet) {
      parseBasicsFromCalendarInfoSheet_(calendarInfoSheet, basics);
    }
  }

  setCachedData(CACHE_KEY, basics, 600); // 10 min TTL
  return setMemo(CACHE_KEY, basics);
}
