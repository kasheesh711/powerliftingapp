import type { BlockRow } from '@powerlifting/domain';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { BlockPrimaryProgressChart } from './charts/block-primary-progress-chart';
import { BlockComparisonChart } from './charts/block-comparison-chart';
import { MeetProjectionChart } from './charts/meet-projection-chart';
import { OverallPrimaryProgressChart } from './charts/overall-primary-progress-chart';
import {
  getDefaultSelectedWeightClasses,
  getOpenIpfWeightClassOptions,
  normalizeSelectedWeightClasses,
  type ProjectionSex,
} from './openipf-projection';
import type { DashboardViewProps } from './types';
import { buildDashboardAnalytics, buildMeetProjection, type CurrentPositionVM } from './view-models';

import styles from './dashboard-view.module.css';

const DEFAULT_MEET_DATE = '2026-11-07';
const STORAGE_KEYS = {
  meetDate: 'dashboard.meetDate',
  currentWeek: 'dashboard.currentWeek',
  currentDay: 'dashboard.currentDay',
  projectionSex: 'dashboard.projectionSex',
  projectionBodyweightKg: 'dashboard.projectionBodyweightKg',
  completedMeets: 'dashboard.completedMeets',
  selectedWeightClasses: 'dashboard.selectedWeightClasses',
  overrideSquatRate: 'dashboard.overrideSquatRate',
  overrideBenchRate: 'dashboard.overrideBenchRate',
  overrideDeadliftRate: 'dashboard.overrideDeadliftRate'
} as const;

