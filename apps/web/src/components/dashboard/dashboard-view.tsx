import { useEffect, useMemo, useState } from 'react';

import {
  getDefaultSelectedWeightClasses,
  getOpenIpfWeightClassOptions,
  normalizeSelectedWeightClasses,
  type ProjectionSex
} from './openipf-projection';
import { AnalysisPane } from './panes/analysis-pane';
import { ConnectionPane } from './panes/connection-pane';
import { DashboardHeader } from './panes/dashboard-header';
import { OverviewPane } from './panes/overview-pane';
import { ShellGuidance } from './panes/shell-guidance';
import { TrainingPane } from './panes/training-pane';
import type {
  AnalysisSlot,
  DashboardPane,
  DashboardShellState,
  DashboardViewProps,
  DashboardViewportMode,
  PromptContextVM
} from './types';
import {
  buildCoachSignals,
  buildDashboardAnalytics,
  buildMeetProjection,
  buildNextSessionFocus,
  type CurrentPositionVM
} from './view-models';

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
  activeDay: 'dashboard.activeDay'
} as const;

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

function readStoredNumber(value: string | null): string {
  if (!value) {
    return '';
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
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
  if (!Number.isFinite(parsed)) {
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

    setProjectionBodyweightKg(readStoredNumber(storedBodyweightKg));
    setCompletedMeets(readStoredNonNegativeInt(storedCompletedMeets) || '0');
    setOverrideSquatRate(readStoredNumber(storedOverrideSquatRate));
    setOverrideBenchRate(readStoredNumber(storedOverrideBenchRate));
    setOverrideDeadliftRate(readStoredNumber(storedOverrideDeadliftRate));

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
        return section.days.map((day) => day.dayIndex).filter((value): value is number => value !== null);
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

  const coachSignals = useMemo(
    () =>
      buildCoachSignals({
        adherenceSummary: analytics.adherenceSummary,
        growthRates: analytics.growthRates,
        meetProjection
      }),
    [analytics.adherenceSummary, analytics.growthRates, meetProjection]
  );

  const nextSessionFocus = useMemo(
    () =>
      buildNextSessionFocus({
        selectedDaySection,
        growthRates: analytics.growthRates
      }),
    [analytics.growthRates, selectedDaySection]
  );

  const promptContext = useMemo<PromptContextVM>(
    () => ({
      generatedAt: new Date().toISOString(),
      blockName: selectedBlock || 'Unknown block',
      weekLabel: selectedWeekSection?.label || 'Unknown week',
      dayLabel: selectedDaySection?.label || 'Unknown day',
      completionPct: Number((selectedDaySection?.completionPct || 0) * 100),
      primaryCompletionPct: Number((selectedDaySection?.primaryCompletionPct || 0) * 100),
      currentTotalKg: meetProjection.current.total,
      projectedTotalKg: meetProjection.scenarios.base.total,
      projectedLowTotalKg: meetProjection.scenarios.low.total,
      projectedHighTotalKg: meetProjection.scenarios.high.total,
      weeksRemaining: meetProjection.weeksRemaining,
      ratesKgPerWeek: {
        squat: meetProjection.rates.squat.baseRate,
        bench: meetProjection.rates.bench.baseRate,
        deadlift: meetProjection.rates.deadlift.baseRate
      }
    }),
    [
      meetProjection.current.total,
      meetProjection.rates.bench.baseRate,
      meetProjection.rates.deadlift.baseRate,
      meetProjection.rates.squat.baseRate,
      meetProjection.scenarios.base.total,
      meetProjection.scenarios.high.total,
      meetProjection.scenarios.low.total,
      meetProjection.weeksRemaining,
      selectedBlock,
      selectedDaySection,
      selectedWeekSection
    ]
  );

  const currentPositionLabel =
    currentPosition.weekIndex !== null && currentPosition.dayIndex !== null
      ? `Week ${currentPosition.weekIndex}, Day ${currentPosition.dayIndex}`
      : 'No inferred position';

  const paneLabel: Record<DashboardPane, string> = {
    overview: 'Overview',
    training: 'Training',
    analysis: 'Analysis',
    connection: 'Connection'
  };

  const shellState: DashboardShellState = !isAuthenticated
    ? 'unauthenticated'
    : selectedBlock
      ? 'ready'
      : 'authenticated_no_block';

  return (
    <main className={styles.page} data-testid="dashboard-root" data-viewport={viewportMode}>
      <div className={styles.shell}>
        <DashboardHeader
          dirtyUpdateCount={dirtyUpdateCount}
          isLoading={isLoading}
          isSaving={isSaving}
          selectedBlock={selectedBlock}
          hasPayload={Boolean(payload)}
          isAuthenticated={isAuthenticated}
          sessionEmail={sessionEmail}
          selectedSpreadsheetId={selectedSpreadsheet?.spreadsheetId || 'None selected'}
          currentPositionLabel={currentPositionLabel}
          onForceRefresh={onForceRefresh}
          onSaveAll={onSaveAll}
        />

        {viewportMode === 'mobile' ? (
          <nav className={`${styles.panel} ${styles.mobilePaneNav}`} role="tablist" aria-label="Dashboard sections" data-testid="mobile-pane-tabs">
            {(Object.keys(paneLabel) as DashboardPane[]).map((pane) => {
              const selected = activePane === pane;
              const disabled = shellState !== 'ready' && pane !== 'overview' && pane !== 'connection';

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
                  disabled={disabled}
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

        {shellState === 'ready' ? (
          <div className={styles.workspace}>
            <OverviewPane
              isMobileHidden={viewportMode === 'mobile' && activePane !== 'overview'}
              payload={payload}
              meetProjection={meetProjection}
              coachSignals={coachSignals}
              promptContext={promptContext}
              modelSex={modelSex}
              projectionBodyweightKg={projectionBodyweightKg}
              completedMeets={completedMeets}
              meetDate={meetDate}
              manualWeek={manualWeek}
              manualDay={manualDay}
              weekOptions={weekOptions}
              dayOptions={dayOptions}
              weightClassOptions={weightClassOptions}
              activeWeightClasses={activeWeightClasses}
              overrideSquatRate={overrideSquatRate}
              overrideBenchRate={overrideBenchRate}
              overrideDeadliftRate={overrideDeadliftRate}
              onProjectionSexChange={setProjectionSex}
              onProjectionBodyweightChange={setProjectionBodyweightKg}
              onCompletedMeetsChange={setCompletedMeets}
              onMeetDateChange={setMeetDate}
              onManualWeekChange={setManualWeek}
              onManualDayChange={setManualDay}
              onToggleWeightClass={toggleWeightClass}
              onOverrideSquatRateChange={setOverrideSquatRate}
              onOverrideBenchRateChange={setOverrideBenchRate}
              onOverrideDeadliftRateChange={setOverrideDeadliftRate}
            />

            <AnalysisPane
              isMobileHidden={viewportMode === 'mobile' && activePane !== 'analysis'}
              payload={payload}
              timeline={timeline}
              blockComparisons={analytics.blockComparisons}
              meetProjection={meetProjection}
              activeAnalysisSlot={activeAnalysisSlot}
              onAnalysisSlotChange={setActiveAnalysisSlot}
            />

            <ConnectionPane
              isMobileHidden={viewportMode === 'mobile' && activePane !== 'connection'}
              isAuthenticated={isAuthenticated}
              isPickerBusy={isPickerBusy}
              pickerEnabled={Boolean(pickerConfig?.enabled)}
              selectionInput={selectionInput}
              selectedBlock={selectedBlock}
              blockOptions={blockOptions}
              onSelectionInputChange={onSelectionInputChange}
              onSubmitManualSelection={onSubmitManualSelection}
              onOpenDrivePicker={onOpenDrivePicker}
              onSelectedBlockChange={onSelectedBlockChange}
            />

            <TrainingPane
              isMobileHidden={viewportMode === 'mobile' && activePane !== 'training'}
              payload={payload}
              rows={rows}
              isLoading={isLoading}
              isSaving={isSaving}
              weekSections={weekSections}
              selectedWeekSection={selectedWeekSection}
              selectedDaySection={selectedDaySection}
              visibleRows={visibleRows}
              nextSessionFocus={nextSessionFocus}
              getPendingFieldValue={getPendingFieldValue}
              onPendingValueChange={onPendingValueChange}
              getRowUpdates={getRowUpdates}
              getRowKey={getRowKey}
              onSaveRow={onSaveRow}
              onSetActiveWeekKey={setActiveWeekKey}
              onSetActiveDayKey={setActiveDayKey}
            />
          </div>
        ) : (
          <div className={styles.workspaceSetup}>
            <div hidden={viewportMode === 'mobile' && activePane !== 'overview'}>
              <ShellGuidance state={shellState} isAuthenticated={isAuthenticated} selectedBlock={selectedBlock} />
            </div>
            <ConnectionPane
              isMobileHidden={viewportMode === 'mobile' && activePane !== 'connection'}
              isAuthenticated={isAuthenticated}
              isPickerBusy={isPickerBusy}
              pickerEnabled={Boolean(pickerConfig?.enabled)}
              selectionInput={selectionInput}
              selectedBlock={selectedBlock}
              blockOptions={blockOptions}
              onSelectionInputChange={onSelectionInputChange}
              onSubmitManualSelection={onSubmitManualSelection}
              onOpenDrivePicker={onOpenDrivePicker}
              onSelectedBlockChange={onSelectedBlockChange}
            />
          </div>
        )}
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
