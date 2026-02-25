import type { BlockRow } from '@powerlifting/domain';
import { Fragment, useMemo } from 'react';

import { BlockPrimaryProgressChart } from './charts/block-primary-progress-chart';
import { GrowthDeltaChart } from './charts/growth-delta-chart';
import { OverallPrimaryProgressChart } from './charts/overall-primary-progress-chart';
import type { DashboardViewProps } from './types';
import { groupRowsByWeek } from './view-models';

import styles from './dashboard-view.module.css';

function formatKg(value: number): string {
  return `${value.toFixed(1)} kg`;
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

function weekDisplay(row: BlockRow): string {
  if (row.weekLabel) {
    return row.weekLabel;
  }

  if (row.weekIndex) {
    return `Week ${row.weekIndex}`;
  }

  return '-';
}

function dayDisplay(row: BlockRow): string {
  if (row.dayLabel) {
    return row.dayLabel;
  }

  if (row.dayIndex) {
    return `Day ${row.dayIndex}`;
  }

  return '-';
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

  const blockOptions = useMemo(
    () => (initial?.blocks || []).filter((entry) => entry.isBlock).map((entry) => entry.name),
    [initial]
  );

  const rowGroups = useMemo(() => groupRowsByWeek(payload?.blockData.rows || []), [payload]);

  const metrics = payload
    ? [
        {
          label: 'Current Total',
          value: formatKg(payload.stats.current.total),
          detail: `DOTS ${formatScore(payload.stats.current.dots)} | Wilks ${formatScore(payload.stats.current.wilks)} | GL ${formatScore(payload.stats.current.gl)}`,
          hero: true
        },
        {
          label: 'Projected Total',
          value: formatKg(payload.stats.projected.total),
          detail: `${payload.stats.growth.total.delta >= 0 ? '+' : ''}${formatKg(payload.stats.growth.total.delta)} (${payload.stats.growth.total.deltaPct.toFixed(1)}%)`,
          hero: true
        },
        {
          label: 'Current DOTS',
          value: formatScore(payload.stats.current.dots),
          detail: 'Current coefficient score'
        },
        {
          label: 'Projected DOTS',
          value: formatScore(payload.stats.projected.dots),
          detail: 'Projected coefficient score'
        },
        {
          label: 'Current Wilks',
          value: formatScore(payload.stats.current.wilks),
          detail: 'Current Wilks points'
        },
        {
          label: 'Projected Wilks',
          value: formatScore(payload.stats.projected.wilks),
          detail: 'Projected Wilks points'
        },
        {
          label: 'Current GL',
          value: formatScore(payload.stats.current.gl),
          detail: 'Current Goodlift points'
        },
        {
          label: 'Projected GL',
          value: formatScore(payload.stats.projected.gl),
          detail: 'Projected Goodlift points'
        },
        {
          label: 'Squat Delta',
          value: formatKg(payload.stats.growth.squat.delta),
          detail: `${payload.stats.growth.squat.deltaPct.toFixed(1)}%`
        },
        {
          label: 'Bench Delta',
          value: formatKg(payload.stats.growth.bench.delta),
          detail: `${payload.stats.growth.bench.deltaPct.toFixed(1)}%`
        },
        {
          label: 'Deadlift Delta',
          value: formatKg(payload.stats.growth.deadlift.delta),
          detail: `${payload.stats.growth.deadlift.deltaPct.toFixed(1)}%`
        }
      ]
    : [];

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
          <section className={styles.metricsGrid} data-testid="metrics-grid">
            {metrics.map((metric, index) => (
              <article
                key={metric.label}
                className={`${styles.metricCard} ${metric.hero && index < 2 ? styles.metricCardHero : ''}`}
              >
                <p className={styles.metricLabel}>{metric.label}</p>
                <p className={styles.metricValue}>{metric.value}</p>
                {metric.detail ? <p className={styles.metricDetail}>{metric.detail}</p> : null}
              </article>
            ))}
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

        {payload ? (
          <section className={styles.chartsGrid}>
            <div className={`${styles.panel} ${styles.chartCardWide}`}>
              <OverallPrimaryProgressChart timeline={payload.overallProgress.timeline} />
            </div>
            <div className={`${styles.panel} ${styles.chartCard}`}>
              <BlockPrimaryProgressChart primaryByWeek={payload.stats.primaryByWeek} />
            </div>
            <div className={`${styles.panel} ${styles.chartCard}`}>
              <GrowthDeltaChart growth={payload.stats.growth} />
            </div>
          </section>
        ) : null}

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Editable Rows (Actual Load / RPE)</h2>
            <p className={styles.sectionHint}>
              Full-row visibility with week separators and sticky headers for dense editing.
            </p>
          </div>

          {isLoading ? <p className={styles.sectionHint}>Loading block data...</p> : null}

          {!payload || !payload.blockData.rows.length ? (
            <p className={styles.sectionHint}>No editable rows available for this block.</p>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table} data-testid="editable-rows-table">
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>Week</th>
                    <th>Day</th>
                    <th>Actual Load</th>
                    <th>RPE</th>
                    <th>Row Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rowGroups.map((group) => (
                    <Fragment key={group.key}>
                      <tr className={styles.weekDivider} data-testid="week-divider">
                        <td colSpan={7}>
                          {group.label} | {group.rows.length} rows
                        </td>
                      </tr>

                      {group.rows.map((row) => {
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
                                <span className={styles.exerciseMeta}>{row.dayName || dayDisplay(row)}</span>
                              </div>
                            </td>
                            <td>{weekDisplay(row)}</td>
                            <td>{dayDisplay(row)}</td>
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
