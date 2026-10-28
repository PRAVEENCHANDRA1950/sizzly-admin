import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Armchair, ArrowRight, ChefHat, IndianRupee, Package, Receipt, ShoppingBag } from 'lucide-react';
import { useMenus, useOrdersSince, useTables } from '../hooks/useLiveData';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Spinner,
  StatCard,
} from '../components/ui';
import { ColumnChart } from '../components/charts';
import {
  addDays,
  dateKey,
  dayLabel,
  formatCurrency,
  formatCurrencyWhole,
  formatNumber,
  shortId,
  startOfDay,
  timeAgo,
} from '../lib/format';
import { isBillable, isOpen, orderItemCount, orderTotal, pendingItems, itemTotal } from '../lib/orderMath';

export function DashboardPage() {
  const since = useMemo(() => startOfDay(addDays(new Date(), -6)), []);
  const orders = useOrdersSince(since);
  const tables = useTables();
  const menus = useMenus();

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const billable = orders.data.filter(isBillable);
    const todays = billable.filter((o) => o.created_at && o.created_at >= today);
    const revenueToday = todays.reduce((s, o) => s + orderTotal(o), 0);

    // Revenue per day for the last 7 days, oldest first, zero-filled.
    const byDay = new Map<string, { revenue: number; orders: number }>();
    for (let i = 0; i < 7; i++) byDay.set(dateKey(addDays(since, i)), { revenue: 0, orders: 0 });
    for (const o of billable) {
      if (!o.created_at) continue;
      const bucket = byDay.get(dateKey(o.created_at));
      if (bucket) {
        bucket.revenue += orderTotal(o);
        bucket.orders += 1;
      }
    }
    const daily = [...byDay.entries()].map(([key, v], i) => ({
      label: dayLabel(addDays(since, i)),
      value: v.revenue,
      detail: `${v.orders} order${v.orders === 1 ? '' : 's'}` + (key === dateKey(today) ? ' · today' : ''),
    }));

    // Top items over 7 days by quantity.
    const items = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of billable) {
      for (const it of o.items) {
        const key = it.id || it.name;
        const row = items.get(key) ?? { name: it.name, qty: 0, revenue: 0 };
        row.qty += it.quantity;
        row.revenue += itemTotal(it);
        items.set(key, row);
      }
    }
    const topItems = [...items.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    const open = orders.data.filter(isOpen);
    const kitchenQueue = open.reduce((s, o) => s + pendingItems(o).reduce((q, i) => q + i.quantity, 0), 0);

    return {
      revenueToday,
      ordersToday: todays.length,
      avgToday: todays.length ? revenueToday / todays.length : 0,
      revenueWeek: billable.reduce((s, o) => s + orderTotal(o), 0),
      daily,
      topItems,
      open: open.slice(0, 6),
      kitchenQueue,
    };
  }, [orders.data, since]);

  const occupied = tables.data.filter((t) => t.status === 'occupied').length;
  const outOfStock = menus.data.filter((m) => !m.is_stock).length;
  const error = orders.error || tables.error || menus.error;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={new Date().toLocaleDateString('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      />
      {error && <ErrorBanner message={`Could not load data: ${error}`} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's sales"
          value={formatCurrencyWhole(stats.revenueToday)}
          hint={`Avg order ${formatCurrencyWhole(stats.avgToday)}`}
          icon={<IndianRupee className="h-5 w-5" />}
        />
        <StatCard
          label="Orders today"
          value={formatNumber(stats.ordersToday)}
          hint={`${stats.kitchenQueue} item${stats.kitchenQueue === 1 ? '' : 's'} waiting in kitchen`}
          icon={<ShoppingBag className="h-5 w-5" />}
        />
        <StatCard
          label="Tables occupied"
          value={tables.loading ? '—' : `${occupied} / ${tables.data.length}`}
          hint={`${tables.data.length - occupied} available`}
          icon={<Armchair className="h-5 w-5" />}
        />
        <StatCard
          label="Menu items"
          value={menus.loading ? '—' : formatNumber(menus.data.length)}
          hint={outOfStock ? `${outOfStock} out of stock` : 'All in stock'}
          icon={<Package className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Sales, last 7 days"
            subtitle={`${formatCurrency(stats.revenueWeek)} in total`}
            action={
              <Link to="/reports" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Reports
              </Link>
            }
          />
          <div className="px-3 pb-4 pt-2">
            {orders.loading ? <Spinner /> : <ColumnChart data={stats.daily} format={formatCurrency} />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Top items" subtitle="By quantity, last 7 days" />
          <div className="p-5 pt-3">
            {orders.loading ? (
              <Spinner />
            ) : stats.topItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">No sales yet this week.</p>
            ) : (
              <ol className="space-y-3">
                {stats.topItems.map((item, i) => (
                  <li key={item.name} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(item.revenue)}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-ink">×{item.qty}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Open tables"
          subtitle="Active dine-in sessions"
          action={
            <Link
              to="/orders"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Live orders <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        {orders.loading ? (
          <Spinner />
        ) : stats.open.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="No open tables"
            description="New sessions appear here as soon as guests scan a table QR code."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {stats.open.map((o) => {
              const pending = pendingItems(o).length;
              return (
                <Link
                  key={o.id}
                  to="/orders"
                  className="rounded-xl border border-gray-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-display font-semibold text-ink">Table {o.table_id}</p>
                    {pending > 0 ? (
                      <Badge tone="orange">
                        <ChefHat className="h-3 w-3" /> {pending} cooking
                      </Badge>
                    ) : o.items.length > 0 ? (
                      <Badge tone="green">All served</Badge>
                    ) : (
                      <Badge>No items yet</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    #{shortId(o.id)} · {timeAgo(o.created_at)}
                  </p>
                  <p className="mt-3 text-sm text-gray-600">
                    {orderItemCount(o)} items ·{' '}
                    <span className="font-semibold text-ink">{formatCurrency(orderTotal(o))}</span>
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
