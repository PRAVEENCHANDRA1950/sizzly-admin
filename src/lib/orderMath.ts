import type { Addon, Order, OrderItem } from '../types';

// Mirrors OrderItemEntity.unitPrice / totalPrice in the Flutter app:
// `price` is the base price and add-ons are charged on top, per unit.

export const addonsTotal = (addons: Addon[]) =>
  addons.reduce((sum, a) => sum + (a.amount || 0), 0);

export const itemUnitPrice = (item: OrderItem) => item.price + addonsTotal(item.addons);

export const itemTotal = (item: OrderItem) => itemUnitPrice(item) * item.quantity;

export const orderTotal = (order: Order) =>
  order.items.reduce((sum, item) => sum + itemTotal(item), 0);

export const orderItemCount = (order: Order) =>
  order.items.reduce((sum, item) => sum + item.quantity, 0);

/** Orders that count towards sales: something was ordered and it wasn't cancelled. */
export const isBillable = (order: Order) =>
  order.items.length > 0 && order.status.toLowerCase() !== 'cancelled';

export const isOpen = (order: Order) => {
  const status = order.status.toLowerCase();
  return order.is_active && status !== 'completed' && status !== 'cancelled';
};

export const pendingItems = (order: Order) => order.items.filter((i) => !i.is_served);
