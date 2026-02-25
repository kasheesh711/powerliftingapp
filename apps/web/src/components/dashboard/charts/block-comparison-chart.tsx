import type { TooltipProps } from 'recharts';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { BlockComparisonVM } from '../view-models';

import styles from './charts.module.css';

function ComparisonTooltip({ active, payload }: TooltipProps<number, string>): JSX.Element | null {
  if (!active || !payload?.length) {
    return null;
  }

  const datum = payload[0]?.payload as BlockComparisonVM | undefined;
  if (!datum) {
    return null;
  }

  return (
    <div className={styles.tooltipBox}>
      <div className={styles.tooltipLabel}>{datum.blockLabel}</div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipName}>Total</span>
        <span className={styles.tooltipValue}>{datum.totalDelta.toFixed(1)} kg</span>
      </div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipName}>Squat</span>
        <span className={styles.tooltipValue}>{datum.squatDelta.toFixed(1)} kg</span>
      </div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipName}>Bench</span>
        <span className={styles.tooltipValue}>{datum.benchDelta.toFixed(1)} kg</span>
      </div>
      <div className={styles.tooltipRow}>
        <span className={styles.tooltipName}>Deadlift</span>
        <span className={styles.tooltipValue}>{datum.deadliftDelta.toFixed(1)} kg</span>
      </div>
    </div>
  );
}

export function BlockComparisonChart({ comparisons }: { comparisons: BlockComparisonVM[] }): JSX.Element {
  if (!comparisons.length) {
    return <div className={styles.chartEmpty}>Block-over-block comparison is not available yet.</div>;
  }

  return (
    <section className={styles.chartPanel} data-testid="block-comparison-chart-panel">
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>Block-on-Block Progress</h3>
          <p className={styles.chartSubtitle}>Total endpoint delta by block with lift breakdown in tooltip.</p>
        </div>
      </div>

      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={276}>
          <BarChart data={comparisons} margin={{ top: 8, right: 18, left: 2, bottom: 8 }}>
            <CartesianGrid stroke="var(--border-default)" strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="blockLabel"
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
            <Tooltip content={<ComparisonTooltip />} />
            <Bar dataKey="totalDelta" radius={[8, 8, 0, 0]}>
              {comparisons.map((entry) => (
                <Cell
                  key={`${entry.blockName}-${entry.blockLabel}`}
                  fill={entry.totalDelta >= 0 ? 'var(--accent-primary)' : 'var(--danger)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
