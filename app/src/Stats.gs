// Stats.gs

function computeE1RM_Epley(weight, reps) {
  if (!weight || !reps || reps <= 0) return null;
  const res = weight * (1 + reps / 30);
  return Math.round(res * 100) / 100;
}

function computeDots(totalKg, bwKg, sex = "male", coeffs) {
  if (!totalKg || !bwKg) return 0;
  const c = coeffs[`DOTS_${sex}`];
  if (!c) return 0;
  const denominator = c.a + c.b * bwKg + c.c * Math.pow(bwKg, 2) + c.d * Math.pow(bwKg, 3) + c.e * Math.pow(bwKg, 4);
  return (totalKg * 500) / denominator;
}

function computeWilks(totalKg, bwKg, sex = "male", coeffs) {
  if (!totalKg || !bwKg) return 0;
  const c = coeffs[`WILKS_${sex}`];
  if (!c) return 0;
  const denominator = c.a + c.b * bwKg + c.c * Math.pow(bwKg, 2) + c.d * Math.pow(bwKg, 3) + c.e * Math.pow(bwKg, 4) + (c.f ? c.f * Math.pow(bwKg, 5) : 0);
  return (totalKg * 500) / denominator;
}

function computeGLPoints(totalKg, bwKg, sex = "male", coeffs) {
  if (!totalKg || !bwKg) return 0;
  const c = coeffs[`GLPOINTS_${sex}`];
  if (!c) return 0;
  return totalKg * 100 / (c.a - c.b * Math.exp(-c.c * bwKg));
}

function canonicalLiftKey_(exerciseText) {
  const lift = String(exerciseText || "").toLowerCase();
  if (!lift) return null;
  if (lift.includes("bench")) return "bench";
  if (lift.includes("squat")) return "squat";
  if (lift.includes("deadlift") || /\bdl\b/.test(lift)) return "deadlift";
  return null;
}

