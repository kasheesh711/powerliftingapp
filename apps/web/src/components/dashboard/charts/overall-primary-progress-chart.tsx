import type { OverallTimelinePoint } from '@powerlifting/domain';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';

import { buildOverallTimelineSeries, type OverallTimelineDatum } from '../view-models';

import styles from './charts.module.css';

const seriesColors = {
  squat: 'var(--lift-squat)',
  bench: 'var(--lift-bench)',
  deadlift: 'var(--lift-deadlift)'
} as const;

const swatchClasses = {
  squat: styles.swatchSquat,
  bench: styles.swatchBench,
  deadlift: styles.swatchDeadlift
} as const;

function LiftTooltip({ active, payload, label, data }: TooltipProps<number, string> & { data: OverallTimelineDatum[] }) {
  if (!active || !payload?.length) {
    return null;
  }

  const index = typeof label === 'number' ? label : Number.parseInt(String(label), 10);
  const datum = Number.isNaN(index) ? null : data[index];

  return (
    <div className={styles.tooltipBox}>
      <div className={styles.tooltipLabel}>{datum ? datum.label : 'Timeline Point'}</div>
      {payload.map((entry) => {
        if (entry.value === null || entry.value === undefined) {
          return null;
        }

        return (
          <div key={entry.dataKey} className={styles.tooltipRow}>
            <span className={styles.tooltipName}>{entry.name}</span>
            <span className={styles.tooltipValue}>{Number(entry.value).toFixed(1)} kg</span>
          </div>
        );
      })}
    </div>
  );
}

export function OverallPrimaryProgressChart({ timeline }: { timeline: OverallTimelinePoint[] }): JSX.Element {
  const [enabled, setEnabled] = useState({
    squat: true,
    bench: true,
    deadlift: true
  });

  const series = useMemo(() => buildOverallTimelineSeries(timeline || []), [timeline]);

  function toggleLift(lift: keyof typeof enabled): void {
    setEnabled((current) => ({
      ...current,
      [lift]: !current[lift]
    }));
  }

  if (!series.data.length) {
    return <div className={styles.chartEmpty}>No cross-block timeline data is available yet.</div>;
  }

  if (!series.hasAnyValue || series.data.length < 2) {
    return <div className={styles.chartEmpty}>Need at least two timeline points with primary lift values.</div>;
  }

  const xTickInterval = series.data.length > 10 ? Math.ceil(series.data.length / 8) : 0;

  return (
    <section className={styles.chartPanel} data-testid="overall-chart-panel">
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>Overall Primary Progress</h3>
          <p className={styles.chartSubtitle}>Across blocks and weeks with transition markers.</p>
        </div>
      </div>

      <div className={styles.chartLegend}>
        {(Object.keys(enabled) as Array<keyof typeof enabled>).map((lift) => {
          const active = enabled[lift];
          const label = lift[0].toUpperCase() + lift.slice(1);

          return (
            <button
              key={lift}
              type="button"
              onClick={() => toggleLift(lift)}
              className={`${styles.legendButton} ${active ? styles.legendButtonActive : ''}`}
              aria-pressed={active}
              data-testid={`overall-legend-${lift}`}
            >
              <span className={`${styles.legendSwatch} ${swatchClasses[lift]}`} />
              <span className={active ? '' : styles.legendInactive}>{label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={series.data} margin={{ top: 8, right: 20, left: 4, bottom: 8 }}>
            <CartesianGrid stroke="var(--border-default)" strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="index"
              type="number"
              allowDecimals={false}
              tickFormatter={(value) => series.data[value]?.label || ''}
              interval={xTickInterval}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              stroke="var(--border-strong)"
            />
            <YAxis
              tickFormatter={(value) => `${value}`}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              stroke="var(--border-strong)"
              width={44}
            />
            <Tooltip content={<LiftTooltip data={series.data} />} />

            {series.boundaries.map((boundary) => (
              <ReferenceLine
                key={`${boundary.position}-${boundary.blockName}`}
                x={boundary.position}
                stroke="var(--border-strong)"
                strokeDasharray="2 6"
                ifOverflow="extendDomain"
              />
            ))}

            {enabled.squat ? (
              <Line
                type="monotone"
                dataKey="squat"
                name="Squat"
                stroke={seriesColors.squat}
                strokeWidth={2.4}
                dot={false}
                connectNulls
                isAnimationActive
                className="overall-line-squat"
              />
            ) : null}
            {enabled.bench ? (
              <Line
                type="monotone"
                dataKey="bench"
                name="Bench"
                stroke={seriesColors.bench}
                strokeWidth={2.4}
                dot={false}
                connectNulls
                isAnimationActive
                className="overall-line-bench"
              />
            ) : null}
            {enabled.deadlift ? (
              <Line
                type="monotone"
                dataKey="deadlift"
                name="Deadlift"
                stroke={seriesColors.deadlift}
                strokeWidth={2.4}
                dot={false}
                connectNulls
                isAnimationActive
                className="overall-line-deadlift"
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
