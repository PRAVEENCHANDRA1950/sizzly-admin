import { useEffect, useMemo, useState } from 'react';
import {
  ChartColumn,
  FileDown,
  IndianRupee,
  Package,
  Receipt,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { fetchOrdersBetween } from '../services/orders';
import { useMenus } from '../hooks/useLiveData';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Spinner,
  StatCard,
  inputClass,
} from '../components/ui';
import { ColumnChart, RankedBarChart, type BarDatum } from '../components/charts';
import { downloadCsv } from '../lib/csv';
import {
  addDays,
  dateKey,
  formatCurrency,
  formatCurrencyWhole,
  formatDateTime,
  formatNumber,
  parseDateKey,
  shortId,
  startOfDay,
} from '../lib/format';
import { addonsTotal, isBillable, itemTotal, orderItemCount, orderTotal } from '../lib/orderMath';
import type { Order } from '../types';

type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Custom' },
];

function presetRange(preset: Exclude<Preset, 'custom'>): [string, string] {
  const today = startOfDay(new Date());
  switch (preset) {
    case 'today':
      return [dateKey(today), dateKey(today)];
    case 'yesterday':
      return [dateKey(addDays(today, -1)), dateKey(addDays(today, -1))];
    case '7d':
      return [dateKey(addDays(today, -6)), dateKey(today)];
    case '30d':
      return [dateKey(addDays(today, -29)), dateKey(today)];
    case 'month':
      return [dateKey(new Date(today.getFullYear(), today.getMonth(), 1)), dateKey(today)];
  }
}

const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