function parseNumericOrNull_(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

function hasWeekDayMetadata_(rows) {
  if (!rows || !rows.length) return false;
  const hasWeek = rows.some(function (row) {
    return parseInt(row.weekIndex, 10) > 0;
  });
  const hasDay = rows.some(function (row) {
    return parseInt(row.dayIndex, 10) > 0;
  });
  return hasWeek && hasDay;
}

function selectBetterPrimaryCandidate_(current, candidate) {
  if (!current) return candidate;
  if (candidate.loadKg > current.loadKg) return candidate;
  if (candidate.loadKg < current.loadKg) return current;

  const candE1 = candidate.e1rm || 0;
  const currE1 = current.e1rm || 0;
  if (candE1 > currE1) return candidate;
  if (candE1 < currE1) return current;

  const candDay = candidate.dayIndex || 999;
  const currDay = current.dayIndex || 999;
  if (candDay < currDay) return candidate;
  return current;
}

function summarizePrimaryLiftAcrossWeeks_(weeks, liftKey) {
  let start = null;
  let end = null;
  for (let i = 0; i < weeks.length; i++) {
    const point = weeks[i][liftKey];
    const load = parseNumericOrNull_(point ? point.loadKg : null);
    if (load === null) continue;
    if (start === null) start = load;
    end = load;
  }

  if (start === null || end === null) {
    return { start: null, end: null, delta: 0, deltaPct: 0 };
  }

  const delta = end - start;
  return {
    start: start,
    end: end,
    delta: delta,
    deltaPct: start ? (delta / start) * 100 : 0
  };
}

function summarizeTimelineLift_(timeline, liftKey) {
  let start = null;
  let end = null;
  for (let i = 0; i < timeline.length; i++) {
    const entry = timeline[i][liftKey];
    const load = parseNumericOrNull_(entry ? entry.loadKg : null);
    if (load === null) continue;
    if (start === null) start = load;
    end = load;
  }

  if (start === null || end === null) {
    return { start: null, end: null, delta: 0, deltaPct: 0 };
  }

  const delta = end - start;
  return {
    start: start,
    end: end,
    delta: delta,
    deltaPct: start ? (delta / start) * 100 : 0
  };
}

function computePrimaryLiftProgressForRows_(rows) {
  const safeRows = rows || [];
  const dayLiftBest = {};

  for (let i = 0; i < safeRows.length; i++) {
    const row = safeRows[i];
    const lift = canonicalLiftKey_(row.exercise);
    const weekIndex = parseInt(row.weekIndex, 10);
    const dayIndex = parseInt(row.dayIndex, 10);
    const loadKg = parseNumericOrNull_(row.actualLoadKg);
    const e1rm = parseNumericOrNull_(row.e1rm);

    if (!lift || !weekIndex || weekIndex <= 0) continue;
    if (loadKg === null || loadKg <= 0) continue;

    const normalizedDayIndex = !isNaN(dayIndex) && dayIndex > 0 ? dayIndex : null;
    const dayLabel =
      row.dayLabel || (normalizedDayIndex ? "Day " + normalizedDayIndex : "Day ?");
    const dayKey = normalizedDayIndex !== null ? String(normalizedDayIndex) : dayLabel;
    const key = weekIndex + "|" + lift + "|" + dayKey;

    const candidate = {
      loadKg: loadKg,
      e1rm: e1rm,
      dayIndex: normalizedDayIndex,
      dayLabel: dayLabel,
      rowIndex: parseInt(row.rowIndex, 10) || null,
      exercise: String(row.exercise || "")
    };

    dayLiftBest[key] = selectBetterPrimaryCandidate_(dayLiftBest[key], candidate);
  }

  const weekLiftBest = {};
  for (const key in dayLiftBest) {
    const pieces = key.split("|");
    const weekIndex = parseInt(pieces[0], 10);
    const lift = pieces[1];
    const weekLiftKey = weekIndex + "|" + lift;
    weekLiftBest[weekLiftKey] = selectBetterPrimaryCandidate_(
      weekLiftBest[weekLiftKey],
      dayLiftBest[key]
    );
  }

  const weeksSet = {};
  for (const key in weekLiftBest) {
    const weekIndex = parseInt(key.split("|")[0], 10);
    if (!isNaN(weekIndex)) weeksSet[weekIndex] = true;
  }
  const orderedWeeks = Object.keys(weeksSet)
    .map(function (n) {
      return parseInt(n, 10);
    })
    .sort(function (a, b) {
      return a - b;
    });

  const weeks = orderedWeeks.map(function (weekIndex) {
    return {
      weekIndex: weekIndex,
      squat: weekLiftBest[weekIndex + "|squat"] || null,
      bench: weekLiftBest[weekIndex + "|bench"] || null,
      deadlift: weekLiftBest[weekIndex + "|deadlift"] || null
    };
  });

  return {
    weeks: weeks,
    labels: weeks.map(function (week) {
      return "W" + week.weekIndex;
    }),
    series: {
      squat: weeks.map(function (week) {
        return week.squat ? week.squat.loadKg : null;
      }),
      bench: weeks.map(function (week) {
        return week.bench ? week.bench.loadKg : null;
      }),
      deadlift: weeks.map(function (week) {
        return week.deadlift ? week.deadlift.loadKg : null;
      })
    },
    summary: {
      squat: summarizePrimaryLiftAcrossWeeks_(weeks, "squat"),
      bench: summarizePrimaryLiftAcrossWeeks_(weeks, "bench"),
      deadlift: summarizePrimaryLiftAcrossWeeks_(weeks, "deadlift")
    }
  };
}

function blockSortForProgress_(a, b) {
  const aNum = parseInt(a.blockNum, 10);
  const bNum = parseInt(b.blockNum, 10);
  const aHasNum = !isNaN(aNum);
  const bHasNum = !isNaN(bNum);

  if (aHasNum && bHasNum && aNum !== bNum) return aNum - bNum;
  if (aHasNum && !bHasNum) return -1;
  if (!aHasNum && bHasNum) return 1;

  const aName = String(a.name || "").toLowerCase();
  const bName = String(b.name || "").toLowerCase();
  const phaseRank = function (name) {
    if (name.includes("intro")) return 0;
    if (name.includes("continuation")) return 1;
    return 2;
  };
  const phaseDiff = phaseRank(aName) - phaseRank(bName);
  if (phaseDiff !== 0) return phaseDiff;
  return aName.localeCompare(bName);
}

function shortBlockLabelForProgress_(block) {
  const blockNum = block && block.blockNum ? "B" + block.blockNum : "Block";
  const name = String((block && block.name) || "").toLowerCase();
  if (name.includes("intro")) return blockNum + "i";
  if (name.includes("continuation")) return blockNum + "c";
  return blockNum;
}

function computeOverallPrimaryProgress(forceRefresh) {
  const CACHE_KEY = "OVERALL_PRIMARY_PROGRESS";

  if (!forceRefresh) {
    const memo = getMemo(CACHE_KEY);
    if (memo) return memo;
    const cached = getCachedData(CACHE_KEY);
    if (cached) return setMemo(CACHE_KEY, cached);
  }

  const blocks = getAvailableBlocks(forceRefresh)
    .filter(function (block) {
      return block && block.isBlock;
    })
    .sort(blockSortForProgress_);

  const timeline = [];
  const blocksProgress = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    let blockData = getBlockData(block.name, forceRefresh);

    // Backfill stale DB snapshots that do not include week/day metadata.
    if (!forceRefresh && !hasWeekDayMetadata_(blockData.rows || [])) {
      blockData = getBlockData(block.name, true);
    }

    const primary = computePrimaryLiftProgressForRows_(blockData.rows || []);
    blocksProgress.push({
      blockName: block.name,
      blockNum: block.blockNum || "",
      weeks: primary.weeks,
      summary: primary.summary
    });

    for (let w = 0; w < primary.weeks.length; w++) {
      const week = primary.weeks[w];
      const shortLabel = shortBlockLabelForProgress_(block);
      timeline.push({
        label: shortLabel + " W" + week.weekIndex,
        blockName: block.name,
        blockNum: block.blockNum || "",
        weekIndex: week.weekIndex,
        squat: week.squat,
        bench: week.bench,
        deadlift: week.deadlift
      });
    }
  }

  const result = {
    timeline: timeline,
    blocks: blocksProgress,
    summary: {
      squat: summarizeTimelineLift_(timeline, "squat"),
      bench: summarizeTimelineLift_(timeline, "bench"),
      deadlift: summarizeTimelineLift_(timeline, "deadlift")
    }
  };

  setCachedData(CACHE_KEY, result, 300);
  return setMemo(CACHE_KEY, result);
}

