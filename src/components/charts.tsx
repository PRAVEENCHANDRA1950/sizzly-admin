import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';

// Single-series bars only: one hue, so no legend — the card title names the measure.
// #E05E00 (brand-600) clears 3:1 against the white card; #FF6B00 does not.
const BAR_COLOR = '#E05E00';
const GRID_COLOR = '#EDEDEB';
const TICK = { fill: '#6B6B66', fontSize: 12 };

export interface BarDatum {
  label: string;
  value: number;
  /** Optional secondary line in the tooltip, e.g. "12 orders". */
  detail?: string;
}

export function compactInr(value: number): string {
  if (value >= 100000) return `₹${+(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${+(value / 1000).toFixed(1)}K`;
  return `₹${Math.round(value)}`;
}

function ChartTooltip({
  active,
  payload,
  format,
}: TooltipProps<number, string> & { format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload as BarDatum;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-gray-500">{datum.label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <span className="h-2 w-2 rounded-sm" style={{ background: BAR_COLOR }} />
        {format(datum.value)}
      </p>
      {datum.detail && <p className="mt-0.5 text-gray-500">{datum.detail}</p>}
    </div>
  );
}

export function ColumnChart({
  data,
  format,
  height = 260,
}: {
  data: BarDatum[];
  format: (v: number) => string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_COLOR} />
        <XAxis
          dataKey="label"
          tick={TICK}
          tickLine={false}
          axisLine={{ stroke: GRID_COLOR }}
          interval="preserveStartEnd"
          minTickGap={8}
        />
        <YAxis
          tick={TICK}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={compactInr}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(224, 94, 0, 0.06)' }}
          content={<ChartTooltip format={format} />}
        />
        <Bar
          dataKey="value"
          fill={BAR_COLOR}
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          // Data updates live; re-animating on every snapshot is distracting.
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars for ranked categories (long labels read better on the y-axis). */
export function RankedBarChart({
  data,
  format,
}: {
  data: BarDatum[];
  format: (v: number) => string;
}) {
  const height = Math.max(120, data.length * 36 + 24);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
        <XAxis
          type="number"
          tick={TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={compactInr}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={TICK}
          tickLine={false}
          axisLine={{ stroke: GRID_COLOR }}
          width={120}
        />
        <Tooltip
          cursor={{ fill: 'rgba(224, 94, 0, 0.06)' }}
          content={<ChartTooltip format={format} />}
        />
        <Bar
          dataKey="value"
          fill={BAR_COLOR}
          radius={[0, 4, 4, 0]}
          maxBarSize={24}
          // Data updates live; re-animating on every snapshot is distracting.
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
