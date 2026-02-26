import type { BlockRow, CellUpdateInput, DashboardPayload, InitialPayload, UpdateResult } from '@powerlifting/domain';

export type EditableField = 'actualLoad' | 'rpe';

export type DashboardPane = 'overview' | 'training' | 'analysis' | 'connection';

export type AnalysisSlot = 'blockComparison' | 'meetProjection' | 'recap';

export type DashboardViewportMode = 'desktop' | 'mobile';
export type DashboardShellState = 'unauthenticated' | 'authenticated_no_block' | 'ready';

export type PromptTemplateId =
  | 'weekly_training_review'
  | 'attempt_selection_planner'
  | 'adjustment_decision_prompt';

export interface PromptContextVM {
  generatedAt: string;
  blockName: string;
  weekLabel: string;
  dayLabel: string;
  completionPct: number;
  primaryCompletionPct: number;
  currentTotalKg: number;
  projectedTotalKg: number;
  projectedLowTotalKg: number;
  projectedHighTotalKg: number;
  weeksRemaining: number;
  ratesKgPerWeek: {
    squat: number;
    bench: number;
    deadlift: number;
  };
}

export interface DashboardUiState {
  activePane: DashboardPane;
  activeWeek: string;
  activeDay: string;
  activeAnalysisSlot: AnalysisSlot;
}

export interface SpreadsheetSelection {
  spreadsheetId: string;
  spreadsheetUrl?: string;
}

export interface PickerConfigResponse {
  enabled: boolean;
  apiKey: string | null;
  appId: string | null;
}

export type ProjectionSource = 'manual' | 'inferred';

export interface ProjectionControlsState {
  meetDate: string;
  currentWeek: number | null;
  currentDay: number | null;
  source: ProjectionSource;
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
