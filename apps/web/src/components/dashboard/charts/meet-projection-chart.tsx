import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';

import type { MeetProjectionVM } from '../view-models';

import styles from './charts.module.css';

interface ProjectionPoint {
  label: string;
  current: number;
  low: number;
  base: number;
  high: number;
}

function ProjectionTooltip({ active, payload }: TooltipProps<number, string>): JSX.Element | null {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload as ProjectionPoint | undefined;
  if (!point) {
    return null;
  }

  return (
    <div className={styles.tooltipBox}>
      <div className={styles.tooltipLabel}>{point.label}</div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipName}>Current</span>
        <span className={styles.tooltipValue}>{point.current.toFixed(1)} kg</span>
      </div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipName}>Low</span>
        <span className={styles.tooltipValue}>{point.low.toFixed(1)} kg</span>
      </div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipName}>Base</span>
        <span className={styles.tooltipValue}>{point.base.toFixed(1)} kg</span>
      </div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipName}>High</span>
        <span className={styles.tooltipValue}>{point.high.toFixed(1)} kg</span>
      </div>
    </div>
  );
}

export function MeetProjectionChart({ projection }: { projection: MeetProjectionVM }): JSX.Element {
  const data: ProjectionPoint[] = [
    {
      label: 'Squat',
      current: projection.current.squat,
      low: projection.scenarios.low.squat,
      base: projection.scenarios.base.squat,
      high: projection.scenarios.high.squat
    },
    {
      label: 'Bench',
      current: projection.current.bench,
      low: projection.scenarios.low.bench,
      base: projection.scenarios.base.bench,
      high: projection.scenarios.high.bench
    },
    {
      label: 'Deadlift',
      current: projection.current.deadlift,
      low: projection.scenarios.low.deadlift,
      base: projection.scenarios.base.deadlift,
      high: projection.scenarios.high.deadlift
    },
    {
      label: 'Total',
      current: projection.current.total,
      low: projection.scenarios.low.total,
      base: projection.scenarios.base.total,
      high: projection.scenarios.high.total
    }
  ];

  return (
    <section className={styles.chartPanel} data-testid="meet-projection-chart-panel">
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>Meet Projection Runway</h3>
          <p className={styles.chartSubtitle}>
            {projection.meetDate} in {projection.weeksRemaining} weeks. Total scenario range{' '}
            {projection.scenarios.low.total.toFixed(1)}-{projection.scenarios.high.total.toFixed(1)} kg (confidence{' '}
            {projection.scenarios.confidenceScore.toFixed(0)}%).
          </p>
        </div>
      </div>

      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 18, left: 2, bottom: 8 }}>
            <CartesianGrid stroke="var(--border-default)" strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--border-strong)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value) => `${value}`}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--border-strong)' }}
              tickLine={false}
              width={44}
            />
            <Tooltip content={<ProjectionTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              formatter={(value) => <span className={styles.legendText}>{String(value)}</span>}
              iconSize={9}
            />
            <Bar dataKey="current" name="Current" fill="var(--surface-3)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="low" name="Low" fill="var(--danger)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="base" name="Base" fill="var(--accent-primary)" radius={[5, 5, 0, 0]} />
            <Bar dataKey="high" name="High" fill="var(--lift-deadlift)" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
