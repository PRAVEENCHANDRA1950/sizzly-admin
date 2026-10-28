import {
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ItemStatus, Order, OrderItem } from '../types';
import { asAddons, asBool, asDate, asNumber, asString } from './parse';

const ordersCol = collection(db, 'orders');

const ITEM_STATUSES: ItemStatus[] = ['fired', 'cooked', 'served'];

function itemFromRaw(raw: DocumentData): OrderItem {
  const status = asString(raw.status).toLowerCase() as ItemStatus;
  // The customer app's "Served" tab reads `is_served`; treat either flag as served.
  const served = asBool(raw.is_served) || status === 'served';
  return {
    id: asString(raw.id),
    name: asString(raw.name, 'Item'),
    price: asNumber(raw.price),
    category: asString(raw.category) || null,
    quantity: asNumber(raw.quantity, 1),
    is_served: served,
    status: served ? 'served' : ITEM_STATUSES.includes(status) ? status : 'fired',
    image: asString(raw.image) || null,
    addons: asAddons(raw.addons),
  };
}

function fromDoc(id: string, data: DocumentData): Order {
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    id,
    table_id: asString(data.table_id),
    status: asString(data.status, 'active'),
    is_active: asBool(data.is_active),
    created_at: asDate(data.created_at),
    expires_at: asDate(data.expires_at),
    closed_at: asDate(data.closed_at),
    items: items
      .filter((i: unknown): i is DocumentData => !!i && typeof i === 'object')
      .map(itemFromRaw),
  };
}

// Range + orderBy on the same single field needs no composite index.
const createdBetween = (start: Date, end?: Date) =>
  query(
    ordersCol,
    where('created_at', '>=', Timestamp.fromDate(start)),
    ...(end ? [where('created_at', '<', Timestamp.fromDate(end))] : []),
    orderBy('created_at', 'desc'),
  );

export function subscribeOrdersSince(
  since: Date,
  onData: (orders: Order[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    createdBetween(since),
    (snap) => onData(snap.docs.map((d) => fromDoc(d.id, d.data()))),
    onError,
  );
}

export async function fetchOrdersBetween(start: Date, end: Date): Promise<Order[]> {
  const snap = await getDocs(createdBetween(start, end));
  return snap.docs.map((d) => fromDoc(d.id, d.data()));
}

/**
 * Updates kitchen status of items inside `orders/{id}.items`. Items are addressed by index
 * (customers only ever append), and verified by id+name so a concurrent change can't make us
 * update the wrong line. Unknown fields on each item are preserved.
 */
export async function setItemsStatus(
  orderId: string,
  targets: { index: number; id: string; name: string }[],
  status: ItemStatus,
): Promise<void> {
  const ref = doc(ordersCol, orderId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Order not found.');
    const items: DocumentData[] = Array.isArray(snap.data().items) ? [...snap.data().items] : [];

    for (const target of targets) {
      const raw = items[target.index];
      if (!raw || asString(raw.id) !== target.id || asString(raw.name, 'Item') !== target.name) {
        throw new Error('The order changed while updating. Please try again.');
      }
      items[target.index] = { ...raw, status, is_served: status === 'served' };
    }
    tx.update(ref, { items });
  });
}

/**
 * Closes a dine-in session: marks the order completed, frees the table (only if this order
 * is still its active order, or when force-freeing a table without an order) and deletes the
 * leftover shared cart. Mirrors completeOrderTransaction in the Flutter app, and additionally
 * sets `is_active: false` so the order's join link stops working.
 */
export async function closeSession(params: {
  orderId: string | null;
  tableId: string | null;
}): Promise<void> {
  const { orderId, tableId } = params;
  const orderRef = orderId ? doc(ordersCol, orderId) : null;
  const tableRef = tableId ? doc(db, 'tables', tableId) : null;
  const cartRef = orderId ? doc(db, 'carts', orderId) : null;

  await runTransaction(db, async (tx) => {
    const orderSnap = orderRef ? await tx.get(orderRef) : null;
    const tableSnap = tableRef ? await tx.get(tableRef) : null;

    if (orderRef && orderSnap?.exists()) {
      tx.update(orderRef, {
        status: 'completed',
        is_active: false,
        closed_at: serverTimestamp(),
      });
    }

    if (tableRef && tableSnap?.exists()) {
      const activeOrderId = asString(tableSnap.data().active_order_id) || null;
      if (!orderId || !activeOrderId || activeOrderId === orderId) {
        tx.update(tableRef, {
          status: 'available',
          active_order_id: deleteField(),
          last_updated: serverTimestamp(),
        });
      }
    }

    if (cartRef) tx.delete(cartRef);
  });
}
