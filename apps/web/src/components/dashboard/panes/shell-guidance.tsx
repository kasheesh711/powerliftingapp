import type { DashboardShellState } from '../types';

import styles from '../dashboard-view.module.css';

interface ShellGuidanceProps {
  state: DashboardShellState;
  isAuthenticated: boolean;
  selectedBlock: string;
}

export function ShellGuidance({ state, isAuthenticated, selectedBlock }: ShellGuidanceProps): JSX.Element {
  if (state === 'ready') {
    return (
      <section className={`${styles.panel} ${styles.guidancePanel}`} data-testid="shell-guidance">
        <h2 className={styles.sectionTitle}>Dashboard Ready</h2>
        <p className={styles.sectionHint}>Data panes are available. Continue with logging and analysis.</p>
      </section>
    );
  }

  return (
    <section className={`${styles.panel} ${styles.guidancePanel}`} data-testid="shell-guidance">
      <h2 className={styles.sectionTitle}>Next Step</h2>
      {state === 'unauthenticated' ? (
        <>
          <p className={styles.guidanceText}>Sign in first so your dashboard selection and writes are tied to your account.</p>
          <a className={styles.buttonPrimaryLink} href="/api/auth/signin?callbackUrl=%2Fdashboard">
            Sign In
          </a>
        </>
      ) : (
        <>
          <p className={styles.guidanceText}>
            {isAuthenticated && selectedBlock
              ? 'Select a data source to continue.'
              : 'Select a block in Connection to unlock overview, analysis, and training panes.'}
          </p>
          <p className={styles.sectionHint}>Connection pane remains available while setup is incomplete.</p>
        </>
      )}
    </section>
  );
}
