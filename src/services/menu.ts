import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { MenuItem, MenuItemInput } from '../types';
import {
  asAddons,
  asBool,
  asNullableNumber,
  asNumber,
  asString,
  asStringList,
} from './parse';

const menusCol = collection(db, 'menus');

function fromDoc(id: string, data: DocumentData): MenuItem {
  return {
    id,
    name: asString(data.name),
    price: asNumber(data.price),
    mrp: asNullableNumber(data.mrp),
    category: asString(data.category),
    description: asString(data.description),
    image: asString(data.image),
    ingredients: asStringList(data.ingredients),
    nutritions: asString(data.nutritions),
    ratings: asNullableNumber(data.ratings),
    est_time_prepare: asString(data.est_time_prepare),
    // Missing flags default to the app's behaviour: shown as in stock.
    is_veg: asBool(data.is_veg),
    is_stock: asBool(data.is_stock, true),
    isaddons: asBool(data.isaddons),
    addons: asAddons(data.addons),
  };
}

/**
 * Builds the stored document. Types must match what MenuItemModel.fromJson casts to in the
 * Flutter app (e.g. `est_time_prepare` is a String) or the customer menu fails to load.
 */
function toDoc(input: MenuItemInput): DocumentData {
  return {
    name: input.name.trim(),
    price: Number(input.price),
    mrp: input.mrp == null ? null : Number(input.mrp),
    category: input.category.trim(),
    description: input.description.trim(),
    image: input.image.trim(),
    ingredients: input.ingredients.map((i) => i.trim()).filter(Boolean),
    nutritions: input.nutritions.trim(),
    ratings: input.ratings == null ? null : Number(input.ratings),
    est_time_prepare: String(input.est_time_prepare).trim(),
    is_veg: !!input.is_veg,
    is_stock: !!input.is_stock,
    isaddons: !!input.isaddons && input.addons.length > 0,
    addons: input.addons.map((a) => ({ name: a.name.trim(), amount: Number(a.amount) })),
  };
}

export function subscribeMenus(
  onData: (items: MenuItem[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    menusCol,
    (snap) => {
      const items = snap.docs.map((d) => fromDoc(d.id, d.data()));
      items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      onData(items);
    },
    onError,
  );
}

export async function createMenuItem(input: MenuItemInput): Promise<string> {
  const ref = doc(menusCol);
  // The app reads `id` from the document body first, so keep it equal to the doc id.
  await setDoc(ref, { id: ref.id, ...toDoc(input) });
  return ref.id;
}

export async function updateMenuItem(id: string, input: MenuItemInput): Promise<void> {
  await updateDoc(doc(menusCol, id), { id, ...toDoc(input) });
}

export async function setMenuItemStock(id: string, inStock: boolean): Promise<void> {
  await updateDoc(doc(menusCol, id), { is_stock: inStock });
}

export async function deleteMenuItem(id: string): Promise<void> {
  await deleteDoc(doc(menusCol, id));
}
