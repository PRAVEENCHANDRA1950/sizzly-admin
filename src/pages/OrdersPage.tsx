import { useMemo, useState } from 'react';
import { Check, ChefHat, CircleCheck, ClipboardList, DoorOpen, Flame } from 'lucide-react';
import { useOrdersSince } from '../hooks/useLiveData';
import { closeSession, setItemsStatus } from '../services/orders';
import { useToast } from '../context/ToastContext';
import { Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, Spinner } from '../components/ui';
import { addDays, formatCurrency, formatTime, shortId, startOfDay, timeAgo } from '../lib/format';
import { isOpen, itemTotal, orderTotal } from '../lib/orderMath';
import type { ItemStatus, Order, OrderItem } from '../types';

type Tab = 'open' | 'completed' | 'all';

const WINDOWS = [
  { days: 0, label: 'Today' },
  { days: 2, label: 'Last 3 days' },
  { days: 6, label: 'Last 7 days' },
];

const STATUS_BADGE: Record<ItemStatus, { tone: 'red' | 'orange' | 'green'; label: string }> = {
  fired: { tone: 'red', label: 'New' },
  cooked: { tone: 'orange', label: 'Ready' },
  served: { tone: 'green', label: 'Served' },
};

const NEXT_STATUS: Partial<Record<ItemStatus, { status: ItemStatus; label: string }>> = {
  fired: { status: 'cooked', label: 'Ready' },
  cooked: { status: 'served', label: 'Serve' },
};

export function OrdersPage() {
  const [windowDays, setWindowDays] = useState(0);
  const [tab, setTab] = useState<Tab>('open');
  const since = useMemo(() => startOfDay(addDays(new Date(), -windowDays)), [windowDays]);
  const orders = useOrdersSince(since);

  const counts = useMemo(
    () => ({
      open: orders.data.filter(isOpen).length,
      completed: orders.data.filter((o) => !isOpen(o)).length,
      all: orders.data.length,
    }),
    [orders.data],
  );

  const visible = orders.data.filter((o) =>
    tab === 'open' ? isOpen(o) : tab === 'completed' ? !isOpen(o) : true,
  );

  return (
    <>
      <PageHeader
        title="Live orders"
        subtitle="Updates in real time as guests order. Move items from New → Ready → Served."
        actions={
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"
            aria-label="Time window"
          >
            {WINDOWS.map((w) => (
              <option key={w.days} value={w.days}>
                {w.label}
              </option>
            ))}
          </select>
        }
      />

      <div className="mb-5 inline-flex rounded-xl border border-gray-200 bg-white p-1">
        {(
          [
            ['open', 'Open'],
            ['completed', 'Closed'],
            ['all', 'All'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {label} <span className="ml-1 opacity-75">{counts[key]}</span>
          </button>
        ))}
      </div>

      {orders.error && <ErrorBanner message={`Could not load orders: ${orders.error}`} />}

      {orders.loading ? (
        <Spinner label="Loading orders…" />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title={tab === 'open' ? 'No open orders' : 'No orders in this period'}
            description="Orders placed from the customer app show up here instantly."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </>
  );
}

function OrderCard({ order }: { order: Order }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const open = isOpen(order);
  const expired = open && !!order.expires_at && order.expires_at < new Date();
  const pending = order.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.status !== 'served');

  async function updateItems(targets: { item: OrderItem; index: number }[], status: ItemStatus, key: string) {
    setBusy(key);
    try {
      await setItemsStatus(
        order.id,
        targets.map(({ item, index }) => ({ index, id: item.id, name: item.name })),
        status,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function closeOrder() {
    const unserved = pending.length;
    const message =
      `Close table ${order.table_id} and mark this order completed?` +
      (unserved ? `\n\n${unserved} item(s) are not served yet.` : '') +
      '\n\nThe table becomes available for new guests.';
    if (!window.confirm(message)) return;
    setBusy('close');
    try {
      await closeSession({ orderId: order.id, tableId: order.table_id || null });
      toast.success(`Table ${order.table_id} closed.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className={`flex flex-col ${open ? '' : 'opacity-80'}`}>
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Table {order.table_id || '—'}</p>
          <p className="text-xs text-gray-500">
            #{shortId(order.id)} · opened {formatTime(order.created_at)} ({timeAgo(order.created_at)})
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {open ? <Badge tone="orange">Open</Badge> : <Badge tone="gray">{order.status}</Badge>}
          {expired && <Badge tone="red">Session expired</Badge>}
        </div>
      </div>

      <div className="flex-1 px-5 py-3">
        {order.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">No items ordered yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {order.items.map((item, index) => {
              const badge = STATUS_BADGE[item.status];
              const next = open ? NEXT_STATUS[item.status] : undefined;
              const key = `item-${index}`;
              return (
                <li key={key} className="flex items-center gap-3 py-2.5">
                  <span className="w-8 shrink-0 text-sm font-semibold tabular-nums text-ink">
                    {item.quantity}×
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                    {item.addons.length > 0 && (
                      <p className="truncate text-xs text-gray-500">
                        + {item.addons.map((a) => a.name).join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="hidden text-sm tabular-nums text-gray-600 sm:inline">
                    {formatCurrency(itemTotal(item))}
                  </span>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                  {next && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busy === key}
                      disabled={!!busy}
                      onClick={() => updateItems([{ item, index }], next.status, key)}
                      icon={next.status === 'cooked' ? <Flame className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    >
                      {next.label}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3">
        <p className="text-sm text-gray-600">
          Total <span className="font-display text-base font-bold text-ink">{formatCurrency(orderTotal(order))}</span>
        </p>
        {open && (
          <div className="flex flex-wrap gap-2">
            {pending.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                loading={busy === 'serve-all'}
                disabled={!!busy}
                onClick={() => updateItems(pending, 'served', 'serve-all')}
                icon={<CircleCheck className="h-3.5 w-3.5" />}
              >
                Serve all
              </Button>
            )}
            <Button
              size="sm"
              loading={busy === 'close'}
              disabled={!!busy}
              onClick={closeOrder}
              icon={<DoorOpen className="h-3.5 w-3.5" />}
            >
              Close table
            </Button>
          </div>
        )}
        {!open && order.items.some((i) => !i.is_served) && (
          <Badge tone="red">
            <ChefHat className="h-3 w-3" /> Unserved items
          </Badge>
        )}
      </div>
    </Card>
  );
}
