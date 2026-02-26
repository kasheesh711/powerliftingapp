import type { DashboardPayload } from '@powerlifting/domain';
import { Fragment } from 'react';

import type { ProjectionSex } from '../openipf-projection';
import { PromptPanel } from '../prompts/prompt-panel';
import type { PromptContextVM } from '../types';
import type { CoachSignalVM, MeetProjectionVM } from '../view-models';

import styles from '../dashboard-view.module.css';

interface OverviewPaneProps {
  isMobileHidden: boolean;
  payload: DashboardPayload | null;
  meetProjection: MeetProjectionVM;
  coachSignals: CoachSignalVM[];
  promptContext: PromptContextVM;
  modelSex: ProjectionSex;
  projectionBodyweightKg: string;
  completedMeets: string;
  meetDate: string;
  manualWeek: string;
  manualDay: string;
  weekOptions: number[];
  dayOptions: number[];
  weightClassOptions: string[];
  activeWeightClasses: string[];
  overrideSquatRate: string;
  overrideBenchRate: string;
  overrideDeadliftRate: string;
  onProjectionSexChange: (value: ProjectionSex) => void;
  onProjectionBodyweightChange: (value: string) => void;
  onCompletedMeetsChange: (value: string) => void;
  onMeetDateChange: (value: string) => void;
  onManualWeekChange: (value: string) => void;
  onManualDayChange: (value: string) => void;
  onToggleWeightClass: (weightClass: string) => void;
  onOverrideSquatRateChange: (value: string) => void;
  onOverrideBenchRateChange: (value: string) => void;
  onOverrideDeadliftRateChange: (value: string) => void;
}

