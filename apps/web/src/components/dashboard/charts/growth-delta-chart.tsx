import type { Stats } from '@powerlifting/domain';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';

import { buildGrowthDeltaData, type GrowthDeltaDatum } from '../view-models';

import styles from './charts.module.css';

const growthColors: Record<GrowthDeltaDatum['id'], string> = {
  squat: 'var(--lift-squat)',
  bench: 'var(--lift-bench)',
  deadlift: 'var(--lift-deadlift)',
  total: 'var(--accent-primary)'
};

function GrowthTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) {
    return null;
  }

  const data = payload[0]?.payload as GrowthDeltaDatum | undefined;
  if (!data) {
    return null;
  }

  return (
    <div className={styles.tooltipBox}>
      <div className={styles.tooltipLabel}>{data.label}</div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipName}>Delta</span>
        <span className={styles.tooltipValue}>{data.delta.toFixed(1)} kg</span>
      </div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipName}>Delta %</span>
        <span className={styles.tooltipValue}>{data.deltaPct.toFixed(1)}%</span>
      </div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipName}>Baseline</span>
        <span className={styles.tooltipValue}>{data.baseline.toFixed(1)} kg</span>
      </div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipName}>Projected</span>
        <span className={styles.tooltipValue}>{data.projected.toFixed(1)} kg</span>
      </div>
    </div>
  );
}

export function GrowthDeltaChart({ growth }: { growth: Stats['growth'] | null | undefined }): JSX.Element {
  const data = useMemo(() => buildGrowthDeltaData(growth), [growth]);

  if (!data.length) {
    return <div className={styles.chartEmpty}>Growth metrics are unavailable for this block.</div>;
  }

  return (
    <section className={styles.chartPanel} data-testid="growth-chart-panel">
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>Projected Growth Delta</h3>
          <p className={styles.chartSubtitle}>Lift and total projection against baseline.</p>
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
            <ReferenceLine y={0} stroke="var(--border-strong)" />
            <Tooltip content={<GrowthTooltip />} />
            <Bar dataKey="delta" radius={[8, 8, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.id} fill={growthColors[entry.id]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
