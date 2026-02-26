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
import type {
  AnalysisSlot,
  DashboardPane,
  DashboardViewProps,
  DashboardViewportMode,
} from './types';
import { buildDashboardAnalytics, buildMeetProjection, type CurrentPositionVM } from './view-models';

import styles from './dashboard-view.module.css';

const DEFAULT_MEET_DATE = '2026-11-07';
const MOBILE_BREAKPOINT_PX = 1080;

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
  overrideDeadliftRate: 'dashboard.overrideDeadliftRate',
  activeAnalysisSlot: 'dashboard.activeAnalysisSlot',
  activePane: 'dashboard.activePane',
  activeWeek: 'dashboard.activeWeek',
  activeDay: 'dashboard.activeDay',
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

function isAnalysisSlot(value: string): value is AnalysisSlot {
  return value === 'blockComparison' || value === 'meetProjection' || value === 'recap';
}

function isDashboardPane(value: string): value is DashboardPane {
  return value === 'overview' || value === 'training' || value === 'analysis' || value === 'connection';
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
    getRowKey,
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

  const [activeAnalysisSlot, setActiveAnalysisSlot] = useState<AnalysisSlot>('blockComparison');
  const [activePane, setActivePane] = useState<DashboardPane>('overview');
  const [activeWeekKey, setActiveWeekKey] = useState('');
  const [activeDayKey, setActiveDayKey] = useState('');
  const [viewportMode, setViewportMode] = useState<DashboardViewportMode>('desktop');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);

    const updateViewportMode = (): void => {
      setViewportMode(mediaQuery.matches ? 'mobile' : 'desktop');
    };

    updateViewportMode();

    const listener = (event: MediaQueryListEvent): void => {
      setViewportMode(event.matches ? 'mobile' : 'desktop');
    };

    mediaQuery.addEventListener('change', listener);
    return () => {
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

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
    const storedAnalysisSlot = window.localStorage.getItem(STORAGE_KEYS.activeAnalysisSlot);
    const storedPane = window.localStorage.getItem(STORAGE_KEYS.activePane);
    const storedActiveWeek = window.localStorage.getItem(STORAGE_KEYS.activeWeek);
    const storedActiveDay = window.localStorage.getItem(STORAGE_KEYS.activeDay);

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

    if (storedAnalysisSlot && isAnalysisSlot(storedAnalysisSlot)) {
      setActiveAnalysisSlot(storedAnalysisSlot);
    }

    if (storedPane && isDashboardPane(storedPane)) {
      setActivePane(storedPane);
    }

    if (storedActiveWeek) {
      setActiveWeekKey(storedActiveWeek);
    }

    if (storedActiveDay) {
      setActiveDayKey(storedActiveDay);
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

    window.localStorage.setItem(STORAGE_KEYS.activeAnalysisSlot, activeAnalysisSlot);
    window.localStorage.setItem(STORAGE_KEYS.activePane, activePane);

    if (activeWeekKey) {
      window.localStorage.setItem(STORAGE_KEYS.activeWeek, activeWeekKey);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.activeWeek);
    }

    if (activeDayKey) {
      window.localStorage.setItem(STORAGE_KEYS.activeDay, activeDayKey);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.activeDay);
    }
  }, [
    activeAnalysisSlot,
    activeDayKey,
    activePane,
    activeWeekKey,
    completedMeets,
    manualDay,
    manualWeek,
    meetDate,
    overrideBenchRate,
    overrideDeadliftRate,
    overrideSquatRate,
    projectionBodyweightKg,
    projectionSex,
    selectedWeightClasses,
  ]);

  const blockOptions = useMemo(
    () => (initial?.blocks || []).filter((entry) => entry.isBlock).map((entry) => entry.name),
    [initial]
  );

  const rows = payload?.blockData.rows || [];
  const timeline = payload?.overallProgress.timeline || [];

  const analytics = useMemo(
    () => buildDashboardAnalytics(rows, payload?.overallProgress),
    [rows, payload?.overallProgress]
  );

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
      completionPct: hasManualWeek || hasManualDay ? null : analytics.inferredPosition.completionPct,
    };
  }, [analytics.inferredPosition, analytics.weekSections, manualDay, manualWeek]);

  const weekSections = analytics.weekSections;

  const selectedWeekSection = useMemo(() => {
    if (!weekSections.length) {
      return null;
    }

    if (activeWeekKey) {
      const fromStored = weekSections.find((entry) => entry.key === activeWeekKey);
      if (fromStored) {
        return fromStored;
      }
    }

    if (currentPosition.weekIndex !== null) {
      const inferredWeek = weekSections.find((entry) => entry.weekIndex === currentPosition.weekIndex);
      if (inferredWeek) {
        return inferredWeek;
      }
    }

    return weekSections[0] || null;
  }, [activeWeekKey, currentPosition.weekIndex, weekSections]);

  const daySections = selectedWeekSection?.days || [];

  const selectedDaySection = useMemo(() => {
    if (!daySections.length) {
      return null;
    }

    if (activeDayKey) {
      const fromStored = daySections.find((entry) => entry.key === activeDayKey);
      if (fromStored) {
        return fromStored;
      }
    }

    if (currentPosition.dayIndex !== null) {
      const inferredDay = daySections.find((entry) => entry.dayIndex === currentPosition.dayIndex);
      if (inferredDay) {
        return inferredDay;
      }
    }

    return daySections[0] || null;
  }, [activeDayKey, currentPosition.dayIndex, daySections]);

  useEffect(() => {
    if (!selectedWeekSection) {
      if (activeWeekKey) {
        setActiveWeekKey('');
      }
      return;
    }

    if (selectedWeekSection.key !== activeWeekKey) {
      setActiveWeekKey(selectedWeekSection.key);
    }
  }, [activeWeekKey, selectedWeekSection]);

  useEffect(() => {
    if (!selectedDaySection) {
      if (activeDayKey) {
        setActiveDayKey('');
      }
      return;
    }

    if (selectedDaySection.key !== activeDayKey) {
      setActiveDayKey(selectedDaySection.key);
    }
  }, [activeDayKey, selectedDaySection]);

  const visibleRows = selectedDaySection?.rows || [];

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
      deadlift: parseOptionalRate(overrideDeadliftRate),
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
          manualRateOverrides,
        },
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
      timeline,
    ]
  );

  const currentPositionLabel =
    currentPosition.weekIndex !== null && currentPosition.dayIndex !== null
      ? `Week ${currentPosition.weekIndex}, Day ${currentPosition.dayIndex}`
      : 'No inferred position';

  function renderRecapPanel(): JSX.Element {
    const recaps = payload?.blockData.recaps;

    return (
      <div className={styles.recapGrid} data-testid="analysis-recap-panel">
        <article className={styles.recapItem}>
          <p className={styles.recapLabel}>Squat</p>
          <p className={styles.recapValue}>{recaps?.squat || '-'}</p>
        </article>
        <article className={styles.recapItem}>
          <p className={styles.recapLabel}>Bench</p>
          <p className={styles.recapValue}>{recaps?.bench || '-'}</p>
        </article>
        <article className={styles.recapItem}>
          <p className={styles.recapLabel}>Deadlift</p>
          <p className={styles.recapValue}>{recaps?.deadlift || '-'}</p>
        </article>
        <article className={styles.recapItem}>
          <p className={styles.recapLabel}>Accessory</p>
          <p className={styles.recapValue}>{recaps?.accessory || '-'}</p>
        </article>
        <article className={styles.recapItem}>
          <p className={styles.recapLabel}>Additions</p>
          <p className={styles.recapValue}>{recaps?.additions || '-'}</p>
        </article>
        <article className={styles.recapItem}>
          <p className={styles.recapLabel}>Coach</p>
          <p className={styles.recapValue}>{recaps?.coach || '-'}</p>
        </article>
      </div>
    );
  }

  const analysisSlotTitle =
    activeAnalysisSlot === 'blockComparison'
      ? 'Block Comparison'
      : activeAnalysisSlot === 'meetProjection'
        ? 'Meet Projection'
        : 'Recap Notes';

  function renderAnalysisSlot(): JSX.Element {
    if (!payload) {
      return <div className={styles.emptyState}>No analysis data available.</div>;
    }

    if (activeAnalysisSlot === 'blockComparison') {
      return <BlockComparisonChart comparisons={analytics.blockComparisons} />;
    }

    if (activeAnalysisSlot === 'meetProjection') {
      return <MeetProjectionChart projection={meetProjection} />;
    }

    return renderRecapPanel();
  }

  const paneLabel: Record<DashboardPane, string> = {
    overview: 'Overview',
    training: 'Training',
    analysis: 'Analysis',
    connection: 'Connection',
  };

  return (
    <main className={styles.page} data-testid="dashboard-root" data-viewport={viewportMode}>
      <div className={styles.shell}>
        <header className={`${styles.panel} ${styles.commandDeck}`}>
          <div className={styles.commandHeader}>
            <div>
              <h1 className={styles.title}>Powerlifting Performance Dashboard</h1>
              <p className={styles.subtitle}>Single-screen obsidian command surface for training execution and analysis.</p>
            </div>
            <div className={styles.headerMeta}>
              <div className={styles.pending}>
                Pending edits: <span className={styles.pendingStrong}>{dirtyUpdateCount}</span>
              </div>
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
            </div>
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
            <span className={styles.statusPill}>
              <span className={styles.statusLabel}>Position</span>
              <span className={styles.statusValue}>{currentPositionLabel}</span>
            </span>
          </div>
        </header>

        {viewportMode === 'mobile' ? (
          <nav className={`${styles.panel} ${styles.mobilePaneNav}`} role="tablist" aria-label="Dashboard sections" data-testid="mobile-pane-tabs">
            {(Object.keys(paneLabel) as DashboardPane[]).map((pane) => {
              const selected = activePane === pane;
              return (
                <button
                  key={pane}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`pane-${pane}`}
                  className={`${styles.mobilePaneButton} ${selected ? styles.mobilePaneButtonActive : ''}`}
                  onClick={() => setActivePane(pane)}
                  data-testid={`mobile-pane-${pane}`}
                >
                  {paneLabel[pane]}
                </button>
              );
            })}
          </nav>
        ) : null}

        <div className={styles.bannerStack}>
          {error ? <section className={`${styles.banner} ${styles.bannerError}`}>{error}</section> : null}
          {connectionError ? <section className={`${styles.banner} ${styles.bannerWarn}`}>{connectionError}</section> : null}
        </div>

        <div className={styles.workspace}>
          <section
            id="pane-overview"
            className={`${styles.panel} ${styles.pane} ${styles.overviewPane}`}
            data-pane="overview"
            hidden={viewportMode === 'mobile' && activePane !== 'overview'}
            data-testid="overview-pane"
          >
            <div className={styles.paneHeader}>
              <h2 className={styles.sectionTitle}>Performance Snapshot</h2>
              <p className={styles.sectionHint}>Totals, coefficients, and projection controls.</p>
            </div>

            {!payload ? (
              <div className={styles.emptyState}>Load a block to view snapshot metrics.</div>
            ) : (
              <div className={styles.paneBody}>
                <div className={styles.totalsGrid} data-testid="performance-snapshot">
                  <article className={styles.totalCard}>
                    <p className={styles.metricLabel}>Current Total</p>
                    <p className={styles.metricValue}>{formatKg(payload.stats.current.total)}</p>
                  </article>
                  <article className={styles.totalCard}>
                    <p className={styles.metricLabel}>Block Projected</p>
                    <p className={styles.metricValue}>{formatKg(payload.stats.projected.total)}</p>
                  </article>
                  <article className={`${styles.totalCard} ${styles.totalCardStrong}`}>
                    <p className={styles.metricLabel}>Meet Projected</p>
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

                <div className={styles.controlCluster}>
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
                </div>

                <div className={styles.weightClassGrid} data-testid="projection-weight-class-grid">
                  {weightClassOptions.map((weightClass) => {
                    const selected = activeWeightClasses.includes(weightClass);
                    return (
                      <label
                        key={weightClass}
                        className={`${styles.weightClassOption} ${selected ? styles.weightClassOptionActive : ''}`}
                      >
                        <input type="checkbox" checked={selected} onChange={() => toggleWeightClass(weightClass)} />
                        <span>{weightClass}</span>
                      </label>
                    );
                  })}
                </div>

                <div className={styles.rateOverrides}>
                  <label>
                    <span>Squat Override (kg/wk)</span>
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
                    <span>Bench Override (kg/wk)</span>
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
                    <span>Deadlift Override (kg/wk)</span>
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

                <p className={styles.sectionHint}>
                  Model: {meetProjection.model.sex === 'male' ? 'Men' : 'Women'} | Classes {meetProjection.model.selectedWeightClasses.join(', ')} | Transition{' '}
                  {meetProjection.model.transitionLabel} | Weeks to meet {meetProjection.weeksRemaining}
                </p>
              </div>
            )}
          </section>

          <section
            id="pane-analysis"
            className={`${styles.panel} ${styles.pane} ${styles.analysisPane}`}
            data-pane="analysis"
            hidden={viewportMode === 'mobile' && activePane !== 'analysis'}
            data-testid="analysis-pane"
          >
            <div className={styles.paneHeader}>
              <h2 className={styles.sectionTitle}>Analysis</h2>
              <p className={styles.sectionHint}>Core trend charts plus a switchable analysis slot.</p>
            </div>

            {!payload ? (
              <div className={styles.emptyState}>Load a block to render analytics.</div>
            ) : (
              <div className={styles.paneBody}>
                <div className={styles.coreChartsGrid}>
                  <div className={styles.chartCard}>
                    <OverallPrimaryProgressChart timeline={timeline} />
                  </div>
                  <div className={styles.chartCard}>
                    <BlockPrimaryProgressChart primaryByWeek={payload.stats.primaryByWeek} />
                  </div>
                </div>

                <div className={styles.slotHeader}>
                  <div>
                    <h3 className={styles.cardTitle}>{analysisSlotTitle}</h3>
                    <p className={styles.sectionHint}>Switch secondary analysis without leaving the screen.</p>
                  </div>
                  <div
                    className={styles.segmentedControl}
                    role="tablist"
                    aria-label="Analysis slot"
                    data-testid="analysis-slot-tabs"
                  >
                    {([
                      { value: 'blockComparison', label: 'Block Comparison' },
                      { value: 'meetProjection', label: 'Meet Projection' },
                      { value: 'recap', label: 'Recap' },
                    ] as const).map((option) => {
                      const selected = activeAnalysisSlot === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          className={`${styles.segmentedButton} ${selected ? styles.segmentedButtonActive : ''}`}
                          onClick={() => setActiveAnalysisSlot(option.value)}
                          data-testid={`analysis-slot-${option.value}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.slotBody} data-testid="analysis-slot-panel">
                  {renderAnalysisSlot()}
                </div>
              </div>
            )}
          </section>

          <section
            id="pane-connection"
            className={`${styles.panel} ${styles.pane} ${styles.connectionPane}`}
            data-pane="connection"
            hidden={viewportMode === 'mobile' && activePane !== 'connection'}
            data-testid="connection-pane"
          >
            <div className={styles.paneHeader}>
              <h2 className={styles.sectionTitle}>Connection + Controls</h2>
              <p className={styles.sectionHint}>Auth, spreadsheet source, and block selection.</p>
            </div>

            <div className={styles.paneBody}>
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
            </div>
          </section>

          <section
            id="pane-training"
            className={`${styles.panel} ${styles.pane} ${styles.trainingPane}`}
            data-pane="training"
            hidden={viewportMode === 'mobile' && activePane !== 'training'}
            data-testid="training-pane"
          >
            <div className={styles.paneHeader}>
              <h2 className={styles.sectionTitle}>Editable Rows</h2>
              <p className={styles.sectionHint}>Week tabs + day tabs with inline edit/save parity.</p>
            </div>

            <div className={styles.paneBody}>
              {isLoading ? <p className={styles.sectionHint}>Loading block data...</p> : null}

              {!payload || !rows.length ? (
                <div className={styles.emptyState}>No editable rows available for this block.</div>
              ) : (
                <>
                  <div className={styles.tabRow} role="tablist" aria-label="Week tabs" data-testid="week-tabs">
                    {weekSections.map((week) => {
                      const selected = selectedWeekSection?.key === week.key;
                      const label = `${week.label} (${week.rows.length})`;

                      return (
                        <button
                          key={week.key}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          className={`${styles.tabButton} ${selected ? styles.tabButtonActive : ''}`}
                          onClick={() => {
                            setActiveWeekKey(week.key);
                            setActiveDayKey('');
                          }}
                          data-testid={`week-tab-${week.weekIndex ?? week.label}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {selectedWeekSection?.days.length ? (
                    <div className={styles.tabRow} role="tablist" aria-label="Day tabs" data-testid="day-tabs">
                      {selectedWeekSection.days.map((day) => {
                        const selected = selectedDaySection?.key === day.key;
                        const dayLabel = `${day.label}${day.dayName ? ` (${day.dayName})` : ''}`;

                        return (
                          <button
                            key={day.key}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            className={`${styles.tabButton} ${selected ? styles.tabButtonActive : ''}`}
                            onClick={() => setActiveDayKey(day.key)}
                            data-testid={`day-tab-${day.dayIndex ?? day.label}`}
                          >
                            {dayLabel}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {selectedDaySection ? (
                    <div className={styles.positionSummary}>
                      <span className={`${styles.badge} ${styles.badgeClean}`}>
                        {selectedWeekSection?.label} | {selectedDaySection.label}
                      </span>
                      <span>
                        Completion {Math.round(selectedDaySection.completionPct * 100)}% | Rows {selectedDaySection.rows.length}
                      </span>
                    </div>
                  ) : null}

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
                        {visibleRows.map((row: BlockRow) => {
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
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {conflictState ? (
        <section className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Conflicts Detected</h3>
            <p className={styles.sectionHint}>The server values changed since your last read. Reload or overwrite with caution.</p>

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