function formatKg(value: number): string {
  return `${value.toFixed(1)} kg`;
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

function formatRate(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} kg/week`;
}

export function OverviewPane(props: OverviewPaneProps): JSX.Element {
  const {
    isMobileHidden,
    payload,
    meetProjection,
    coachSignals,
    promptContext,
    modelSex,
    projectionBodyweightKg,
    completedMeets,
    meetDate,
    manualWeek,
    manualDay,
    weekOptions,
    dayOptions,
    weightClassOptions,
    activeWeightClasses,
    overrideSquatRate,
    overrideBenchRate,
    overrideDeadliftRate,
    onProjectionSexChange,
    onProjectionBodyweightChange,
    onCompletedMeetsChange,
    onMeetDateChange,
    onManualWeekChange,
    onManualDayChange,
    onToggleWeightClass,
    onOverrideSquatRateChange,
    onOverrideBenchRateChange,
    onOverrideDeadliftRateChange
  } = props;

  return (
    <section
      id="pane-overview"
      className={`${styles.panel} ${styles.pane} ${styles.overviewPane}`}
      data-pane="overview"
      hidden={isMobileHidden}
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
              <p className={styles.metricLabel}>Meet Projected (Base)</p>
              <p className={styles.metricValue}>{formatKg(meetProjection.scenarios.base.total)}</p>
            </article>
          </div>

          <div className={styles.coefficientRow}>
            <div className={styles.coefficientItem}>
              <span>DOTS</span>
              <strong>
                {formatScore(payload.stats.current.dots)}
                {' -> '}
                {formatScore(payload.stats.projected.dots)}
              </strong>
            </div>
            <div className={styles.coefficientItem}>
              <span>Wilks</span>
              <strong>
                {formatScore(payload.stats.current.wilks)}
                {' -> '}
                {formatScore(payload.stats.projected.wilks)}
              </strong>
            </div>
            <div className={styles.coefficientItem}>
              <span>GL</span>
              <strong>
                {formatScore(payload.stats.current.gl)}
                {' -> '}
                {formatScore(payload.stats.projected.gl)}
              </strong>
            </div>
          </div>

          <div className={styles.liftGrid}>
            <div className={styles.liftGridHeader}>Lift</div>
            <div className={styles.liftGridHeader}>Current</div>
            <div className={styles.liftGridHeader}>Base Rate</div>
            <div className={styles.liftGridHeader}>Target Rate</div>
            <div className={styles.liftGridHeader}>Base Projection</div>

            {(['squat', 'bench', 'deadlift'] as const).map((lift) => (
              <Fragment key={lift}>
                <div className={styles.liftLabel}>{lift[0].toUpperCase() + lift.slice(1)}</div>
                <div>{formatKg(meetProjection.current[lift])}</div>
                <div>{formatRate(meetProjection.rates[lift].baseRate)}</div>
                <div>{formatRate(meetProjection.rates[lift].targetRate)}</div>
                <div>{formatKg(meetProjection.scenarios.base[lift])}</div>
              </Fragment>
            ))}
          </div>

          <div className={styles.scenarioRow} data-testid="projection-scenarios">
            <span>Low {formatKg(meetProjection.scenarios.low.total)}</span>
            <span>Base {formatKg(meetProjection.scenarios.base.total)}</span>
            <span>High {formatKg(meetProjection.scenarios.high.total)}</span>
            <span>Confidence {meetProjection.scenarios.confidenceScore.toFixed(0)}%</span>
          </div>

          <div className={styles.controlCluster}>
            <label className={styles.controlLabel}>
              <span>Sex</span>
              <select data-testid="projection-sex-select" value={modelSex} onChange={(event) => onProjectionSexChange(event.target.value as ProjectionSex)}>
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
                onChange={(event) => onProjectionBodyweightChange(event.target.value)}
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
                onChange={(event) => onCompletedMeetsChange(event.target.value)}
              />
            </label>

            <label className={styles.controlLabel}>
              <span>Competition Date</span>
              <input type="date" value={meetDate} onChange={(event) => onMeetDateChange(event.target.value)} />
            </label>

            <label className={styles.controlLabel}>
              <span>Current Week Override</span>
              <select
                value={manualWeek}
                onChange={(event) => {
                  onManualWeekChange(event.target.value);
                  if (!event.target.value) {
                    onManualDayChange('');
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
              <select value={manualDay} onChange={(event) => onManualDayChange(event.target.value)}>
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
                <label key={weightClass} className={`${styles.weightClassOption} ${selected ? styles.weightClassOptionActive : ''}`}>
                  <input type="checkbox" checked={selected} onChange={() => onToggleWeightClass(weightClass)} />
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
                min="-4"
                step="0.1"
                value={overrideSquatRate}
                placeholder="Auto"
                onChange={(event) => onOverrideSquatRateChange(event.target.value)}
              />
            </label>
            <label>
              <span>Bench Override (kg/wk)</span>
              <input
                data-testid="projection-override-bench"
                type="number"
                min="-4"
                step="0.1"
                value={overrideBenchRate}
                placeholder="Auto"
                onChange={(event) => onOverrideBenchRateChange(event.target.value)}
              />
            </label>
            <label>
              <span>Deadlift Override (kg/wk)</span>
              <input
                data-testid="projection-override-deadlift"
                type="number"
                min="-4"
                step="0.1"
                value={overrideDeadliftRate}
                placeholder="Auto"
                onChange={(event) => onOverrideDeadliftRateChange(event.target.value)}
              />
            </label>
          </div>

          <section className={styles.coachSignals} data-testid="coach-signals">
            <div className={styles.paneHeader}>
              <h3 className={styles.cardTitle}>Coach Signals</h3>
              <p className={styles.sectionHint}>Deterministic guidance from adherence, trend spread, and meet runway.</p>
            </div>
            <div className={styles.signalGrid}>
              {coachSignals.map((signal) => (
                <article key={signal.id} className={`${styles.signalCard} ${styles[`signal${signal.severity[0].toUpperCase()}${signal.severity.slice(1)}`]}`}>
                  <p className={styles.recapLabel}>{signal.title}</p>
                  <p className={styles.signalRationale}>{signal.rationale}</p>
                  <p className={styles.signalAction}>{signal.action}</p>
                </article>
              ))}
            </div>
          </section>

          <PromptPanel context={promptContext} />

          <p className={styles.sectionHint}>
            Model: {meetProjection.model.sex === 'male' ? 'Men' : 'Women'} | Classes {meetProjection.model.selectedWeightClasses.join(', ')} |
            Transition {meetProjection.model.transitionLabel} | Weeks to meet {meetProjection.weeksRemaining}
          </p>
        </div>
      )}
    </section>
  );
}
