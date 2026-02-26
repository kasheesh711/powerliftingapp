import type { BlockRow, DashboardPayload } from '@powerlifting/domain';

import type { EditableField } from '../types';
import type { DayRowSection, NextSessionFocusVM, WeekDaySection } from '../view-models';

import styles from '../dashboard-view.module.css';

interface TrainingPaneProps {
  isMobileHidden: boolean;
  payload: DashboardPayload | null;
  rows: BlockRow[];
  isLoading: boolean;
  isSaving: boolean;
  weekSections: WeekDaySection[];
  selectedWeekSection: WeekDaySection | null;
  selectedDaySection: DayRowSection | null;
  visibleRows: BlockRow[];
  nextSessionFocus: NextSessionFocusVM;
  getPendingFieldValue: (row: BlockRow, field: EditableField) => string;
  onPendingValueChange: (cellA1: string, field: EditableField, value: string) => void;
  getRowUpdates: (row: BlockRow) => Array<{ field: EditableField }>;
  getRowKey: (row: BlockRow) => string;
  onSaveRow: (row: BlockRow) => void;
  onSetActiveWeekKey: (key: string) => void;
  onSetActiveDayKey: (key: string) => void;
}

export function TrainingPane(props: TrainingPaneProps): JSX.Element {
  const {
    isMobileHidden,
    payload,
    rows,
    isLoading,
    isSaving,
    weekSections,
    selectedWeekSection,
    selectedDaySection,
    visibleRows,
    nextSessionFocus,
    getPendingFieldValue,
    onPendingValueChange,
    getRowUpdates,
    getRowKey,
    onSaveRow,
    onSetActiveWeekKey,
    onSetActiveDayKey
  } = props;

  return (
    <section
      id="pane-training"
      className={`${styles.panel} ${styles.pane} ${styles.trainingPane}`}
      data-pane="training"
      hidden={isMobileHidden}
      data-testid="training-pane"
    >
      <div className={styles.paneHeader}>
        <h2 className={styles.sectionTitle}>Editable Rows</h2>
        <p className={styles.sectionHint}>Week tabs + day tabs with inline edit/save parity.</p>
      </div>

      <div className={styles.paneBody}>
        <div className={styles.focusRow} data-testid="next-session-focus">
          <strong>{nextSessionFocus.headline}</strong>
          <span>{nextSessionFocus.details}</span>
        </div>

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
                      onSetActiveWeekKey(week.key);
                      onSetActiveDayKey('');
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
                      onClick={() => onSetActiveDayKey(day.key)}
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
                  Completion {Math.round(selectedDaySection.completionPct * 100)}% | Primary {Math.round(selectedDaySection.primaryCompletionPct * 100)}% | Rows {selectedDaySection.rows.length}
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
  );
}
