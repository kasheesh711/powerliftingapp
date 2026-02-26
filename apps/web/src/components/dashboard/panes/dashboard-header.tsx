import styles from '../dashboard-view.module.css';

interface DashboardHeaderProps {
  dirtyUpdateCount: number;
  isLoading: boolean;
  isSaving: boolean;
  selectedBlock: string;
  hasPayload: boolean;
  isAuthenticated: boolean;
  sessionEmail: string | null;
  selectedSpreadsheetId: string;
  currentPositionLabel: string;
  onForceRefresh: () => void;
  onSaveAll: () => void;
}

export function DashboardHeader(props: DashboardHeaderProps): JSX.Element {
  const {
    dirtyUpdateCount,
    isLoading,
    isSaving,
    selectedBlock,
    hasPayload,
    isAuthenticated,
    sessionEmail,
    selectedSpreadsheetId,
    currentPositionLabel,
    onForceRefresh,
    onSaveAll
  } = props;

  return (
    <header className={`${styles.panel} ${styles.commandDeck}`}>
      <div className={styles.commandHeader}>
        <div>
          <h1 className={styles.title}>Powerlifting Performance Dashboard</h1>
          <p className={styles.subtitle}>Execution-first dashboard for training flow, statistics, and meet preparation.</p>
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
              disabled={!hasPayload || isSaving || dirtyUpdateCount === 0}
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
          <span className={styles.statusValue}>{selectedSpreadsheetId}</span>
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
  );
}
