'use client';

import type { BlockRow, CellUpdateInput, DashboardPayload, InitialPayload, UpdateResult } from '@powerlifting/domain';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DashboardView } from './dashboard/dashboard-view';
import type { ConflictState, EditableField, PickerConfigResponse, SpreadsheetSelection } from './dashboard/types';

interface SessionResponse {
  user?: {
    email?: string | null;
  };
}

interface SpreadsheetSelectionResponse {
  selectedSpreadsheet: SpreadsheetSelection | null;
}

interface PickerTokenResponse {
  accessToken: string;
  expiresAt: number | null;
}

interface ApiErrorResponse {
  error?: string;
  code?: string;
}

declare global {
  interface Window {
    google?: {
      picker?: any;
    };
    gapi?: {
      load?: (module: string, callback: () => void) => void;
    };
  }
}

let pickerScriptPromise: Promise<void> | null = null;

function fieldKey(cellA1: string, field: EditableField): string {
  return `${field}:${cellA1.toUpperCase()}`;
}

function rowKey(row: BlockRow): string {
  return `${row.rowIndex}-${row.actualLoadCell || 'no-load'}-${row.rpeCell || 'no-rpe'}-${row.exercise}`;
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function assertOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const payload = await parseJson<ApiErrorResponse>(response).catch(() => ({}) as ApiErrorResponse);
  throw new Error(payload.error || `Request failed with status ${response.status}`);
}

function isGoogleSheetUrl(value: string): boolean {
  return /docs\.google\.com\/spreadsheets\/d\//i.test(value);
}

function getRowFieldValue(row: BlockRow, field: EditableField): string {
  if (field === 'actualLoad') {
    return row.actualLoadKg === null ? '' : String(row.actualLoadKg);
  }

  return row.rpe || '';
}

function loadGooglePickerScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Picker is only available in the browser.'));
  }

  if (window.google?.picker && window.gapi?.load) {
    return Promise.resolve();
  }

  if (pickerScriptPromise) {
    return pickerScriptPromise;
  }

  pickerScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-picker="true"]');

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Picker script.')), {
        once: true
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.dataset.googlePicker = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Picker script.'));
    document.head.appendChild(script);
  });

  return pickerScriptPromise;
}