function computeAllStats(blockData, basics, config) {
  const coeffs = config.coefficients;
  const bw = basics.bodyweight || 80;
  const sex = basics.sex || "male";
  
  const lifts = ["squat", "bench", "deadlift"];
  const currentMaxes = { squat: 0, bench: 0, deadlift: 0 };
  const projectedMaxes = { squat: 0, bench: 0, deadlift: 0 };
  
  if (blockData.peakE1RMs) {
    for (const lift of lifts) {
      if (blockData.peakE1RMs[lift]) {
        projectedMaxes[lift] = blockData.peakE1RMs[lift];
      }
    }
  }
  
  for (const row of blockData.rows) {
    const canonical = canonicalLiftKey_(row.exercise);
    
    if (canonical) {
      const actualLoad = parseNumericOrNull_(row.actualLoadKg);
      if (actualLoad !== null && actualLoad > currentMaxes[canonical]) {
        currentMaxes[canonical] = actualLoad;
      }
      const e1rm = parseNumericOrNull_(row.e1rm);
      if (e1rm !== null && !blockData.peakE1RMs?.[canonical]) {
         if (e1rm > projectedMaxes[canonical]) {
           projectedMaxes[canonical] = e1rm;
         }
      }
    }
  }
  
  const currentTotal = Math.round(currentMaxes.squat + currentMaxes.bench + currentMaxes.deadlift);
  const projectedTotal = Math.round(projectedMaxes.squat + projectedMaxes.bench + projectedMaxes.deadlift);
  
  const stats = {
    current: {
      total: currentTotal,
      dots: computeDots(currentTotal, bw, sex, coeffs),
      wilks: computeWilks(currentTotal, bw, sex, coeffs),
      gl: computeGLPoints(currentTotal, bw, sex, coeffs)
    },
    projected: {
      total: projectedTotal,
      dots: computeDots(projectedTotal, bw, sex, coeffs),
      wilks: computeWilks(projectedTotal, bw, sex, coeffs),
      gl: computeGLPoints(projectedTotal, bw, sex, coeffs)
    },
    growth: {}
  };
  
  let totalBaseline = 0;
  for (const lift of lifts) {
    const baseline = basics[`${lift}Baseline`] || 0;
    totalBaseline += baseline;
    const current = projectedMaxes[lift];
    let diff = current - baseline;
    let pct = baseline ? (diff / baseline) * 100 : 0;
    
    stats.growth[lift] = {
      baseline: baseline,
      projected: current,
      delta: diff,
      deltaPct: pct
    };
  }
  
  const totalDiff = projectedTotal - totalBaseline;
  stats.growth.total = {
    baseline: totalBaseline,
    projected: projectedTotal,
    delta: totalDiff,
    deltaPct: totalBaseline ? (totalDiff / totalBaseline) * 100 : 0
  };

  stats.primaryByWeek = computePrimaryLiftProgressForRows_(blockData.rows || []);
  
  return stats;
}
