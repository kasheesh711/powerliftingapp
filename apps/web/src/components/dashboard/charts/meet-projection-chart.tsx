import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';

import type { MeetProjectionVM } from '../view-models';

import styles from './charts.module.css';

interface ProjectionPoint {
  label: string;
  current: number;
  projected: number;
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
        <span className={styles.tooltipName}>Projected</span>
        <span className={styles.tooltipValue}>{point.projected.toFixed(1)} kg</span>
      </div>
    </div>
  );
}

export function MeetProjectionChart({ projection }: { projection: MeetProjectionVM }): JSX.Element {
  const data: ProjectionPoint[] = [
    {
      label: 'Squat',
      current: projection.current.squat,
      projected: projection.projected.squat
    },
    {
      label: 'Bench',
      current: projection.current.bench,
      projected: projection.projected.bench
    },
    {
      label: 'Deadlift',
      current: projection.current.deadlift,
      projected: projection.projected.deadlift
    },
    {
      label: 'Total',
      current: projection.current.total,
      projected: projection.projected.total
    }
  ];

  return (
    <section className={styles.chartPanel} data-testid="meet-projection-chart-panel">
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>Meet Projection Runway</h3>
          <p className={styles.chartSubtitle}>
            Current vs projected to {projection.meetDate} ({projection.weeksRemaining} weeks remaining).
          </p>
        </div>
      </div>

      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={276}>
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
            <Bar dataKey="current" name="Current" fill="var(--surface-3)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="projected" name="Projected" fill="var(--accent-primary)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
