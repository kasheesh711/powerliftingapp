import styles from '../dashboard-view.module.css';

interface ConnectionPaneProps {
  isMobileHidden: boolean;
  isAuthenticated: boolean;
  isPickerBusy: boolean;
  pickerEnabled: boolean;
  selectionInput: string;
  selectedBlock: string;
  blockOptions: string[];
  onSelectionInputChange: (value: string) => void;
  onSubmitManualSelection: () => void;
  onOpenDrivePicker: () => void;
  onSelectedBlockChange: (value: string) => void;
}

export function ConnectionPane(props: ConnectionPaneProps): JSX.Element {
  const {
    isMobileHidden,
    isAuthenticated,
    isPickerBusy,
    pickerEnabled,
    selectionInput,
    selectedBlock,
    blockOptions,
    onSelectionInputChange,
    onSubmitManualSelection,
    onOpenDrivePicker,
    onSelectedBlockChange
  } = props;

  return (
    <section
      id="pane-connection"
      className={`${styles.panel} ${styles.pane} ${styles.connectionPane}`}
      data-pane="connection"
      hidden={isMobileHidden}
      data-testid="connection-pane"
    >
      <div className={styles.paneHeader}>
        <h2 className={styles.sectionTitle}>Connection + Controls</h2>
        <p className={styles.sectionHint}>Authentication, spreadsheet source, and block selection.</p>
      </div>

      <div className={styles.paneBody}>
        <div className={styles.linkRow}>
          {isAuthenticated ? (
            <a href="/api/auth/signout?callbackUrl=%2Fdashboard">Sign out</a>
          ) : (
            <a href="/api/auth/signin?callbackUrl=%2Fdashboard">Sign in</a>
          )}
          <button
            type="button"
            className={styles.buttonSecondary}
            disabled={!isAuthenticated || !pickerEnabled || isPickerBusy}
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
          <button type="submit" className={styles.buttonPrimary} disabled={!isAuthenticated || !selectionInput.trim()}>
            Save Spreadsheet
          </button>
        </form>

        {!pickerEnabled && isAuthenticated ? (
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
  );
}
