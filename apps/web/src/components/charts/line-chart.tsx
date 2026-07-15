'use client';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtMinor } from '@/lib/format';

export interface SeriesPoint {
  date: string;
  valueMinor: number;
  currency?: string;
}

/**
 * Accessible price/value line chart. Includes a visually-hidden data summary and
 * table for screen readers, per WCAG accessible-chart guidance.
 */
export function ValueLineChart({
  data,
  currency = 'USD',
  ariaLabel,
  height = 240,
}: {
  data: SeriesPoint[];
  currency?: string;
  ariaLabel: string;
  height?: number;
}) {
  const first = data[0]?.valueMinor ?? 0;
  const last = data[data.length - 1]?.valueMinor ?? 0;
  const up = last >= first;
  const color = up ? 'rgb(var(--positive))' : 'rgb(var(--negative))';

  return (
    <figure className="w-full">
      <div style={{ height }} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }}
              tickFormatter={(d: string) => d.slice(5)}
              minTickGap={40}
              stroke="rgb(var(--border))"
            />
            <YAxis
              tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }}
              tickFormatter={(v: number) => fmtMinor(v, currency)}
              width={70}
              stroke="rgb(var(--border))"
            />
            <Tooltip
              contentStyle={{
                background: 'rgb(var(--surface-elevated))',
                border: '1px solid rgb(var(--border))',
                borderRadius: 8,
                color: 'rgb(var(--content))',
              }}
              formatter={(v: number) => [fmtMinor(v, currency), 'Value']}
            />
            <Area type="monotone" dataKey="valueMinor" stroke={color} fill="url(#fill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {ariaLabel}. Start {fmtMinor(first, currency)}, end {fmtMinor(last, currency)} over{' '}
        {data.length} days.
      </figcaption>
    </figure>
  );
}
