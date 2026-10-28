import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Armchair, DoorOpen, Pencil, Plus, QrCode, Trash2, Users } from 'lucide-react';
import { useOrdersSince, useTables } from '../hooks/useLiveData';
import { createTable, deleteTable, TABLE_ID_PATTERN, updateTable } from '../services/tables';
import { closeSession } from '../services/orders';
import { useToast } from '../context/ToastContext';
import { TableQrModal } from '../components/TableQrModal';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Modal,
  PageHeader,
  Spinner,
  inputClass,
} from '../components/ui';
import { addDays, formatCurrency, shortId, startOfDay, timeAgo } from '../lib/format';
import { orderItemCount, orderTotal } from '../lib/orderMath';
import type { RestaurantTable } from '../types';

export function TablesPage() {
  const tables = useTables();
  // Sessions expire after 3 hours, so two days comfortably covers every active order.
  const since = useMemo(() => startOfDay(addDays(new Date(), -1)), []);
  const orders = useOrdersSince(since);
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const ordersById = useMemo(() => new Map(orders.data.map((o) => [o.id, o])), [orders.data]);
  const occupied = tables.data.filter((t) => t.status === 'occupied').length;

  async function freeTable(table: RestaurantTable) {
    const order = table.active_order_id ? ordersById.get(table.active_order_id) : undefined;
    const message = order
      ? `Close the session on ${label(table)} (${formatCurrency(orderTotal(order))}) and free the table?`
      : `Mark ${label(table)} as available?`;
    if (!window.confirm(message)) return;
    setBusy(table.id);
    try {
      await closeSession({ orderId: table.active_order_id, tableId: table.id });
      toast.success(`${label(table)} is now available.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(table: RestaurantTable) {
    if (!window.confirm(`Delete ${label(table)}? Its QR code will stop working.`)) return;
    setBusy(table.id);
    try {
      await deleteTable(table);
      toast.success(`${label(table)} deleted.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Tables"
        subtitle={`${tables.data.length} tables · ${occupied} occupied · ${tables.data.length - occupied} available`}
        actions={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add table
          </Button>
        }
      />

      {tables.error && <ErrorBanner message={`Could not load tables: ${tables.error}`} />}

      {tables.loading ? (
        <Spinner label="Loading tables…" />
      ) : tables.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Armchair className="h-6 w-6" />}
            title="No tables yet"
            description="Add a table to generate its QR code. Guests scan it to order from that table."
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
                Add table
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.data.map((table) => {
            const isOccupied = table.status === 'occupied';
            const order = table.active_order_id ? ordersById.get(table.active_order_id) : undefined;
            return (
              <Card
                key={table.id}
                className={`flex flex-col p-4 ${isOccupied ? 'border-brand-200 bg-brand-50/30' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-semibold text-ink">{label(table)}</p>
                    <p className="truncate text-xs text-gray-500">
                      ID: {table.id}
                      {table.seats ? (
                        <>
                          {' · '}
                          <Users className="inline h-3 w-3" /> {table.seats}
                        </>
                      ) : null}
                    </p>
                  </div>
                  {isOccupied ? <Badge tone="orange">Occupied</Badge> : <Badge tone="green">Available</Badge>}
                </div>

                <div className="mt-3 min-h-[44px] flex-1 text-sm">
                  {isOccupied ? (
                    order ? (
                      <p className="text-gray-600">
                        #{shortId(order.id)} · {timeAgo(order.created_at)}
                        <br />
                        {orderItemCount(order)} items ·{' '}
                        <span className="font-semibold text-ink">{formatCurrency(orderTotal(order))}</span>
                      </p>
                    ) : (
                      <p className="text-gray-500">
                        {table.active_order_id ? `Order #${shortId(table.active_order_id)}` : 'No linked order'}
                      </p>
                    )
                  ) : (
                    <p className="text-gray-400">Ready for guests</p>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-1 border-t border-gray-100 pt-3">
                  <Button size="sm" variant="secondary" icon={<QrCode className="h-3.5 w-3.5" />} onClick={() => setQrTable(table)}>
                    QR
                  </Button>
                  {isOccupied && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busy === table.id}
                      icon={<DoorOpen className="h-3.5 w-3.5" />}
                      onClick={() => freeTable(table)}
                    >
                      Free
                    </Button>
                  )}
                  <div className="ml-auto flex">
                    <button
                      onClick={() => {
                        setEditing(table);
                        setFormOpen(true);
                      }}
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-ink"
                      aria-label={`Edit ${label(table)}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(table)}
                      disabled={isOccupied || busy === table.id}
                      title={isOccupied ? 'Free the table before deleting it' : undefined}
                      className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Delete ${label(table)}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <TableForm open={formOpen} table={editing} onClose={() => setFormOpen(false)} />
      <TableQrModal table={qrTable} onClose={() => setQrTable(null)} />
    </>
  );
}

const label = (t: RestaurantTable) => t.name || `Table ${t.id}`;

function TableForm({
  open,
  table,
  onClose,
}: {
  open: boolean;
  table: RestaurantTable | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setId(table?.id ?? '');
    setName(table?.name ?? '');
    setSeats(table?.seats ? String(table.seats) : '');
    setError(null);
  }, [open, table]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const tableId = id.trim();
    if (!table && !TABLE_ID_PATTERN.test(tableId)) {
      setError('Table ID can use letters, numbers, "-" and "_" only (max 40).');
      return;
    }
    const seatCount = seats.trim() === '' ? null : Number(seats);
    if (seatCount != null && (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 50)) {
      setError('Seats must be a whole number between 1 and 50.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (table) {
        await updateTable(table.id, { name, seats: seatCount });
        toast.success('Table updated.');
      } else {
        await createTable({ id: tableId, name, seats: seatCount });
        toast.success(`Table ${tableId} added.`);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={table ? `Edit ${label(table)}` : 'Add table'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="table-form" loading={saving}>
            {table ? 'Save' : 'Add table'}
          </Button>
        </>
      }
    >
      <form id="table-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="Table ID"
          required={!table}
          hint={table ? 'The ID is part of the printed QR code and cannot change.' : 'Used in the QR link, e.g. table_1 or T5.'}
        >
          <input
            className={inputClass}
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={!!table}
            placeholder="table_1"
            autoFocus={!table}
          />
        </Field>
        <Field label="Display name" hint="Optional, e.g. “Window 2” or “Rooftop 1”.">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Table 1" />
        </Field>
        <Field label="Seats">
          <input className={inputClass} inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="4" />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}
