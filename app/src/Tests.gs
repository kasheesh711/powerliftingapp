// Tests.gs

function runAllTests() {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const results = [];

  function assertEqual(actual, expected, msg) {
    let matches = actual === expected;
    if (typeof actual === "number" && typeof expected === "number") {
      matches = Math.abs(actual - expected) < 1e-9;
    }
    if (matches) {
      passed++;
      results.push("PASS: " + msg);
    } else {
      failed++;
      results.push("FAIL: " + msg + " | Expected " + expected + ", got " + actual);
    }
  }

  function assertTrue(cond, msg) {
    if (cond) {
      passed++;
      results.push("PASS: " + msg);
    } else {
      failed++;
      results.push("FAIL: " + msg);
    }
  }

  function assertThrows(fn, messageContains, msg) {
    let threw = false;
    try {
      fn();
    } catch (e) {
      threw = true;
      if (messageContains && String(e).indexOf(messageContains) === -1) {
        failed++;
        results.push(
          "FAIL: " + msg + " | Expected error containing '" + messageContains + "', got: " + e
        );
        return;
      }
    }

    if (threw) {
      passed++;
      results.push("PASS: " + msg);
    } else {
      failed++;
      results.push("FAIL: " + msg + " | Expected an exception");
    }
  }

  function skip(msg) {
    skipped++;
    results.push("SKIP: " + msg);
  }

  // 1) Regex tests
  const blockRegex = /\bblock\s*(\d+)(?:\s*(?:\(|year)?\s*\d{4}?\)?)?/i;
  assertTrue(blockRegex.test("Block 5"), "Regex match 'Block 5'");
  assertTrue(blockRegex.test("Block 4 (2026)"), "Regex match 'Block 4 (2026)'");
  assertTrue(blockRegex.test("Block 4 Year"), "Regex match 'Block 4 Year'");
  assertTrue(/\brecap\b/i.test("Block Recap"), "Regex match 'Block Recap'");

  // 2) E1RM fallback
  assertEqual(computeE1RM_Epley(100, 3), 110, "E1RM Epley 100x3");

  // 3) Scoring wrappers
  const dummyCoeffs = {
    DOTS_male: { a: -307, b: 24, c: -0.19, d: 0.0007, e: -0.000001 }
  };
  const dotsRes = computeDots(100, 80, "male", dummyCoeffs);
  assertTrue(dotsRes > 0, "DOTS should compute a positive number");

  // 4) Numeric extraction helper tests
  assertEqual(
    JSON.stringify(extractNumericValues_("140 @ 8")),
    JSON.stringify([140, 8]),
    "extractNumericValues_ parses mixed string values"
  );
  assertEqual(
    JSON.stringify(extractNumericValues_("60Kg / July 18,2025")),
    JSON.stringify([60, 18, 2025]),
    "extractNumericValues_ parses BW/date mixed value"
  );

  // 5) Primary-day weekly progress extraction
  const mockPrimaryRows = [
    { exercise: "Competition Squat", weekIndex: 1, dayIndex: 1, dayLabel: "Day 1", actualLoadKg: 100, e1rm: 110 },
    { exercise: "Squat", weekIndex: 1, dayIndex: 2, dayLabel: "Day 2", actualLoadKg: 120, e1rm: 132 },
    { exercise: "Bench Press", weekIndex: 1, dayIndex: 1, dayLabel: "Day 1", actualLoadKg: 70, e1rm: 77 },
    { exercise: "Bench Press", weekIndex: 1, dayIndex: 2, dayLabel: "Day 2", actualLoadKg: 75, e1rm: 83 },
    { exercise: "Deadlift", weekIndex: 1, dayIndex: 3, dayLabel: "Day 3", actualLoadKg: 150, e1rm: 165 },
    { exercise: "Squat", weekIndex: 2, dayIndex: 1, dayLabel: "Day 1", actualLoadKg: 125, e1rm: 137.5 },
    { exercise: "Deadlift", weekIndex: 2, dayIndex: 2, dayLabel: "Day 2", actualLoadKg: 155, e1rm: 170.5 }
  ];
  const mockPrimaryProgress = computePrimaryLiftProgressForRows_(mockPrimaryRows);
  assertTrue(hasWeekDayMetadata_(mockPrimaryRows), "hasWeekDayMetadata_ detects week/day metadata");
  assertEqual(mockPrimaryProgress.weeks.length, 2, "Primary progress groups rows by week");
  assertEqual(
    mockPrimaryProgress.weeks[0].squat.dayIndex,
    2,
    "Week 1 squat primary day selected by heaviest day"
  );
  assertEqual(
    mockPrimaryProgress.weeks[0].bench.loadKg,
    75,
    "Week 1 bench primary load uses highest bench day"
  );
  assertEqual(
    mockPrimaryProgress.summary.squat.delta,
    5,
    "Primary progress summary computes week-over-week squat delta"
  );

  // 6) Source resolver tests
  const props = PropertiesService.getScriptProperties();
  const previousSourceId = props.getProperty("SOURCE_SPREADSHEET_ID");
  try {
    const info = getSourceSpreadsheetInfo_();
    assertTrue(!!info && !!info.source, "getSourceSpreadsheetInfo_ returns source metadata");
    if (!info.spreadsheet) {
      skip("No spreadsheet context available for source resolution test");
    } else {
      props.setProperty("SOURCE_SPREADSHEET_ID", info.spreadsheet.getId());
      const resolved = getSourceSpreadsheet_();
      assertEqual(
        resolved.getId(),
        info.spreadsheet.getId(),
        "getSourceSpreadsheet_ resolves via SOURCE_SPREADSHEET_ID"
      );
    }
  } catch (e) {
    failed++;
    results.push("FAIL: Source resolver test failed unexpectedly | " + e);
  } finally {
    if (previousSourceId) props.setProperty("SOURCE_SPREADSHEET_ID", previousSourceId);
    else props.deleteProperty("SOURCE_SPREADSHEET_ID");
  }

  // 7) Invalid SOURCE_SPREADSHEET_ID should fail clearly
  const previousForInvalid = props.getProperty("SOURCE_SPREADSHEET_ID");
  try {
    props.setProperty("SOURCE_SPREADSHEET_ID", "invalid-id-for-test");
    assertThrows(
      function () {
        getSourceSpreadsheet_();
      },
      "SOURCE_SPREADSHEET_ID",
      "getSourceSpreadsheet_ throws a clear error for invalid SOURCE_SPREADSHEET_ID"
    );
  } finally {
    if (previousForInvalid) props.setProperty("SOURCE_SPREADSHEET_ID", previousForInvalid);
    else props.deleteProperty("SOURCE_SPREADSHEET_ID");
  }

  // 8) Basics fallback parser from Calendar sheet
  try {
    const ss = getSourceSpreadsheet_();
    const fallbackSheet = ss.getSheetByName(CALENDAR_INFO_SHEET_NAME);
    if (!fallbackSheet) {
      skip("Calendar info sheet not found; skipping basics fallback parser test");
    } else {
      const basics = createDefaultBasics_();
      parseBasicsFromCalendarInfoSheet_(fallbackSheet, basics);
      assertTrue(!!basics.sex, "Fallback parser sets sex");
      assertTrue(!!basics.bodyweight && basics.bodyweight > 0, "Fallback parser sets bodyweight");
      assertTrue(
        (basics.squatBaseline || 0) > 0,
        "Fallback parser sets squat baseline from PR row"
      );
      assertTrue(
        (basics.benchBaseline || 0) > 0,
        "Fallback parser sets bench baseline from PR row"
      );
      assertTrue(
        (basics.deadliftBaseline || 0) > 0,
        "Fallback parser sets deadlift baseline from PR row"
      );
    }
  } catch (e) {
    failed++;
    results.push("FAIL: Basics fallback test failed unexpectedly | " + e);
  }

  // 9) Hybrid fallback + force refresh integration test
  try {
    const ss = getSourceSpreadsheet_();
    const blocks = getAvailableBlocks(true).filter(function (b) {
      return b.isBlock;
    });
    if (!blocks.length) {
      skip("No block sheets found; skipping hybrid fallback integration test");
    } else {
      const blockName = blocks[0].name;

      // Ensure DB has a baseline snapshot first.
      const baselineParsed = parseBlockFromVisualSheet(blockName);
      upsertBlockToDB_(blockName, baselineParsed, ss);

      const dbBlocks = ss.getSheetByName(DB_BLOCKS_SHEET_NAME);
      const dbData = dbBlocks.getDataRange().getValues();
      const keptRows = [];
      let removedRows = 0;
      for (let i = 1; i < dbData.length; i++) {
        const row = dbData[i];
        if (row[0] === blockName) removedRows++;
        else if (row[0]) {
          const normalized = [];
          for (let c = 0; c < DB_BLOCKS_HEADERS.length; c++) {
            normalized.push(row[c] === undefined ? "" : row[c]);
          }
          keptRows.push(normalized);
        }
      }

      if (removedRows === 0) {
        skip("No existing DB rows for selected block; skipping DB row removal simulation");
      } else {
        clearDataRows_(dbBlocks, DB_BLOCKS_HEADERS.length);
        if (keptRows.length > 0) {
          dbBlocks
            .getRange(2, 1, keptRows.length, DB_BLOCKS_HEADERS.length)
            .setValues(keptRows);
        }

        removeCachedData("BLOCK_DB_" + blockName);
        const repaired = getBlockData(blockName, false);
        assertTrue(
          repaired.rows && repaired.rows.length > 0,
          "getBlockData reparses visual sheet when DB rows are missing"
        );

        const dbAfter = dbBlocks.getDataRange().getValues();
        let restoredRows = 0;
        for (let i = 1; i < dbAfter.length; i++) {
          if (dbAfter[i][0] === blockName) restoredRows++;
        }
        assertTrue(restoredRows > 0, "Block DB rows are restored after fallback repair");
      }

      const forceData = loadDashboardData(blockName, true);
      assertTrue(
        forceData &&
          forceData.blockData &&
          forceData.blockData.rows &&
          forceData.blockData.rows.length > 0,
        "loadDashboardData(force=true) returns live block rows"
      );
    }
  } catch (e) {
    failed++;
    results.push("FAIL: Hybrid fallback/force refresh test failed unexpectedly | " + e);
  }

  // 10) Block parser day/week autodetection integration
  try {
    const ss = getSourceSpreadsheet_();
    const expectedPlannedWeeks = {
      "Block 2": 4,
      "Block 3": 4,
      "Block 4 (2026)": 4,
      "Block 5": 5,
      "Block 1 (continuation)": 5,
      "Block 1 - Introductory ": 7,
      "Block 3 (Data)": 8
    };

    const basics = getBasics();
    const config = getConfig();
    let checkedBlocks = 0;

    for (const blockName in expectedPlannedWeeks) {
      const sheet = ss.getSheetByName(blockName);
      if (!sheet) {
        skip("Missing expected test sheet '" + blockName + "'; skipping parser checks for this block");
        continue;
      }

      checkedBlocks++;
      const parsed = parseBlockFromVisualSheet(blockName);
      const report = parsed.parserReport || {};

      assertTrue(
        parsed.rows && parsed.rows.length > 0,
        "parseBlockFromVisualSheet returns rows for " + blockName
      );

      const sampleWithMeta = (parsed.rows || []).find(function (row) {
        return (
          parseInt(row.dayIndex, 10) > 0 &&
          parseInt(row.weekIndex, 10) > 0 &&
          String(row.weekLabel || "").length > 0 &&
          String(row.dayLabel || "").length > 0
        );
      });
      assertTrue(!!sampleWithMeta, "Parsed rows include day/week metadata for " + blockName);

      const hasLegacyGroupLabel = (parsed.rows || []).some(function (row) {
        return /starting col/i.test(String(row.groupLabel || ""));
      });
      assertTrue(!hasLegacyGroupLabel, "Group labels are normalized for " + blockName);

      assertEqual(
        report.activeDays,
        4,
        "Parser detects 4 active days for " + blockName
      );
      assertEqual(
        report.plannedWeekCount,
        expectedPlannedWeeks[blockName],
        "Parser detects planned week count for " + blockName
      );

      const stats = computeAllStats(parsed, basics, config);
      assertTrue(
        !!stats && !!stats.current && !!stats.projected,
        "Stats computation still works for " + blockName
      );
    }

    if (checkedBlocks === 0) {
      skip("No expected block sheets found for parser day/week autodetection integration test");
    } else {
      const block3Data = parseBlockFromVisualSheet("Block 3 (Data)");
      const block3Report = block3Data.parserReport || {};
      assertTrue(
        (block3Report.activeWeekCount || 0) < (block3Report.plannedWeekCount || 0),
        "Block 3 (Data) identifies inactive trailing weeks"
      );

      const block5 = parseBlockFromVisualSheet("Block 5");
      const hasAccessory = (block5.rows || []).some(function (row) {
        return !/(squat|bench|deadlift)/i.test(String(row.exercise || ""));
      });
      assertTrue(
        hasAccessory,
        "Parser includes accessory exercises for complete workout coverage"
      );
    }
  } catch (e) {
    failed++;
    results.push("FAIL: Parser day/week autodetection integration failed unexpectedly | " + e);
  }

  console.log("Passed: " + passed + ", Failed: " + failed + ", Skipped: " + skipped);
  for (let i = 0; i < results.length; i++) console.log(results[i]);

  return { passed: passed, failed: failed, skipped: skipped, results: results };
}