function formatKg(value: number): string {
  return `${value.toFixed(1)} kg`;
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

function formatRate(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} kg/week`;
}

function readStoredInt(value: string | null): string {
  if (!value) {
    return '';
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return '';
  }

  return String(parsed);
}

function readStoredNonNegativeInt(value: string | null): string {
  if (!value) {
    return '';
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return '';
  }

  return String(parsed);
}

function readStoredNonNegativeFloat(value: string | null): string {
  if (!value) {
    return '';
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return '';
  }

  return String(parsed);
}

function parsePositiveFloat(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseNonNegativeInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function parseOptionalRate(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export function DashboardView(props: DashboardViewProps): JSX.Element {
  const {
    initial,
    payload,
    selectedBlock,
    onSelectedBlockChange,
    isLoading,
    isSaving,
    isPickerBusy,
    error,
    connectionError,
    conflictState,
    sessionEmail,
    isAuthenticated,
    selectedSpreadsheet,
    pickerConfig,
    selectionInput,
    dirtyUpdateCount,
    onSelectionInputChange,
    onSubmitManualSelection,
    onOpenDrivePicker,
    onForceRefresh,
    onSaveAll,
    onSaveRow,
    onDismissConflict,
    onReloadConflict,
    onOverwriteConflict,
    getPendingFieldValue,
    onPendingValueChange,
    getRowUpdates,
    getRowKey
  } = props;

  const [meetDate, setMeetDate] = useState(DEFAULT_MEET_DATE);
  const [manualWeek, setManualWeek] = useState('');
  const [manualDay, setManualDay] = useState('');
  const [projectionSex, setProjectionSex] = useState<ProjectionSex | ''>('');
  const [projectionBodyweightKg, setProjectionBodyweightKg] = useState('');
  const [completedMeets, setCompletedMeets] = useState('0');
  const [selectedWeightClasses, setSelectedWeightClasses] = useState<string[]>([]);
  const [overrideSquatRate, setOverrideSquatRate] = useState('');
  const [overrideBenchRate, setOverrideBenchRate] = useState('');
  const [overrideDeadliftRate, setOverrideDeadliftRate] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedMeetDate = window.localStorage.getItem(STORAGE_KEYS.meetDate);
    const storedWeek = window.localStorage.getItem(STORAGE_KEYS.currentWeek);
    const storedDay = window.localStorage.getItem(STORAGE_KEYS.currentDay);
    const storedProjectionSex = window.localStorage.getItem(STORAGE_KEYS.projectionSex);
    const storedBodyweightKg = window.localStorage.getItem(STORAGE_KEYS.projectionBodyweightKg);
    const storedCompletedMeets = window.localStorage.getItem(STORAGE_KEYS.completedMeets);
    const storedWeightClasses = window.localStorage.getItem(STORAGE_KEYS.selectedWeightClasses);
    const storedOverrideSquatRate = window.localStorage.getItem(STORAGE_KEYS.overrideSquatRate);
    const storedOverrideBenchRate = window.localStorage.getItem(STORAGE_KEYS.overrideBenchRate);
    const storedOverrideDeadliftRate = window.localStorage.getItem(STORAGE_KEYS.overrideDeadliftRate);

    if (storedMeetDate && /^\d{4}-\d{2}-\d{2}$/.test(storedMeetDate)) {
      setMeetDate(storedMeetDate);
    }

    setManualWeek(readStoredInt(storedWeek));
    setManualDay(readStoredInt(storedDay));

    if (storedProjectionSex === 'male' || storedProjectionSex === 'female') {
      setProjectionSex(storedProjectionSex);
    }

    setProjectionBodyweightKg(readStoredNonNegativeFloat(storedBodyweightKg));
    setCompletedMeets(readStoredNonNegativeInt(storedCompletedMeets) || '0');
    setOverrideSquatRate(readStoredNonNegativeFloat(storedOverrideSquatRate));
    setOverrideBenchRate(readStoredNonNegativeFloat(storedOverrideBenchRate));
    setOverrideDeadliftRate(readStoredNonNegativeFloat(storedOverrideDeadliftRate));

    if (storedWeightClasses) {
      try {
        const parsed = JSON.parse(storedWeightClasses);
        if (Array.isArray(parsed)) {
          const classes = parsed.filter((entry): entry is string => typeof entry === 'string');
          setSelectedWeightClasses(classes);
        }
      } catch {
        // Ignore malformed persisted class selection payloads.
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.meetDate, meetDate);

    if (manualWeek) {
      window.localStorage.setItem(STORAGE_KEYS.currentWeek, manualWeek);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.currentWeek);
    }

    if (manualDay) {
      window.localStorage.setItem(STORAGE_KEYS.currentDay, manualDay);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.currentDay);
    }

    if (projectionSex) {
      window.localStorage.setItem(STORAGE_KEYS.projectionSex, projectionSex);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.projectionSex);
    }

    if (projectionBodyweightKg.trim()) {
      window.localStorage.setItem(STORAGE_KEYS.projectionBodyweightKg, projectionBodyweightKg);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.projectionBodyweightKg);
    }

    window.localStorage.setItem(STORAGE_KEYS.completedMeets, completedMeets);
    window.localStorage.setItem(STORAGE_KEYS.selectedWeightClasses, JSON.stringify(selectedWeightClasses));

    if (overrideSquatRate.trim()) {
      window.localStorage.setItem(STORAGE_KEYS.overrideSquatRate, overrideSquatRate);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.overrideSquatRate);
    }

    if (overrideBenchRate.trim()) {
      window.localStorage.setItem(STORAGE_KEYS.overrideBenchRate, overrideBenchRate);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.overrideBenchRate);
    }

    if (overrideDeadliftRate.trim()) {
      window.localStorage.setItem(STORAGE_KEYS.overrideDeadliftRate, overrideDeadliftRate);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.overrideDeadliftRate);
    }
  }, [
    completedMeets,
    manualDay,
    manualWeek,
    meetDate,
    overrideBenchRate,
    overrideDeadliftRate,
    overrideSquatRate,
    projectionBodyweightKg,
    projectionSex,
    selectedWeightClasses
  ]);

  const blockOptions = useMemo(
    () => (initial?.blocks || []).filter((entry) => entry.isBlock).map((entry) => entry.name),
    [initial]
  );

  const rows = payload?.blockData.rows || [];
  const timeline = payload?.overallProgress.timeline || [];

  const analytics = useMemo(() => buildDashboardAnalytics(rows, payload?.overallProgress), [rows, payload?.overallProgress]);
  const modelSex: ProjectionSex =
    projectionSex === 'female' || projectionSex === 'male'
      ? projectionSex
      : payload?.basics.sex === 'female'
        ? 'female'
        : 'male';

  const weightClassOptions = useMemo(() => getOpenIpfWeightClassOptions(modelSex), [modelSex]);
  const activeWeightClasses = useMemo(() => {
    const normalized = normalizeSelectedWeightClasses(modelSex, selectedWeightClasses);
    return normalized.length ? normalized : getDefaultSelectedWeightClasses(modelSex);
  }, [modelSex, selectedWeightClasses]);

  const modelBodyweightKg = parsePositiveFloat(projectionBodyweightKg, payload?.basics.bodyweight || 80);
  const modelCompletedMeets = parseNonNegativeInt(completedMeets, 0);

  useEffect(() => {
    if (!payload) {
      return;
    }

    if (!projectionSex) {
      setProjectionSex(payload.basics.sex === 'female' ? 'female' : 'male');
    }

    if (!projectionBodyweightKg.trim() && Number.isFinite(payload.basics.bodyweight) && payload.basics.bodyweight > 0) {
      setProjectionBodyweightKg(String(payload.basics.bodyweight));
    }
  }, [payload, projectionBodyweightKg, projectionSex]);

  const weekOptions = useMemo(
    () =>
      analytics.weekSections
        .map((section) => section.weekIndex)
        .filter((value): value is number => value !== null),
    [analytics.weekSections]
  );

  const selectedWeekForDay = useMemo(() => {
    const parsed = Number.parseInt(manualWeek, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    return analytics.inferredPosition.weekIndex;
  }, [analytics.inferredPosition.weekIndex, manualWeek]);

  const dayOptions = useMemo(() => {
    if (selectedWeekForDay !== null) {
      const section = analytics.weekSections.find((entry) => entry.weekIndex === selectedWeekForDay);
      if (section) {
        return section.days
          .map((day) => day.dayIndex)
          .filter((value): value is number => value !== null);
      }
    }

    const all = analytics.weekSections.flatMap((section) => section.days.map((day) => day.dayIndex));
    return [...new Set(all)].filter((value): value is number => value !== null);
  }, [analytics.weekSections, selectedWeekForDay]);

  const currentPosition = useMemo<CurrentPositionVM>(() => {
    const parsedWeek = Number.parseInt(manualWeek, 10);
    const hasManualWeek = Number.isFinite(parsedWeek) && parsedWeek > 0;

    const parsedDay = Number.parseInt(manualDay, 10);
    const hasManualDay = Number.isFinite(parsedDay) && parsedDay > 0;

    const weekIndex = hasManualWeek ? parsedWeek : analytics.inferredPosition.weekIndex;
    let dayIndex = hasManualDay ? parsedDay : analytics.inferredPosition.dayIndex;

    if (hasManualWeek && !hasManualDay) {
      const section = analytics.weekSections.find((entry) => entry.weekIndex === parsedWeek);
      const firstDay = section?.days.find((day) => day.dayIndex !== null)?.dayIndex || null;
      dayIndex = firstDay || dayIndex;
    }

    return {
      weekIndex: weekIndex ?? null,
      dayIndex: dayIndex ?? null,
      source: hasManualWeek || hasManualDay ? 'manual' : 'inferred',
      completionPct: hasManualWeek || hasManualDay ? null : analytics.inferredPosition.completionPct
    };
  }, [analytics.inferredPosition, analytics.weekSections, manualDay, manualWeek]);

  const toggleWeightClass = (weightClass: string): void => {
    setSelectedWeightClasses((current) => {
      const normalizedCurrent = normalizeSelectedWeightClasses(modelSex, current);
      const base = normalizedCurrent.length ? normalizedCurrent : getDefaultSelectedWeightClasses(modelSex);
      const hasWeightClass = base.includes(weightClass);

      if (!hasWeightClass) {
        return normalizeSelectedWeightClasses(modelSex, [...base, weightClass]);
      }

      if (base.length === 1) {
        return base;
      }

      return base.filter((value) => value !== weightClass);
    });
  };

  const manualRateOverrides = useMemo(
    () => ({
      squat: parseOptionalRate(overrideSquatRate),
      bench: parseOptionalRate(overrideBenchRate),
      deadlift: parseOptionalRate(overrideDeadliftRate)
    }),
    [overrideBenchRate, overrideDeadliftRate, overrideSquatRate]
  );

  const meetProjection = useMemo(
    () =>
      buildMeetProjection({
        rows,
        timeline,
        meetDate,
        currentPosition,
        growthRates: analytics.growthRates,
        modelSettings: {
          sex: modelSex,
          bodyweightKg: modelBodyweightKg,
          completedMeets: modelCompletedMeets,
          selectedWeightClasses: activeWeightClasses,
          manualRateOverrides
        }
      }),
    [
      activeWeightClasses,
      analytics.growthRates,
      currentPosition,
      manualRateOverrides,
      meetDate,
      modelBodyweightKg,
      modelCompletedMeets,
      modelSex,
      rows,
      timeline
    ]
  );

  const currentPositionLabel =
    currentPosition.weekIndex !== null && currentPosition.dayIndex !== null
      ? `Week ${currentPosition.weekIndex}, Day ${currentPosition.dayIndex}`
      : 'No inferred position';

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={`${styles.panel} ${styles.commandDeck}`}>
          <div className={styles.commandHeader}>
            <div>
              <h1 className={styles.title}>Powerlifting Performance Dashboard</h1>
              <p className={styles.subtitle}>
                Obsidian workflow for block control, projected performance, and weekly training execution.
              </p>
            </div>
            <div>
              <div className={styles.pending}>
                Pending edits: <span className={styles.pendingStrong}>{dirtyUpdateCount}</span>
              </div>
              <div className={styles.statusPills}>
                <span className={styles.statusPill}>
                  <span className={styles.statusLabel}>Session</span>
                  <span className={styles.statusValue}>{isAuthenticated ? sessionEmail : 'Not signed in'}</span>
                </span>
                <span className={styles.statusPill}>
                  <span className={styles.statusLabel}>Spreadsheet</span>
                  <span className={styles.statusValue}>{selectedSpreadsheet?.spreadsheetId || 'None selected'}</span>
                </span>
                <span className={styles.statusPill}>
                  <span className={styles.statusLabel}>Block</span>
                  <span className={styles.statusValue}>{selectedBlock || 'Unavailable'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className={styles.controlGrid}>
            <section className={styles.connectionCard}>
              <h2 className={styles.cardTitle}>Connection + Spreadsheet</h2>
              <div className={styles.connectionRows}>
                <div>
                  Session: <strong>{isAuthenticated ? sessionEmail : 'Not signed in'}</strong>
                </div>
                <div>
                  Selected spreadsheet: <strong>{selectedSpreadsheet?.spreadsheetId || 'None selected'}</strong>
                </div>
              </div>

              <div className={styles.linkRow}>
                {isAuthenticated ? (
                  <a href="/api/auth/signout?callbackUrl=%2Fdashboard">Sign out</a>
                ) : (
                  <a href="/api/auth/signin?callbackUrl=%2Fdashboard">Sign in</a>
                )}
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  disabled={!isAuthenticated || !pickerConfig?.enabled || isPickerBusy}
                  onClick={onOpenDrivePicker}
                >
                  {isPickerBusy ? 'Opening Picker...' : 'Select via Drive Picker'}
                </button>
              </div>

              <form
                className={styles.inlineForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  onSubmitManualSelection();
                }}
              >
                <input
                  type="text"
                  value={selectionInput}
                  onChange={(event) => onSelectionInputChange(event.target.value)}
                  placeholder="Spreadsheet URL or spreadsheet ID"
                  disabled={!isAuthenticated}
                />
                <button
                  type="submit"
                  className={styles.buttonPrimary}
                  disabled={!isAuthenticated || !selectionInput.trim()}
                >
                  Save Spreadsheet
                </button>
              </form>

              {!pickerConfig?.enabled && isAuthenticated ? (
                <div className={styles.infoHint}>
                  Drive Picker is disabled until `GOOGLE_PICKER_API_KEY` and `GOOGLE_PICKER_APP_ID` are configured.
                </div>
              ) : null}
            </section>

            <section className={styles.controlCard}>
              <h2 className={styles.cardTitle}>Block Controls</h2>

              <label className={styles.controlLabel}>
                <span>Block Selection</span>
                <select value={selectedBlock} onChange={(event) => onSelectedBlockChange(event.target.value)}>
                  {blockOptions.map((blockName) => (
                    <option key={blockName} value={blockName}>
                      {blockName}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={onForceRefresh}
                  disabled={!selectedBlock || isLoading}
                >
                  {isLoading ? 'Refreshing...' : 'Force Refresh'}
                </button>

                <button
                  type="button"
                  className={styles.buttonPrimary}
                  onClick={onSaveAll}
                  disabled={!payload || isSaving || dirtyUpdateCount === 0}
                >
                  {isSaving ? 'Saving...' : `Save All (${dirtyUpdateCount})`}
                </button>
              </div>
            </section>
          </div>
        </header>

        {error ? <section className={`${styles.banner} ${styles.bannerError}`}>{error}</section> : null}
        {connectionError ? <section className={`${styles.banner} ${styles.bannerWarn}`}>{connectionError}</section> : null}

        {payload ? (
          <section className={`${styles.panel} ${styles.snapshotPanel}`} data-testid="performance-snapshot">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Performance Snapshot</h2>
              <p className={styles.sectionHint}>Consolidated totals, coefficient context, and meet runway projection.</p>
            </div>

            <div className={styles.snapshotGrid}>
              <div className={styles.snapshotMetrics}>
                <div className={styles.totalsGrid}>
                  <article className={styles.totalCard}>
                    <p className={styles.metricLabel}>Current Total</p>
                    <p className={styles.metricValue}>{formatKg(payload.stats.current.total)}</p>
                  </article>
                  <article className={styles.totalCard}>
                    <p className={styles.metricLabel}>Block Projected Total</p>
                    <p className={styles.metricValue}>{formatKg(payload.stats.projected.total)}</p>
                  </article>
                  <article className={`${styles.totalCard} ${styles.totalCardStrong}`}>
                    <p className={styles.metricLabel}>Meet Projected Total</p>
                    <p className={styles.metricValue}>{formatKg(meetProjection.projected.total)}</p>
                  </article>
                </div>

                <div className={styles.coefficientRow}>
                  <div className={styles.coefficientItem}>
                    <span>DOTS</span>
                    <strong>
                      {formatScore(payload.stats.current.dots)} → {formatScore(payload.stats.projected.dots)}
                    </strong>
                  </div>
                  <div className={styles.coefficientItem}>
                    <span>Wilks</span>
                    <strong>
                      {formatScore(payload.stats.current.wilks)} → {formatScore(payload.stats.projected.wilks)}
                    </strong>
                  </div>
                  <div className={styles.coefficientItem}>
                    <span>GL</span>
                    <strong>
                      {formatScore(payload.stats.current.gl)} → {formatScore(payload.stats.projected.gl)}
                    </strong>
                  </div>
                </div>

                <div className={styles.liftGrid}>
                  <div className={styles.liftGridHeader}>Lift</div>
                  <div className={styles.liftGridHeader}>Current</div>
                  <div className={styles.liftGridHeader}>Start Rate</div>
                  <div className={styles.liftGridHeader}>OpenIPF Target</div>
                  <div className={styles.liftGridHeader}>Meet Projection</div>

                  {(['squat', 'bench', 'deadlift'] as const).map((lift) => (
                    <Fragment key={lift}>
                      <div className={styles.liftLabel}>{lift[0].toUpperCase() + lift.slice(1)}</div>
                      <div>{formatKg(meetProjection.current[lift])}</div>
                      <div>{formatRate(meetProjection.rates[lift].usedStartRate)}</div>
                      <div>{formatRate(meetProjection.rates[lift].targetRate)}</div>
                      <div>{formatKg(meetProjection.projected[lift])}</div>
                    </Fragment>
                  ))}
                </div>

                <p className={styles.sectionHint}>
                  OpenIPF model: {meetProjection.model.sex === 'male' ? 'Men' : 'Women'} · Classes{' '}
                  {meetProjection.model.selectedWeightClasses.join(', ')} · Transition {meetProjection.model.transitionLabel} · Cohort n=
                  {meetProjection.model.sampleSize}
                </p>
              </div>

              <aside className={styles.projectionControls}>
                <h3 className={styles.cardTitle}>Projection Controls</h3>
                <p className={styles.sectionHint}>
                  Configure OpenIPF-calibrated meet projection. Men and women are modeled on separate cohorts.
                </p>

                <label className={styles.controlLabel}>
                  <span>Sex</span>
                  <select
                    data-testid="projection-sex-select"
                    value={modelSex}
                    onChange={(event) => setProjectionSex(event.target.value as ProjectionSex)}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>

                <label className={styles.controlLabel}>
                  <span>Bodyweight (kg)</span>
                  <input
                    data-testid="projection-bodyweight-input"
                    type="number"
                    min="30"
                    step="0.1"
                    value={projectionBodyweightKg}
                    onChange={(event) => setProjectionBodyweightKg(event.target.value)}
                  />
                </label>

                <label className={styles.controlLabel}>
                  <span>Completed Meets</span>
                  <input
                    data-testid="projection-meets-input"
                    type="number"
                    min="0"
                    step="1"
                    value={completedMeets}
                    onChange={(event) => setCompletedMeets(event.target.value)}
                  />
                </label>

                <div className={styles.controlLabel}>
                  <span>Weight Classes</span>
                  <div className={styles.weightClassGrid} data-testid="projection-weight-class-grid">
                    {weightClassOptions.map((weightClass) => {
                      const selected = activeWeightClasses.includes(weightClass);
                      return (
                        <label
                          key={weightClass}
                          className={`${styles.weightClassOption} ${selected ? styles.weightClassOptionActive : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleWeightClass(weightClass)}
                          />
                          <span>{weightClass}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label className={styles.controlLabel}>
                  <span>Competition Date</span>
                  <input type="date" value={meetDate} onChange={(event) => setMeetDate(event.target.value)} />
                </label>

                <label className={styles.controlLabel}>
                  <span>Current Week Override</span>
                  <select
                    value={manualWeek}
                    onChange={(event) => {
                      setManualWeek(event.target.value);
                      if (!event.target.value) {
                        setManualDay('');
                      }
                    }}
                  >
                    <option value="">Auto</option>
                    {weekOptions.map((week) => (
                      <option key={week} value={String(week)}>
                        Week {week}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.controlLabel}>
                  <span>Current Day Override</span>
                  <select value={manualDay} onChange={(event) => setManualDay(event.target.value)}>
                    <option value="">Auto</option>
                    {dayOptions.map((day) => (
                      <option key={day} value={String(day)}>
                        Day {day}
                      </option>
                    ))}
                  </select>
                </label>

                <div className={styles.controlLabel}>
                  <span>Manual Start Rate Overrides (kg/week)</span>
                  <div className={styles.rateOverrides}>
                    <label>
                      <span>Squat</span>
                      <input
                        data-testid="projection-override-squat"
                        type="number"
                        min="0"
                        step="0.1"
                        value={overrideSquatRate}
                        placeholder="Auto"
                        onChange={(event) => setOverrideSquatRate(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Bench</span>
                      <input
                        data-testid="projection-override-bench"
                        type="number"
                        min="0"
                        step="0.1"
                        value={overrideBenchRate}
                        placeholder="Auto"
                        onChange={(event) => setOverrideBenchRate(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Deadlift</span>
                      <input
                        data-testid="projection-override-deadlift"
                        type="number"
                        min="0"
                        step="0.1"
                        value={overrideDeadliftRate}
                        placeholder="Auto"
                        onChange={(event) => setOverrideDeadliftRate(event.target.value)}
                      />
                    </label>
                  </div>
                </div>

                <div className={styles.positionSummary}>
                  <span className={`${styles.badge} ${currentPosition.source === 'manual' ? styles.badgeDirty : styles.badgeClean}`}>
                    {currentPosition.source === 'manual' ? 'Manual' : 'Inferred'}
                  </span>
                  <span>{currentPositionLabel}</span>
                </div>

                {currentPosition.source === 'inferred' && currentPosition.completionPct !== null ? (
                  <p className={styles.sectionHint}>Inference confidence: {currentPosition.completionPct.toFixed(1)}% section completion.</p>
                ) : null}

                <p className={styles.sectionHint}>
                  Active transition: {meetProjection.model.transitionLabel} (max supported {meetProjection.model.maxTransition}-&gt;
                  {meetProjection.model.maxTransition + 1}).
                </p>
                <p className={styles.sectionHint}>Weeks remaining to meet: {meetProjection.weeksRemaining}</p>
              </aside>
            </div>
          </section>
        ) : null}

        {payload ? (
          <section className={styles.chartsGrid}>
            <div className={`${styles.panel} ${styles.chartCardWide}`}>
              <OverallPrimaryProgressChart timeline={timeline} />
            </div>
            <div className={`${styles.panel} ${styles.chartCard}`}>
              <BlockPrimaryProgressChart primaryByWeek={payload.stats.primaryByWeek} />
            </div>
            <div className={`${styles.panel} ${styles.chartCard}`}>
              <BlockComparisonChart comparisons={analytics.blockComparisons} />
            </div>
            <div className={`${styles.panel} ${styles.chartCard}`}>
              <MeetProjectionChart projection={meetProjection} />
            </div>
          </section>
        ) : null}

        {payload ? (
          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Recap</h2>
              <p className={styles.sectionHint}>Context and coach notes carried from the source block.</p>
            </div>
            <div className={styles.recapGrid}>
              <article className={styles.recapItem}>
                <p className={styles.recapLabel}>Squat</p>
                <p className={styles.recapValue}>{payload.blockData.recaps.squat || '-'}</p>
              </article>
              <article className={styles.recapItem}>
                <p className={styles.recapLabel}>Bench</p>
                <p className={styles.recapValue}>{payload.blockData.recaps.bench || '-'}</p>
              </article>
              <article className={styles.recapItem}>
                <p className={styles.recapLabel}>Deadlift</p>
                <p className={styles.recapValue}>{payload.blockData.recaps.deadlift || '-'}</p>
              </article>
              <article className={styles.recapItem}>
                <p className={styles.recapLabel}>Accessory</p>
                <p className={styles.recapValue}>{payload.blockData.recaps.accessory || '-'}</p>
              </article>
              <article className={styles.recapItem}>
                <p className={styles.recapLabel}>Additions</p>
                <p className={styles.recapValue}>{payload.blockData.recaps.additions || '-'}</p>
              </article>
              <article className={styles.recapItem}>
                <p className={styles.recapLabel}>Coach</p>
                <p className={styles.recapValue}>{payload.blockData.recaps.coach || '-'}</p>
              </article>
            </div>
          </section>
        ) : null}

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Editable Rows (Actual Load / RPE)</h2>
            <p className={styles.sectionHint}>
              Week-grouped and day-ordered editing for predictable training flow updates.
            </p>
          </div>

          {isLoading ? <p className={styles.sectionHint}>Loading block data...</p> : null}

          {!payload || !rows.length ? (
            <p className={styles.sectionHint}>No editable rows available for this block.</p>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table} data-testid="editable-rows-table">
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>Actual Load</th>
                    <th>RPE</th>
                    <th>Row Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.weekSections.map((week) => (
                    <Fragment key={week.key}>
                      <tr className={styles.weekDivider} data-testid="week-divider">
                        <td colSpan={5}>
                          {week.label} | {week.rows.length} rows
                        </td>
                      </tr>

                      {week.days.map((day) => (
                        <Fragment key={day.key}>
                          <tr className={styles.dayDivider} data-testid="day-divider">
                            <td colSpan={5}>
                              {day.label}
                              {day.dayName ? ` · ${day.dayName}` : ''} · {Math.round(day.completionPct * 100)}% complete
                            </td>
                          </tr>

                          {day.rows.map((row: BlockRow) => {
                            const rowUpdates = getRowUpdates(row);
                            const rowDirty = rowUpdates.length > 0;
                            const actualDirty = rowUpdates.some((update) => update.field === 'actualLoad');
                            const rpeDirty = rowUpdates.some((update) => update.field === 'rpe');
                            const actualLoadCell = row.actualLoadCell;
                            const rpeCell = row.rpeCell;

                            return (
                              <tr key={getRowKey(row)} className={rowDirty ? styles.rowDirty : ''}>
                                <td>
                                  <div className={styles.exercise}>
                                    <span className={styles.exerciseName}>{row.exercise || '-'}</span>
                                    <span className={styles.exerciseMeta}>
                                      {row.sets || '-'} x {row.reps || '-'}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  {actualLoadCell ? (
                                    <input
                                      className={`${styles.cellInput} ${actualDirty ? styles.cellInputDirty : ''}`}
                                      value={getPendingFieldValue(row, 'actualLoad')}
                                      onChange={(event) => onPendingValueChange(actualLoadCell, 'actualLoad', event.target.value)}
                                    />
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td>
                                  {rpeCell ? (
                                    <input
                                      className={`${styles.cellInput} ${rpeDirty ? styles.cellInputDirty : ''}`}
                                      value={getPendingFieldValue(row, 'rpe')}
                                      onChange={(event) => onPendingValueChange(rpeCell, 'rpe', event.target.value)}
                                    />
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td>
                                  <span className={`${styles.badge} ${rowDirty ? styles.badgeDirty : styles.badgeClean}`}>
                                    {rowDirty ? 'Dirty' : 'Clean'}
                                  </span>
                                </td>
                                <td className={styles.actionsCell}>
                                  <button
                                    type="button"
                                    className={styles.buttonSecondary}
                                    disabled={isSaving || !rowDirty}
                                    onClick={() => onSaveRow(row)}
                                  >
                                    Save Row
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {conflictState ? (
        <section className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Conflicts Detected</h3>
            <p className={styles.sectionHint}>
              The server values changed since your last read. Reload or overwrite with caution.
            </p>

            <ul className={styles.conflictList}>
              {conflictState.result.conflicts.map((conflict) => (
                <li key={conflict.cellA1}>
                  <code>{conflict.cellA1}</code>: server <code>{conflict.serverValue}</code> vs client{' '}
                  <code>{String(conflict.requestedOriginal ?? '')}</code>
                </li>
              ))}
            </ul>

            <div className={styles.modalActions}>
              <button type="button" className={styles.buttonGhost} onClick={onDismissConflict}>
                Dismiss
              </button>
              <button type="button" className={styles.buttonSecondary} onClick={onReloadConflict}>
                Reload Data
              </button>
              <button type="button" className={styles.buttonDanger} onClick={onOverwriteConflict}>
                Overwrite Anyway
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