export function DashboardClient(): JSX.Element {
  const [initial, setInitial] = useState<InitialPayload | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<SpreadsheetSelection | null>(null);
  const [pickerConfig, setPickerConfig] = useState<PickerConfigResponse | null>(null);

  const [selectionInput, setSelectionInput] = useState('');
  const [pendingValues, setPendingValues] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPickerBusy, setIsPickerBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);

  const isAuthenticated = Boolean(sessionEmail);

  const loadSessionAndSelection = useCallback(async (): Promise<void> => {
    const sessionResponse = await fetch('/api/auth/session');
    await assertOk(sessionResponse);
    const sessionJson = await parseJson<SessionResponse | null>(sessionResponse);
    const email = sessionJson?.user?.email?.toLowerCase() || null;

    setSessionEmail(email);

    if (!email) {
      setSelectedSpreadsheet(null);
      setPickerConfig(null);
      return;
    }

    const [selectionResponse, pickerConfigResponse] = await Promise.all([
      fetch('/api/spreadsheets/select'),
      fetch('/api/spreadsheets/picker-config')
    ]);

    if (selectionResponse.status === 401) {
      setSelectedSpreadsheet(null);
    } else {
      await assertOk(selectionResponse);
      const selectionJson = await parseJson<SpreadsheetSelectionResponse>(selectionResponse);
      setSelectedSpreadsheet(selectionJson.selectedSpreadsheet);
    }

    if (pickerConfigResponse.status === 401) {
      setPickerConfig(null);
    } else {
      await assertOk(pickerConfigResponse);
      const pickerJson = await parseJson<PickerConfigResponse>(pickerConfigResponse);
      setPickerConfig(pickerJson);
    }
  }, []);

  const loadInitial = useCallback(
    async (preferredBlock?: string): Promise<string> => {
      const response = await fetch('/api/dashboard/initial');
      await assertOk(response);

      const data = await parseJson<InitialPayload>(response);
      setInitial(data);

      const availableBlockNames = data.blocks.filter((entry) => entry.isBlock).map((entry) => entry.name);
      const nextBlock = preferredBlock && availableBlockNames.includes(preferredBlock) ? preferredBlock : availableBlockNames[0] || '';

      setSelectedBlock(nextBlock);
      return nextBlock;
    },
    []
  );

  const loadBlock = useCallback(async (blockName: string, forceRefresh = false): Promise<void> => {
    if (!blockName) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const query = forceRefresh ? '?forceRefresh=true' : '';
      const response = await fetch(`/api/dashboard/block/${encodeURIComponent(blockName)}${query}`);
      await assertOk(response);
      const data = await parseJson<DashboardPayload>(response);
      setPayload(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      setError(null);
      setConnectionError(null);
      await loadSessionAndSelection();
      await loadInitial();
    }

    bootstrap().catch((e: unknown) => {
      if (!cancelled) {
        const message = asErrorMessage(e);
        setError(message);
        setConnectionError(message);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadInitial, loadSessionAndSelection]);

  useEffect(() => {
    if (!selectedBlock) {
      return;
    }

    let cancelled = false;

    loadBlock(selectedBlock).catch((e: unknown) => {
      if (!cancelled) {
        setError(asErrorMessage(e));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadBlock, selectedBlock]);

  useEffect(() => {
    if (!payload) {
      return;
    }

    const next: Record<string, string> = {};

    for (const row of payload.blockData.rows) {
      if (row.actualLoadCell) {
        next[fieldKey(row.actualLoadCell, 'actualLoad')] = getRowFieldValue(row, 'actualLoad');
      }

      if (row.rpeCell) {
        next[fieldKey(row.rpeCell, 'rpe')] = getRowFieldValue(row, 'rpe');
      }
    }

    setPendingValues(next);
  }, [payload]);

  const updatePendingValue = useCallback((cellA1: string, field: EditableField, value: string) => {
    setPendingValues((current) => ({
      ...current,
      [fieldKey(cellA1, field)]: value
    }));
  }, []);

  const getPendingFieldValue = useCallback(
    (row: BlockRow, field: EditableField): string => {
      const cellA1 = field === 'actualLoad' ? row.actualLoadCell : row.rpeCell;
      if (!cellA1) {
        return '';
      }

      return pendingValues[fieldKey(cellA1, field)] ?? getRowFieldValue(row, field);
    },
    [pendingValues]
  );

  const buildFieldUpdate = useCallback(
    (row: BlockRow, field: EditableField): CellUpdateInput | null => {
      const cellA1 = field === 'actualLoad' ? row.actualLoadCell : row.rpeCell;
      if (!cellA1) {
        return null;
      }

      const key = fieldKey(cellA1, field);
      const nextValue = pendingValues[key] ?? getRowFieldValue(row, field);
      const originalValue = field === 'actualLoad' ? row.actualLoadKg : row.rpe;

      if (nextValue === String(originalValue ?? '')) {
        return null;
      }

      return {
        cellA1,
        field,
        originalValue,
        newValue: nextValue
      };
    },
    [pendingValues]
  );

  const buildRowUpdates = useCallback(
    (row: BlockRow): CellUpdateInput[] => {
      const updates: CellUpdateInput[] = [];
      const actualUpdate = buildFieldUpdate(row, 'actualLoad');
      const rpeUpdate = buildFieldUpdate(row, 'rpe');

      if (actualUpdate) {
        updates.push(actualUpdate);
      }

      if (rpeUpdate) {
        updates.push(rpeUpdate);
      }

      return updates;
    },
    [buildFieldUpdate]
  );

  const allPendingUpdates = useMemo(() => {
    if (!payload) {
      return [] as CellUpdateInput[];
    }

    const updates: CellUpdateInput[] = [];
    for (const row of payload.blockData.rows) {
      updates.push(...buildRowUpdates(row));
    }

    return updates;
  }, [buildRowUpdates, payload]);

  const dirtyUpdateCount = allPendingUpdates.length;

  const submitUpdates = useCallback(
    async (updates: CellUpdateInput[], forceOverwrite: boolean): Promise<void> => {
      if (!selectedBlock || updates.length === 0) {
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(`/api/dashboard/block/${encodeURIComponent(selectedBlock)}/updates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            updates,
            forceOverwrite
          })
        });

        const json = await parseJson<UpdateResult | ApiErrorResponse>(response);

        if (response.status === 409 && (json as UpdateResult).status === 'conflict') {
          setConflictState({
            result: json as Extract<UpdateResult, { status: 'conflict' }>,
            updates
          });
          return;
        }

        if (!response.ok) {
          throw new Error((json as ApiErrorResponse).error || 'Failed to save dashboard changes.');
        }

        if ((json as UpdateResult).status !== 'ok') {
          throw new Error('Unexpected update response from server.');
        }

        setConflictState(null);
        await loadBlock(selectedBlock, true);
      } finally {
        setIsSaving(false);
      }
    },
    [loadBlock, selectedBlock]
  );

  const saveRow = useCallback(
    async (row: BlockRow): Promise<void> => {
      const updates = buildRowUpdates(row);
      await submitUpdates(updates, false);
    },
    [buildRowUpdates, submitUpdates]
  );

  const saveAll = useCallback(async (): Promise<void> => {
    await submitUpdates(allPendingUpdates, false);
  }, [allPendingUpdates, submitUpdates]);

  const applySpreadsheetSelection = useCallback(
    async (input: { spreadsheetId?: string; spreadsheetUrl?: string }): Promise<void> => {
      setConnectionError(null);

      const response = await fetch('/api/spreadsheets/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      });

      await assertOk(response);

      const nextSelection = await parseJson<{
        spreadsheetId: string;
        spreadsheetUrl?: string;
      }>(response);

      setSelectedSpreadsheet({
        spreadsheetId: nextSelection.spreadsheetId,
        spreadsheetUrl: nextSelection.spreadsheetUrl
      });

      await loadSessionAndSelection();
      const nextBlock = await loadInitial(selectedBlock);
      if (nextBlock) {
        await loadBlock(nextBlock, true);
      }
    },
    [loadBlock, loadInitial, loadSessionAndSelection, selectedBlock]
  );

  const submitManualSelection = useCallback(async (): Promise<void> => {
    const value = selectionInput.trim();
    if (!value) {
      return;
    }

    if (isGoogleSheetUrl(value)) {
      await applySpreadsheetSelection({ spreadsheetUrl: value });
    } else {
      await applySpreadsheetSelection({ spreadsheetId: value });
    }

    setSelectionInput('');
  }, [applySpreadsheetSelection, selectionInput]);

  const openDrivePicker = useCallback(async (): Promise<void> => {
    if (!pickerConfig?.enabled || !pickerConfig.apiKey || !pickerConfig.appId) {
      throw new Error('Google Drive Picker is not configured. Set GOOGLE_PICKER_API_KEY and GOOGLE_PICKER_APP_ID.');
    }

    setIsPickerBusy(true);
    setConnectionError(null);

    try {
      const tokenResponse = await fetch('/api/spreadsheets/picker-token');
      await assertOk(tokenResponse);
      const token = await parseJson<PickerTokenResponse>(tokenResponse);

      await loadGooglePickerScript();

      await new Promise<void>((resolve, reject) => {
        if (!window.gapi?.load) {
          reject(new Error('Google API loader is unavailable.'));
          return;
        }

        window.gapi.load('picker', () => resolve());
      });

      if (!window.google?.picker) {
        throw new Error('Google Picker API is unavailable after loading script.');
      }

      const picker = new window.google.picker.PickerBuilder()
        .addView(window.google.picker.ViewId.SPREADSHEETS)
        .setOAuthToken(token.accessToken)
        .setDeveloperKey(pickerConfig.apiKey)
        .setAppId(pickerConfig.appId)
        .setCallback((data: {
          action?: string;
          docs?: Array<{ id?: string; url?: string }>;
        }) => {
          if (data.action !== window.google?.picker?.Action?.PICKED) {
            return;
          }

          const doc = data.docs?.[0];
          if (!doc?.id) {
            return;
          }

          void applySpreadsheetSelection({
            spreadsheetId: doc.id,
            spreadsheetUrl: doc.url
          }).catch((e: unknown) => {
            setConnectionError(asErrorMessage(e));
          });
        })
        .build();

      picker.setVisible(true);
    } finally {
      setIsPickerBusy(false);
    }
  }, [applySpreadsheetSelection, pickerConfig]);

  const forceRefreshSelectedBlock = useCallback(async (): Promise<void> => {
    if (!selectedBlock) {
      return;
    }

    await loadBlock(selectedBlock, true);
  }, [loadBlock, selectedBlock]);

  const handleSubmitManualSelection = useCallback(() => {
    void submitManualSelection().catch((e: unknown) => {
      setConnectionError(asErrorMessage(e));
    });
  }, [submitManualSelection]);

  const handleOpenDrivePicker = useCallback(() => {
    void openDrivePicker().catch((e: unknown) => {
      setConnectionError(asErrorMessage(e));
    });
  }, [openDrivePicker]);

  const handleForceRefresh = useCallback(() => {
    void forceRefreshSelectedBlock().catch((e: unknown) => {
      setError(asErrorMessage(e));
    });
  }, [forceRefreshSelectedBlock]);

  const handleSaveAll = useCallback(() => {
    void saveAll().catch((e: unknown) => {
      setError(asErrorMessage(e));
    });
  }, [saveAll]);

  const handleSaveRow = useCallback(
    (row: BlockRow) => {
      void saveRow(row).catch((e: unknown) => {
        setError(asErrorMessage(e));
      });
    },
    [saveRow]
  );

  const handleReloadConflict = useCallback(() => {
    setConflictState(null);
    void forceRefreshSelectedBlock().catch((e: unknown) => {
      setError(asErrorMessage(e));
    });
  }, [forceRefreshSelectedBlock]);

  const handleOverwriteConflict = useCallback(() => {
    if (!conflictState) {
      return;
    }

    void submitUpdates(conflictState.updates, true).catch((e: unknown) => {
      setError(asErrorMessage(e));
    });
  }, [conflictState, submitUpdates]);

  return (
    <DashboardView
      initial={initial}
      payload={payload}
      selectedBlock={selectedBlock}
      onSelectedBlockChange={setSelectedBlock}
      isLoading={isLoading}
      isSaving={isSaving}
      isPickerBusy={isPickerBusy}
      error={error}
      connectionError={connectionError}
      conflictState={conflictState}
      sessionEmail={sessionEmail}
      isAuthenticated={isAuthenticated}
      selectedSpreadsheet={selectedSpreadsheet}
      pickerConfig={pickerConfig}
      selectionInput={selectionInput}
      dirtyUpdateCount={dirtyUpdateCount}
      onSelectionInputChange={setSelectionInput}
      onSubmitManualSelection={handleSubmitManualSelection}
      onOpenDrivePicker={handleOpenDrivePicker}
      onForceRefresh={handleForceRefresh}
      onSaveAll={handleSaveAll}
      onSaveRow={handleSaveRow}
      onDismissConflict={() => setConflictState(null)}
      onReloadConflict={handleReloadConflict}
      onOverwriteConflict={handleOverwriteConflict}
      getPendingFieldValue={getPendingFieldValue}
      onPendingValueChange={updatePendingValue}
      getRowUpdates={buildRowUpdates}
      getRowKey={rowKey}
    />
  );
}
