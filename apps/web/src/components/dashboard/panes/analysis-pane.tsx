import type { DashboardPayload, OverallTimelinePoint } from '@powerlifting/domain';

import type { AnalysisSlot } from '../types';
import type { BlockComparisonVM, MeetProjectionVM } from '../view-models';
import { BlockComparisonChart } from '../charts/block-comparison-chart';
import { BlockPrimaryProgressChart } from '../charts/block-primary-progress-chart';
import { MeetProjectionChart } from '../charts/meet-projection-chart';
import { OverallPrimaryProgressChart } from '../charts/overall-primary-progress-chart';

import styles from '../dashboard-view.module.css';

interface AnalysisPaneProps {
  isMobileHidden: boolean;
  payload: DashboardPayload | null;
  timeline: OverallTimelinePoint[];
  blockComparisons: BlockComparisonVM[];
  meetProjection: MeetProjectionVM;
  activeAnalysisSlot: AnalysisSlot;
  onAnalysisSlotChange: (slot: AnalysisSlot) => void;
}

function RecapPanel({ payload }: { payload: DashboardPayload | null }): JSX.Element {
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

export function AnalysisPane(props: AnalysisPaneProps): JSX.Element {
  const { isMobileHidden, payload, timeline, blockComparisons, meetProjection, activeAnalysisSlot, onAnalysisSlotChange } = props;

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
      return <BlockComparisonChart comparisons={blockComparisons} />;
    }

    if (activeAnalysisSlot === 'meetProjection') {
      return <MeetProjectionChart projection={meetProjection} />;
    }

    return <RecapPanel payload={payload} />;
  }

  return (
    <section
      id="pane-analysis"
      className={`${styles.panel} ${styles.pane} ${styles.analysisPane}`}
      data-pane="analysis"
      hidden={isMobileHidden}
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
            <div className={styles.segmentedControl} role="tablist" aria-label="Analysis slot" data-testid="analysis-slot-tabs">
              {([
                { value: 'blockComparison', label: 'Block Comparison' },
                { value: 'meetProjection', label: 'Meet Projection' },
                { value: 'recap', label: 'Recap' }
              ] as const).map((option) => {
                const selected = activeAnalysisSlot === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={`${styles.segmentedButton} ${selected ? styles.segmentedButtonActive : ''}`}
                    onClick={() => onAnalysisSlotChange(option.value)}
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
  );
}
