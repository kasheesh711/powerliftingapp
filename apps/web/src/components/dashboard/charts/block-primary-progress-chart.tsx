import type { PrimaryByWeek } from '@powerlifting/domain';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';

import { buildBlockPrimaryWeekSeries, type BlockPrimaryWeekDatum } from '../view-models';

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

function WeekTooltip({ active, payload, label, data }: TooltipProps<number, string> & { data: BlockPrimaryWeekDatum[] }) {
  if (!active || !payload?.length) {
    return null;
  }

  const index = typeof label === 'number' ? label : Number.parseInt(String(label), 10);
  const datum = Number.isNaN(index) ? null : data[index];

  return (
    <div className={styles.tooltipBox}>
      <div className={styles.tooltipLabel}>{datum ? `Week ${datum.weekIndex}` : 'Week'}</div>
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

export function BlockPrimaryProgressChart({ primaryByWeek }: { primaryByWeek: PrimaryByWeek | null | undefined }): JSX.Element {
  const [enabled, setEnabled] = useState({
    squat: true,
    bench: true,
    deadlift: true
  });

  const series = useMemo(() => buildBlockPrimaryWeekSeries(primaryByWeek), [primaryByWeek]);

  function toggleLift(lift: keyof typeof enabled): void {
    setEnabled((current) => ({
      ...current,
      [lift]: !current[lift]
    }));
  }

  if (!series.data.length) {
    return <div className={styles.chartEmpty}>No weekly primary-lift data found for this block.</div>;
  }

  if (!series.hasAnyValue || series.data.length < 2) {
    return <div className={styles.chartEmpty}>Need at least two weekly points to render block trend lines.</div>;
  }

  return (
    <section className={styles.chartPanel} data-testid="block-chart-panel">
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>Current Block Lift Trend</h3>
          <p className={styles.chartSubtitle}>Week-by-week best performed load.</p>
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
              data-testid={`block-legend-${lift}`}
            >
              <span className={`${styles.legendSwatch} ${swatchClasses[lift]}`} />
              <span className={active ? '' : styles.legendInactive}>{label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={276}>
          <LineChart data={series.data} margin={{ top: 8, right: 20, left: 4, bottom: 8 }}>
            <CartesianGrid stroke="var(--border-default)" strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="index"
              type="number"
              allowDecimals={false}
              tickFormatter={(value) => series.data[value]?.label || ''}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              stroke="var(--border-strong)"
            />
            <YAxis
              tickFormatter={(value) => `${value}`}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              stroke="var(--border-strong)"
              width={44}
            />
            <Tooltip content={<WeekTooltip data={series.data} />} />

            {enabled.squat ? (
              <Line
                type="monotone"
                dataKey="squat"
                name="Squat"
                stroke={seriesColors.squat}
                strokeWidth={2.3}
                dot={false}
                connectNulls
                className="block-line-squat"
              />
            ) : null}
            {enabled.bench ? (
              <Line
                type="monotone"
                dataKey="bench"
                name="Bench"
                stroke={seriesColors.bench}
                strokeWidth={2.3}
                dot={false}
                connectNulls
                className="block-line-bench"
              />
            ) : null}
            {enabled.deadlift ? (
              <Line
                type="monotone"
                dataKey="deadlift"
                name="Deadlift"
                stroke={seriesColors.deadlift}
                strokeWidth={2.3}
                dot={false}
                connectNulls
                className="block-line-deadlift"
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
