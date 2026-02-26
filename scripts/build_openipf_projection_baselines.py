#!/usr/bin/env python3
"""Build compact OpenIPF calibration baselines for meet projection modeling."""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Dict, Iterable, List, MutableMapping, Optional, Tuple

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "openipf-2026-02-21" / "openipf-2026-02-21-6461ed68.csv"
DEFAULT_OUTPUT = ROOT / "apps" / "web" / "src" / "components" / "dashboard" / "data" / "openipf-projection-baselines.json"

LOW_PERCENTILE = 0.05
HIGH_PERCENTILE = 0.95
MIN_WEEKS = 8.0
MAX_WEEKS = 104.0

SEX_MAP = {"M": "male", "F": "female"}
MODERN_CLASSES: Dict[str, List[str]] = {
    "male": ["53", "59", "66", "74", "83", "93", "105", "120", "120+"],
    "female": ["43", "47", "52", "57", "63", "69", "76", "84", "84+"],
}


@dataclass(frozen=True)
class MeetRecord:
    meet_date: date
    weight_class: str
    squat: float
    bench: float
    deadlift: float
    total: float


@dataclass(frozen=True)
class TransitionRecord:
    squat: float
    bench: float
    deadlift: float
    total: float


def parse_float(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    value = value.strip()
    if value == "":
        return None
    try:
        parsed = float(value)
    except ValueError:
        return None
    if parsed != parsed:  # NaN
        return None
    return parsed


def parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def map_weight_class(raw_weight_class: str, sex: str) -> Optional[str]:
    if sex not in MODERN_CLASSES:
        return None

    classes = MODERN_CLASSES[sex]
    numeric_classes = [label for label in classes if not label.endswith("+")]
    top_plus = next((label for label in classes if label.endswith("+")), None)

    value = raw_weight_class.strip()
    if not value:
        return None

    if value.endswith("+"):
        return top_plus

    numeric = parse_float(value)
    if numeric is None:
        return None

    best_label = None
    best_delta = None
    best_center = None
    for label in numeric_classes:
        center = float(label)
        delta = abs(numeric - center)
        if (
            best_delta is None
            or delta < best_delta
            or (delta == best_delta and best_center is not None and center < best_center)
        ):
            best_label = label
            best_delta = delta
            best_center = center

    return best_label


def quantile(sorted_values: List[float], percentile: float) -> float:
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    index = (len(sorted_values) - 1) * percentile
    low = int(index)
    high = min(low + 1, len(sorted_values) - 1)
    fraction = index - low
    return sorted_values[low] * (1.0 - fraction) + sorted_values[high] * fraction


def winsorized_mean(values: Iterable[float]) -> float:
    points = list(values)
    if not points:
        return 0.0
    sorted_values = sorted(points)
    low = quantile(sorted_values, LOW_PERCENTILE)
    high = quantile(sorted_values, HIGH_PERCENTILE)
    clipped = [min(max(value, low), high) for value in sorted_values]
    return float(mean(clipped))


def build_baselines(source_csv: Path) -> dict:
    athlete_meets: MutableMapping[Tuple[str, str], Dict[date, MeetRecord]] = defaultdict(dict)

    row_stats = {
        "rowsTotal": 0,
        "rowsAfterEventEquipmentFilter": 0,
        "rowsWithValidLiftsAndDate": 0,
        "rowsMappedToModernClass": 0,
        "rowsRejectedMissingFields": 0,
    }

    with source_csv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            row_stats["rowsTotal"] += 1

            if row.get("Event") != "SBD" or row.get("Equipment") != "Raw":
                continue
            row_stats["rowsAfterEventEquipmentFilter"] += 1

            sex_raw = (row.get("Sex") or "").strip()
            sex = SEX_MAP.get(sex_raw)
            name = (row.get("Name") or "").strip()
            if not sex or not name:
                row_stats["rowsRejectedMissingFields"] += 1
                continue

            meet_date = parse_date(row.get("Date"))
            squat = parse_float(row.get("Best3SquatKg"))
            bench = parse_float(row.get("Best3BenchKg"))
            deadlift = parse_float(row.get("Best3DeadliftKg"))
            total = parse_float(row.get("TotalKg"))
            if meet_date is None or squat is None or bench is None or deadlift is None or total is None:
                row_stats["rowsRejectedMissingFields"] += 1
                continue
            row_stats["rowsWithValidLiftsAndDate"] += 1

            mapped_class = map_weight_class(row.get("WeightClassKg") or "", sex)
            if mapped_class is None:
                continue
            row_stats["rowsMappedToModernClass"] += 1

            key = (sex, name)
            existing = athlete_meets[key].get(meet_date)
            candidate = MeetRecord(
                meet_date=meet_date,
                weight_class=mapped_class,
                squat=squat,
                bench=bench,
                deadlift=deadlift,
                total=total,
            )
            if existing is None or candidate.total > existing.total:
                athlete_meets[key][meet_date] = candidate

    class_transitions: MutableMapping[Tuple[str, str, int], List[TransitionRecord]] = defaultdict(list)
    sex_transitions: MutableMapping[Tuple[str, int], List[TransitionRecord]] = defaultdict(list)
    athlete_transition_stats = {"athletesWithOneMeetOrLess": 0, "transitionsAccepted": 0, "transitionsRejectedByInterval": 0}

    for (sex, _name), by_date in athlete_meets.items():
        meets = [by_date[d] for d in sorted(by_date.keys())]
        if len(meets) <= 1:
            athlete_transition_stats["athletesWithOneMeetOrLess"] += 1
            continue

        for index in range(len(meets) - 1):
            current = meets[index]
            nxt = meets[index + 1]
            days = (nxt.meet_date - current.meet_date).days
            if days <= 0:
                athlete_transition_stats["transitionsRejectedByInterval"] += 1
                continue

            weeks = days / 7.0
            if weeks < MIN_WEEKS or weeks > MAX_WEEKS:
                athlete_transition_stats["transitionsRejectedByInterval"] += 1
                continue

            transition = index + 1  # n -> n+1
            record = TransitionRecord(
                squat=(nxt.squat - current.squat) / weeks,
                bench=(nxt.bench - current.bench) / weeks,
                deadlift=(nxt.deadlift - current.deadlift) / weeks,
                total=(nxt.total - current.total) / weeks,
            )
            class_transitions[(sex, current.weight_class, transition)].append(record)
            sex_transitions[(sex, transition)].append(record)
            athlete_transition_stats["transitionsAccepted"] += 1

    def summarize_transition(records: List[TransitionRecord]) -> dict:
        squat_values = [record.squat for record in records]
        bench_values = [record.bench for record in records]
        deadlift_values = [record.deadlift for record in records]
        total_values = [record.total for record in records]

        return {
            "sampleSize": len(records),
            "rates": {
                "squat": max(0.0, winsorized_mean(squat_values)),
                "bench": max(0.0, winsorized_mean(bench_values)),
                "deadlift": max(0.0, winsorized_mean(deadlift_values)),
                "total": max(0.0, winsorized_mean(total_values)),
            },
        }

    sex_class_transition_rates: dict = {"male": {}, "female": {}}
    sex_transition_rates: dict = {"male": {}, "female": {}}
    max_transition_by_sex: dict = {"male": 1, "female": 1}

    for sex, classes in MODERN_CLASSES.items():
        class_map = {}
        for class_name in classes:
            transition_map = {}
            for (key_sex, key_class, transition), records in class_transitions.items():
                if key_sex != sex or key_class != class_name:
                    continue
                transition_map[str(transition)] = summarize_transition(records)
            class_map[class_name] = transition_map
        sex_class_transition_rates[sex] = class_map

        transition_map = {}
        for (key_sex, transition), records in sex_transitions.items():
            if key_sex != sex:
                continue
            transition_map[str(transition)] = summarize_transition(records)
            if transition > max_transition_by_sex[sex]:
                max_transition_by_sex[sex] = transition
        sex_transition_rates[sex] = transition_map

    class_centers = {
        sex: {label: float(label[:-1]) if label.endswith("+") else float(label) for label in classes}
        for sex, classes in MODERN_CLASSES.items()
    }

    return {
        "metadata": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "sourceCsv": str(source_csv.relative_to(ROOT)),
            "filters": {
                "event": "SBD",
                "equipment": "Raw",
                "requireBest3AndTotal": True,
                "dedupeKey": ["Sex", "Name", "Date"],
                "dedupeSelection": "maxTotalKg",
                "transitionWeeksMin": MIN_WEEKS,
                "transitionWeeksMax": MAX_WEEKS,
            },
            "percentiles": {"winsorizeLow": LOW_PERCENTILE, "winsorizeHigh": HIGH_PERCENTILE},
            "transitionRange": {"min": 1, "maxBySex": max_transition_by_sex},
            "rowStats": row_stats,
            "athleteTransitionStats": athlete_transition_stats,
        },
        "classes": MODERN_CLASSES,
        "classCentersKg": class_centers,
        "sexTransitionRates": sex_transition_rates,
        "sexClassTransitionRates": sex_class_transition_rates,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="OpenIPF CSV source path.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output JSON path.")
    args = parser.parse_args()

    source = args.source.resolve()
    output = args.output.resolve()
    if not source.exists():
        raise FileNotFoundError(f"OpenIPF source CSV not found: {source}")

    payload = build_baselines(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(f"Wrote OpenIPF projection baselines to: {output}")


if __name__ == "__main__":
    main()
