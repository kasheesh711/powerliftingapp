'use client';

import { ConflictList, MetricCard } from '@powerlifting/ui';
import type { BlockRow, CellUpdateInput, DashboardPayload, InitialPayload, UpdateResult } from '@powerlifting/domain';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface SessionResponse {
  user?: {
    email?: string | null;
  };
}

interface SpreadsheetSelection {
  spreadsheetId: string;
  spreadsheetUrl?: string;
}

interface SpreadsheetSelectionResponse {
  selectedSpreadsheet: SpreadsheetSelection | null;
}

interface PickerConfigResponse {
  enabled: boolean;
  apiKey: string | null;
  appId: string | null;
}

interface PickerTokenResponse {
  accessToken: string;
  expiresAt: number | null;
}

interface ApiErrorResponse {
  error?: string;
  code?: string;
}

interface ConflictState {
  result: Extract<UpdateResult, { status: 'conflict' }>;
  updates: CellUpdateInput[];
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

function fieldKey(cellA1: string, field: 'actualLoad' | 'rpe'): string {
  return `${field}:${cellA1.toUpperCase()}`;
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

function getRowFieldValue(row: BlockRow, field: 'actualLoad' | 'rpe'): string {
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

  const updatePendingValue = useCallback((cellA1: string, field: 'actualLoad' | 'rpe', value: string) => {
    setPendingValues((current) => ({
      ...current,
      [fieldKey(cellA1, field)]: value
    }));
  }, []);

  const buildFieldUpdate = useCallback(
    (row: BlockRow, field: 'actualLoad' | 'rpe'): CellUpdateInput | null => {
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

      const payload = await parseJson<{
        spreadsheetId: string;
        spreadsheetUrl?: string;
      }>(response);

      setSelectedSpreadsheet({
        spreadsheetId: payload.spreadsheetId,
        spreadsheetUrl: payload.spreadsheetUrl
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

  const timeline = payload?.overallProgress.timeline || [];

  const timelineChart = useMemo(() => {
    if (!timeline.length) {
      return null;
    }

    const series = {
      squat: timeline.map((point) => point.squat?.loadKg ?? null),
      bench: timeline.map((point) => point.bench?.loadKg ?? null),
      deadlift: timeline.map((point) => point.deadlift?.loadKg ?? null)
    };

    const values = [...series.squat, ...series.bench, ...series.deadlift].filter(
      (value): value is number => value !== null
    );

    if (!values.length) {
      return null;
    }

    const width = 760;
    const height = 220;
    const paddingX = 28;
    const paddingY = 18;
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const span = maxValue - minValue || 1;

    function pointX(index: number): number {
      if (timeline.length === 1) {
        return width / 2;
      }
      const domain = width - paddingX * 2;
      return paddingX + (index / (timeline.length - 1)) * domain;
    }

    function pointY(value: number): number {
      const domain = height - paddingY * 2;
      return height - paddingY - ((value - minValue) / span) * domain;
    }

    function polyline(valuesInSeries: Array<number | null>): string {
      return valuesInSeries
        .map((value, index) => {
          if (value === null) {
            return null;
          }

          return `${pointX(index)},${pointY(value)}`;
        })
        .filter((point): point is string => Boolean(point))
        .join(' ');
    }

    return {
      width,
      height,
      squatPath: polyline(series.squat),
      benchPath: polyline(series.bench),
      deadliftPath: polyline(series.deadlift),
      labels: timeline.map((point) => point.label)
    };
  }, [timeline]);

  const editableRows = useMemo(() => payload?.blockData.rows.slice(0, 30) || [], [payload]);

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: 20,
        display: 'grid',
        gap: 16
      }}
    >
      <header
        style={{
          display: 'grid',
          gap: 10,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16
        }}
      >
        <h1 style={{ margin: 0 }}>Dashboard</h1>

        <section
          style={{
            display: 'grid',
            gap: 8,
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 12,
            background: '#fcfdff'
          }}
        >
          <strong>Connection</strong>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Session: {isAuthenticated ? sessionEmail : 'not signed in'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Selected spreadsheet: {selectedSpreadsheet?.spreadsheetId || 'none'}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {isAuthenticated ? (
              <a href="/api/auth/signout?callbackUrl=%2Fdashboard">Sign out</a>
            ) : (
              <a href="/api/auth/signin?callbackUrl=%2Fdashboard">Sign in</a>
            )}

            <button
              type="button"
              disabled={!isAuthenticated || !pickerConfig?.enabled || isPickerBusy}
              onClick={() => {
                void openDrivePicker().catch((e: unknown) => {
                  setConnectionError(asErrorMessage(e));
                });
              }}
            >
              {isPickerBusy ? 'Opening Picker...' : 'Select via Drive Picker'}
            </button>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitManualSelection().catch((e: unknown) => {
                setConnectionError(asErrorMessage(e));
              });
            }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
          >
            <input
              type="text"
              value={selectionInput}
              onChange={(event) => setSelectionInput(event.target.value)}
              placeholder="Spreadsheet URL or spreadsheet ID"
              style={{ flex: '1 1 360px', minWidth: 240, padding: 8 }}
            />
            <button type="submit" disabled={!isAuthenticated || !selectionInput.trim()}>
              Save Spreadsheet
            </button>
          </form>

          {!pickerConfig?.enabled && isAuthenticated ? (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Drive Picker is disabled until GOOGLE_PICKER_API_KEY and GOOGLE_PICKER_APP_ID are configured.
            </div>
          ) : null}
        </section>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Block</span>
            <select
              value={selectedBlock}
              onChange={(event) => setSelectedBlock(event.target.value)}
              style={{ width: 320, padding: 8 }}
            >
              {(initial?.blocks || [])
                .filter((entry) => entry.isBlock)
                .map((entry) => (
                  <option key={entry.name} value={entry.name}>
                    {entry.name}
                  </option>
                ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              void forceRefreshSelectedBlock().catch((e: unknown) => setError(asErrorMessage(e)));
            }}
            disabled={!selectedBlock || isLoading}
          >
            Force Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              void saveAll().catch((e: unknown) => setError(asErrorMessage(e)));
            }}
            disabled={!payload || isSaving || dirtyUpdateCount === 0}
          >
            Save All ({dirtyUpdateCount})
          </button>
        </div>
      </header>

      {error ? (
        <section
          style={{
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: 'var(--danger)',
            borderRadius: 10,
            padding: 12
          }}
        >
          {error}
        </section>
      ) : null}

      {connectionError ? (
        <section
          style={{
            border: '1px solid #fcd34d',
            background: '#fffbeb',
            color: '#92400e',
            borderRadius: 10,
            padding: 12
          }}
        >
          {connectionError}
        </section>
      ) : null}

      {payload ? (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12
          }}
        >
          <MetricCard label="Current Total" value={`${payload.stats.current.total.toFixed(1)} kg`} />
          <MetricCard label="Projected Total" value={`${payload.stats.projected.total.toFixed(1)} kg`} />
          <MetricCard label="Current DOTS" value={payload.stats.current.dots.toFixed(2)} />
          <MetricCard label="Projected DOTS" value={payload.stats.projected.dots.toFixed(2)} />
          <MetricCard label="Current Wilks" value={payload.stats.current.wilks.toFixed(2)} />
          <MetricCard label="Projected Wilks" value={payload.stats.projected.wilks.toFixed(2)} />
          <MetricCard label="Current GL" value={payload.stats.current.gl.toFixed(2)} />
          <MetricCard label="Projected GL" value={payload.stats.projected.gl.toFixed(2)} />
          <MetricCard
            label="Squat Delta"
            value={`${payload.stats.growth.squat.delta.toFixed(1)} kg`}
            detail={`${payload.stats.growth.squat.deltaPct.toFixed(1)}%`}
          />
          <MetricCard
            label="Bench Delta"
            value={`${payload.stats.growth.bench.delta.toFixed(1)} kg`}
            detail={`${payload.stats.growth.bench.deltaPct.toFixed(1)}%`}
          />
          <MetricCard
            label="Deadlift Delta"
            value={`${payload.stats.growth.deadlift.delta.toFixed(1)} kg`}
            detail={`${payload.stats.growth.deadlift.deltaPct.toFixed(1)}%`}
          />
        </section>
      ) : null}

      {payload ? (
        <section
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'var(--surface)',
            padding: 12
          }}
        >
          <h2 style={{ marginTop: 0 }}>Recap</h2>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div>
              <strong>Squat</strong>
              <div>{payload.blockData.recaps.squat || '-'}</div>
            </div>
            <div>
              <strong>Bench</strong>
              <div>{payload.blockData.recaps.bench || '-'}</div>
            </div>
            <div>
              <strong>Deadlift</strong>
              <div>{payload.blockData.recaps.deadlift || '-'}</div>
            </div>
            <div>
              <strong>Accessory</strong>
              <div>{payload.blockData.recaps.accessory || '-'}</div>
            </div>
            <div>
              <strong>Additions</strong>
              <div>{payload.blockData.recaps.additions || '-'}</div>
            </div>
            <div>
              <strong>Coach</strong>
              <div>{payload.blockData.recaps.coach || '-'}</div>
            </div>
          </div>
        </section>
      ) : null}

      <section
        style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--surface)',
          padding: 12,
          overflowX: 'auto'
        }}
      >
        <h2 style={{ marginTop: 0 }}>Primary Progress Timeline</h2>
        {!timelineChart ? (
          <p style={{ color: 'var(--muted)' }}>No timeline data available for this block set.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <svg width={timelineChart.width} height={timelineChart.height} role="img" aria-label="Primary progress timeline">
              <rect x={0} y={0} width={timelineChart.width} height={timelineChart.height} fill="#f8fafc" />
              <polyline fill="none" stroke="#b91c1c" strokeWidth={2} points={timelineChart.squatPath} />
              <polyline fill="none" stroke="#1d4ed8" strokeWidth={2} points={timelineChart.benchPath} />
              <polyline fill="none" stroke="#166534" strokeWidth={2} points={timelineChart.deadliftPath} />
            </svg>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted)' }}>
              <span>Squat</span>
              <span>Bench</span>
              <span>Deadlift</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
              {timelineChart.labels.map((label, index) => (
                <div key={`${label}-${index}`} style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section
        style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--surface)',
          padding: 12,
          overflowX: 'auto'
        }}
      >
        <h2 style={{ marginTop: 0 }}>Editable Rows (actualLoad / rpe)</h2>
        {isLoading ? <p>Loading...</p> : null}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Exercise</th>
              <th align="left">Week</th>
              <th align="left">Day</th>
              <th align="left">Actual Load</th>
              <th align="left">RPE</th>
              <th align="left">Row Status</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {editableRows.map((row) => {
              const rowUpdates = buildRowUpdates(row);
              const rowDirty = rowUpdates.length > 0;

              return (
                <tr key={`${row.rowIndex}-${row.actualLoadCell || row.rpeCell || row.exercise}`}>
                  <td>{row.exercise}</td>
                  <td>{row.weekLabel || row.weekIndex || '-'}</td>
                  <td>{row.dayLabel || row.dayIndex || '-'}</td>
                  <td>
                    {row.actualLoadCell ? (
                      <input
                        value={pendingValues[fieldKey(row.actualLoadCell, 'actualLoad')] ?? getRowFieldValue(row, 'actualLoad')}
                        onChange={(event) =>
                          updatePendingValue(row.actualLoadCell as string, 'actualLoad', event.target.value)
                        }
                        style={{ width: 96, padding: '6px 8px' }}
                      />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    {row.rpeCell ? (
                      <input
                        value={pendingValues[fieldKey(row.rpeCell, 'rpe')] ?? getRowFieldValue(row, 'rpe')}
                        onChange={(event) => updatePendingValue(row.rpeCell as string, 'rpe', event.target.value)}
                        style={{ width: 96, padding: '6px 8px' }}
                      />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{rowDirty ? 'Dirty' : 'Clean'}</td>
                  <td>
                    <button
                      type="button"
                      disabled={isSaving || !rowDirty}
                      onClick={() => {
                        void saveRow(row).catch((e: unknown) => setError(asErrorMessage(e)));
                      }}
                    >
                      Save Row
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {conflictState ? (
        <section
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.48)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 50
          }}
        >
          <div
            style={{
              width: 'min(720px, 100%)',
              borderRadius: 12,
              border: '1px solid #f59e0b',
              background: '#ffffff',
              padding: 16,
              display: 'grid',
              gap: 12
            }}
          >
            <h3 style={{ margin: 0 }}>Conflicts detected</h3>
            <ConflictList conflicts={conflictState.result.conflicts} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setConflictState(null);
                }}
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setConflictState(null);
                  void forceRefreshSelectedBlock().catch((e: unknown) => setError(asErrorMessage(e)));
                }}
              >
                Reload Data
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitUpdates(conflictState.updates, true).catch((e: unknown) => setError(asErrorMessage(e)));
                }}
              >
                Overwrite Anyway
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