export function ReportsPage() {
  const menus = useMenus();
  const [preset, setPreset] = useState<Preset>('7d');
  const [[from, to], setRange] = useState<[string, string]>(() => presetRange('7d'));
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [itemSort, setItemSort] = useState<'revenue' | 'qty'>('revenue');
  const [showAllOrders, setShowAllOrders] = useState(false);

  const rangeError = from && to && from > to ? 'Start date must be on or before the end date.' : null;

  useEffect(() => {
    if (!from || !to || rangeError) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOrdersBetween(parseDateKey(from), addDays(parseDateKey(to), 1))
      .then((data) => !cancelled && setOrders(data))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [from, to, rangeError, reloadKey]);

  function choosePreset(key: Preset) {
    setPreset(key);
    if (key !== 'custom') setRange(presetRange(key));
  }

  const report = useMemo(() => {
    const billable = orders.filter(isBillable);
    const categoryById = new Map(menus.data.map((m) => [m.id, m.category]));

    let revenue = 0;
    let itemsSold = 0;
    let addonRevenue = 0;
    const byDay = new Map<string, { revenue: number; orders: number }>();
    const byHour = new Map<number, { revenue: number; orders: number }>();
    const byCategory = new Map<string, { revenue: number; qty: number }>();
    const byItem = new Map<string, { name: string; category: string; qty: number; revenue: number }>();

    // Zero-fill every day in range so gaps show as empty days.
    for (let d = parseDateKey(from); dateKey(d) <= to; d = addDays(d, 1)) {
      byDay.set(dateKey(d), { revenue: 0, orders: 0 });
    }

    for (const order of billable) {
      const total = orderTotal(order);
      revenue += total;
      itemsSold += orderItemCount(order);
      if (order.created_at) {
        const day = byDay.get(dateKey(order.created_at));
        if (day) {
          day.revenue += total;
          day.orders += 1;
        }
        const hour = order.created_at.getHours();
        const h = byHour.get(hour) ?? { revenue: 0, orders: 0 };
        h.revenue += total;
        h.orders += 1;
        byHour.set(hour, h);
      }
      for (const item of order.items) {
        const lineTotal = itemTotal(item);
        addonRevenue += addonsTotal(item.addons) * item.quantity;
        // Order items don't store a category; look it up from the current menu.
        const category = categoryById.get(item.id) || item.category || 'Uncategorized';
        const c = byCategory.get(category) ?? { revenue: 0, qty: 0 };
        c.revenue += lineTotal;
        c.qty += item.quantity;
        byCategory.set(category, c);

        const key = item.id || item.name;
        const row = byItem.get(key) ?? { name: item.name, category, qty: 0, revenue: 0 };
        row.qty += item.quantity;
        row.revenue += lineTotal;
        byItem.set(key, row);
      }
    }

    const daily: BarDatum[] = [...byDay.entries()].map(([key, v]) => ({
      label: parseDateKey(key).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      value: v.revenue,
      detail: `${v.orders} order${v.orders === 1 ? '' : 's'}`,
    }));

    const hours = [...byHour.keys()];
    const hourly: BarDatum[] = [];
    if (hours.length) {
      for (let h = Math.min(...hours); h <= Math.max(...hours); h++) {
        const v = byHour.get(h) ?? { revenue: 0, orders: 0 };
        hourly.push({ label: hourLabel(h), value: v.revenue, detail: `${v.orders} order${v.orders === 1 ? '' : 's'}` });
      }
    }

    const categories: BarDatum[] = [...byCategory.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([label, v]) => ({ label, value: v.revenue, detail: `${v.qty} sold` }));

    return {
      billable,
      revenue,
      itemsSold,
      addonRevenue,
      avg: billable.length ? revenue / billable.length : 0,
      daily,
      hourly,
      categories,
      items: [...byItem.values()],
    };
  }, [orders, menus.data, from, to]);

  const items = useMemo(
    () => [...report.items].sort((a, b) => (itemSort === 'qty' ? b.qty - a.qty : b.revenue - a.revenue)),
    [report.items, itemSort],
  );

  const rangeLabel = from === to ? from : `${from}_to_${to}`;

  function exportItems() {
    downloadCsv(
      `sizzly-item-sales_${rangeLabel}.csv`,
      ['Item', 'Category', 'Quantity', 'Revenue (INR)', 'Share %'],
      items.map((i) => [
        i.name,
        i.category,
        i.qty,
        i.revenue.toFixed(2),
        report.revenue ? ((i.revenue / report.revenue) * 100).toFixed(1) : '0',
      ]),
    );
  }

  function exportOrders() {
    downloadCsv(
      `sizzly-orders_${rangeLabel}.csv`,
      ['Date', 'Order ID', 'Table', 'Items', 'Status', 'Total (INR)', 'Item details'],
      report.billable.map((o) => [
        o.created_at ? o.created_at.toLocaleString('en-IN') : '',
        o.id,
        o.table_id,
        orderItemCount(o),
        o.status,
        orderTotal(o).toFixed(2),
        o.items
          .map((i) => `${i.quantity}x ${i.name}${i.addons.length ? ` (+${i.addons.map((a) => a.name).join(', ')})` : ''}`)
          .join('; '),
      ]),
    );
  }

  const visibleOrders = showAllOrders ? report.billable : report.billable.slice(0, 15);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Sales from orders placed by guests. Cancelled orders and sessions with no items are excluded."
        actions={
          <Button
            variant="secondary"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => choosePreset(p.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  preset === p.key ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              max={dateKey(new Date())}
              onChange={(e) => {
                setPreset('custom');
                setRange([e.target.value, to]);
              }}
              className={`${inputClass} w-auto`}
              aria-label="From date"
            />
            <span className="text-sm text-gray-400">to</span>
            <input
              type="date"
              value={to}
              max={dateKey(new Date())}
              onChange={(e) => {
                setPreset('custom');
                setRange([from, e.target.value]);
              }}
              className={`${inputClass} w-auto`}
              aria-label="To date"
            />
          </div>
        </div>
        {rangeError && <p className="mt-2 text-sm text-red-600">{rangeError}</p>}
      </Card>

      {error && <ErrorBanner message={`Could not load orders: ${error}`} />}

      {loading ? (
        <Spinner label="Building report…" />
      ) : report.billable.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ChartColumn className="h-6 w-6" />}
            title="No sales in this period"
            description="Pick a different date range to see sales."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Revenue"
              value={formatCurrencyWhole(report.revenue)}
              hint={`incl. ${formatCurrencyWhole(report.addonRevenue)} from add-ons`}
              icon={<IndianRupee className="h-5 w-5" />}
            />
            <StatCard label="Orders" value={formatNumber(report.billable.length)} icon={<ShoppingBag className="h-5 w-5" />} />
            <StatCard label="Avg order value" value={formatCurrencyWhole(report.avg)} icon={<Receipt className="h-5 w-5" />} />
            <StatCard label="Items sold" value={formatNumber(report.itemsSold)} icon={<Package className="h-5 w-5" />} />
          </div>

          <Card className="mt-6">
            <CardHeader title="Revenue by day" subtitle={`${from} → ${to}`} />
            <div className="px-3 pb-4 pt-2">
              <ColumnChart data={report.daily} format={formatCurrency} />
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Revenue by category" />
              <div className="px-3 pb-4 pt-3">
                <RankedBarChart data={report.categories} format={formatCurrency} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Peak hours" subtitle="Revenue by hour the order was opened" />
              <div className="px-3 pb-4 pt-2">
                <ColumnChart data={report.hourly} format={formatCurrency} height={240} />
              </div>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader
              title="Item-wise sales"
              subtitle={`${items.length} items sold`}
              action={
                <div className="flex gap-2">
                  <select
                    value={itemSort}
                    onChange={(e) => setItemSort(e.target.value as 'revenue' | 'qty')}
                    className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs"
                    aria-label="Sort items"
                  >
                    <option value="revenue">By revenue</option>
                    <option value="qty">By quantity</option>
                  </select>
                  <Button size="sm" variant="secondary" icon={<FileDown className="h-3.5 w-3.5" />} onClick={exportItems}>
                    CSV
                  </Button>
                </div>
              }
            />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-y border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-2.5">Item</th>
                    <th className="px-5 py-2.5">Category</th>
                    <th className="px-5 py-2.5 text-right">Qty</th>
                    <th className="px-5 py-2.5 text-right">Revenue</th>
                    <th className="px-5 py-2.5 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 tabular-nums">
                  {items.map((i) => (
                    <tr key={i.name + i.category}>
                      <td className="px-5 py-2.5 font-medium text-ink">{i.name}</td>
                      <td className="px-5 py-2.5 text-gray-600">{i.category}</td>
                      <td className="px-5 py-2.5 text-right">{formatNumber(i.qty)}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-ink">{formatCurrency(i.revenue)}</td>
                      <td className="px-5 py-2.5 text-right text-gray-500">
                        {report.revenue ? ((i.revenue / report.revenue) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="mt-6">
            <CardHeader
              title="Orders"
              subtitle={`${report.billable.length} orders`}
              action={
                <Button size="sm" variant="secondary" icon={<FileDown className="h-3.5 w-3.5" />} onClick={exportOrders}>
                  CSV
                </Button>
              }
            />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-y border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-5 py-2.5">Order</th>
                    <th className="px-5 py-2.5">Table</th>
                    <th className="px-5 py-2.5 text-right">Items</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 tabular-nums">
                  {visibleOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-5 py-2.5 text-gray-600">{formatDateTime(o.created_at)}</td>
                      <td className="px-5 py-2.5 font-mono text-xs text-gray-600">#{shortId(o.id)}</td>
                      <td className="px-5 py-2.5 text-ink">{o.table_id || '—'}</td>
                      <td className="px-5 py-2.5 text-right">{orderItemCount(o)}</td>
                      <td className="px-5 py-2.5">
                        <Badge tone={o.status === 'completed' ? 'green' : 'orange'}>{o.status}</Badge>
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold text-ink">{formatCurrency(orderTotal(o))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.billable.length > 15 && (
              <div className="border-t border-gray-100 px-5 py-3 text-center">
                <button
                  onClick={() => setShowAllOrders((v) => !v)}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {showAllOrders ? 'Show fewer' : `Show all ${report.billable.length} orders`}
                </button>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
