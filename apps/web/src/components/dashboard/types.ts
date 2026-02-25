import type { BlockRow, CellUpdateInput, DashboardPayload, InitialPayload, UpdateResult } from '@powerlifting/domain';

export type EditableField = 'actualLoad' | 'rpe';

export interface SpreadsheetSelection {
  spreadsheetId: string;
  spreadsheetUrl?: string;
}

export interface PickerConfigResponse {
  enabled: boolean;
  apiKey: string | null;
  appId: string | null;
}

export interface ConflictState {
  result: Extract<UpdateResult, { status: 'conflict' }>;
  updates: CellUpdateInput[];
}

export interface DashboardViewProps {
  initial: InitialPayload | null;
  payload: DashboardPayload | null;
  selectedBlock: string;
  onSelectedBlockChange: (value: string) => void;
  isLoading: boolean;
  isSaving: boolean;
  isPickerBusy: boolean;
  error: string | null;
  connectionError: string | null;
  conflictState: ConflictState | null;
  sessionEmail: string | null;
  isAuthenticated: boolean;
  selectedSpreadsheet: SpreadsheetSelection | null;
  pickerConfig: PickerConfigResponse | null;
  selectionInput: string;
  dirtyUpdateCount: number;
  onSelectionInputChange: (value: string) => void;
  onSubmitManualSelection: () => void;
  onOpenDrivePicker: () => void;
  onForceRefresh: () => void;
  onSaveAll: () => void;
  onSaveRow: (row: BlockRow) => void;
  onDismissConflict: () => void;
  onReloadConflict: () => void;
  onOverwriteConflict: () => void;
  getPendingFieldValue: (row: BlockRow, field: EditableField) => string;
  onPendingValueChange: (cellA1: string, field: EditableField, value: string) => void;
  getRowUpdates: (row: BlockRow) => CellUpdateInput[];
  getRowKey: (row: BlockRow) => string;
}
