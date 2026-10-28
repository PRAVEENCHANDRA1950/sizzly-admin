import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { RestaurantTable } from '../types';
import { asDate, asNullableNumber, asString } from './parse';

const tablesCol = collection(db, 'tables');

function fromDoc(id: string, data: DocumentData): RestaurantTable {
  return {
    id,
    name: asString(data.name),
    seats: asNullableNumber(data.seats),
    status: data.status === 'occupied' ? 'occupied' : 'available',
    active_order_id: asString(data.active_order_id) || null,
    last_updated: asDate(data.last_updated),
  };
}

/** Natural sort so table_2 comes before table_10. */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function subscribeTables(
  onData: (tables: RestaurantTable[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    tablesCol,
    (snap) => {
      const tables = snap.docs.map((d) => fromDoc(d.id, d.data()));
      tables.sort((a, b) => collator.compare(a.id, b.id));
      onData(tables);
    },
    onError,
  );
}

export const TABLE_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export async function createTable(input: {
  id: string;
  name: string;
  seats: number | null;
}): Promise<void> {
  const ref = doc(tablesCol, input.id);
  if ((await getDoc(ref)).exists()) {
    throw new Error(`Table "${input.id}" already exists.`);
  }
  await setDoc(ref, {
    name: input.name.trim(),
    seats: input.seats,
    status: 'available',
    created_at: serverTimestamp(),
    last_updated: serverTimestamp(),
  });
}

export async function updateTable(
  id: string,
  input: { name: string; seats: number | null },
): Promise<void> {
  await updateDoc(doc(tablesCol, id), {
    name: input.name.trim(),
    seats: input.seats,
    last_updated: serverTimestamp(),
  });
}

export async function deleteTable(table: RestaurantTable): Promise<void> {
  if (table.status === 'occupied') {
    throw new Error('Free the table before deleting it.');
  }
  await deleteDoc(doc(tablesCol, table.id));
}
