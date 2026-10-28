// Shapes of the Firestore documents shared with the Flutter customer app.
// Field names are kept exactly as stored (snake_case) so reads/writes stay compatible.

export interface Addon {
  name: string;
  amount: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  mrp: number | null;
  category: string;
  description: string;
  image: string;
  ingredients: string[];
  nutritions: string;
  ratings: number | null;
  /** Free text such as "15-18 mins"; must be stored as a string (the app casts it to String). */
  est_time_prepare: string;
  is_veg: boolean;
  is_stock: boolean;
  isaddons: boolean;
  addons: Addon[];
}

export type MenuItemInput = Omit<MenuItem, 'id'>;

export type TableStatus = 'available' | 'occupied';

export interface RestaurantTable {
  /** Document id; this is the `table_id` encoded in the table QR code. */
  id: string;
  name: string;
  seats: number | null;
  status: TableStatus;
  active_order_id: string | null;
  last_updated: Date | null;
}

export type ItemStatus = 'fired' | 'cooked' | 'served';

export interface OrderItem {
  id: string;
  name: string;
  /** Base price for one unit, add-ons excluded. */
  price: number;
  category: string | null;
  quantity: number;
  is_served: boolean;
  status: ItemStatus;
  image: string | null;
  addons: Addon[];
}

export interface Order {
  id: string;
  table_id: string;
  status: string;
  is_active: boolean;
  created_at: Date | null;
  expires_at: Date | null;
  closed_at: Date | null;
  items: OrderItem[];
}
