# Sizzly Admin

Admin panel for **Sizzly Chicken**: manage the menu, tables and live orders, and view sales
reports. It works on the same Firebase project (`sizzly-7c8a9`) as the Flutter customer app
([sizzly-chicken](https://github.com/PRAVEENCHANDRA1950/sizzly-chicken)), so changes show up
for guests in real time.

Built with React 18, TypeScript, Vite, Tailwind CSS, Firebase (Auth + Firestore), Recharts
and qrcode.react.

## Features

| Page | What it does |
|---|---|
| **Login** | Email/password sign-in (Firebase Auth), "keep me signed in", password reset |
| **Dashboard** | Today's sales, orders, average order value, tables occupied, menu stock; 7-day sales chart; top items; open tables |
| **Live orders** | Real-time orders per table. Move items from New → Ready → Served (this updates the guest's *Served* tab); serve all; close a table |
| **Menu** | Search/filter; add, edit and delete items; one-click in-stock toggle; add-ons editor (name + price) |
| **Tables** | Add/edit/delete tables; see who is seated and their running bill; free a table; QR code per table (download PNG / print / copy link) |
| **Reports** | Date presets or custom range; revenue, orders, average order value, items sold, add-on revenue; revenue by day, category and hour; item-wise and order-wise tables with CSV export |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

No `.env` is needed: the app defaults to the Sizzly Firebase web config (the same public
config shipped in the Flutter app). Copy `.env.example` to `.env` to override it, change the
customer app URL used in table QR codes, or restrict sign-in to specific emails.

### One-time Firebase setup (required for login)

1. Firebase Console → **Authentication** → **Get started**.
2. **Sign-in method** → enable **Email/Password**.
3. **Users** → **Add user** → create the admin account(s).
4. If you host the panel on a custom domain, add it under **Authentication → Settings →
   Authorized domains** (`localhost` is allowed by default).

Any account in Firebase Auth can sign in, because guests never sign in to the customer app.
To restrict access further, set `VITE_ADMIN_EMAILS=a@x.com,b@y.com`.

### Deploying

`netlify.toml` is included: connect the repo in Netlify (build `npm run build`, publish
`dist`). Any static host works if it rewrites unknown paths to `/index.html`.

## Data model (shared with the Flutter app)

| Collection | Doc id | Notes |
|---|---|---|
| `menus` | auto | `name`, `price`, `mrp`, `category`, `description`, `image` (URL), `ingredients[]`, `nutritions`, `ratings`, `est_time_prepare` (**string**, e.g. "15-18 mins"), `is_veg`, `is_stock`, `isaddons`, `addons[{name, amount}]` |
| `tables` | table id (in the QR link) | `status` (`available`/`occupied`), `active_order_id`, `last_updated`, optional `name`, `seats` |
| `orders` | auto | `table_id`, `status`, `is_active`, `created_at`, `expires_at`, `items[{id, name, price, quantity, status (fired/cooked/served), is_served, image, addons[]}]` |
| `carts` | order id | live shared cart of a table session |

Prices: an order item's `price` is the base price, and add-ons are charged on top per unit,
so line total = `(price + Σ addon.amount) × quantity`. This matches the customer app.

The customer app reads these types strictly (for example `est_time_prepare` must be a
string), and `src/services/menu.ts` writes them accordingly. Keep it that way when adding
fields.

## Security

The customer app writes to Firestore without signing in, so the database rules must stay
open for guest flows. The admin-only operations (menu edits, creating/deleting tables) can
still be locked to signed-in users: see [`firestore.rules.example`](firestore.rules.example).
Review it and test it against the customer app before deploying it.
