# Sizzly Admin (React)

Admin panel for the Sizzly Chicken QR dine-in ordering system. It shares the Firebase project
`sizzly-7c8a9` with the Flutter customer app
(https://github.com/PRAVEENCHANDRA1950/sizzly-chicken). **That app is the other reader/writer
of every collection here; any write must stay compatible with its Dart models.**

## Commands

```bash
npm install
npm run dev         # Vite dev server on :5173
npm run typecheck   # tsc --noEmit (strict; no unused locals/params)
npm run build       # typecheck + vite build → dist/
```

There is no test suite or linter yet; `npm run build` is the gate.

## Stack and layout

React 18 + TypeScript + Vite 5, Tailwind 3 (brand colors in `tailwind.config.js` mirror the
Flutter theme: `brand-500` = #FF6B00), Firebase modular SDK v11, React Router 7 (declarative
`<Routes>` API), Recharts 2, qrcode.react, lucide-react icons.

- `src/lib/firebase.ts` — Firebase init (env overrides, public defaults), admin email
  allowlist, `tableQrUrl()`
- `src/types.ts` — document shapes (snake_case, exactly as stored)
- `src/services/*.ts` — the only place that talks to Firestore. `parse.ts` holds defensive
  converters, since data is written by two apps and hand edits
- `src/hooks/useLiveData.ts` — `onSnapshot` hooks (`useMenus`, `useTables`, `useOrdersSince`)
- `src/lib/orderMath.ts` — pricing (mirrors Flutter `OrderItemEntity.unitPrice/totalPrice`)
- `src/context/` — `AuthContext` (Firebase Auth, login/logout/reset, error messages),
  `ToastContext`
- `src/components/ui.tsx` — Button, Card, Modal, Field, Toggle, Badge, StatCard…;
  `charts.tsx` — single-series bar charts
- `src/pages/` — Login, Dashboard, Orders (live kitchen), Menu, Tables, Reports
  (lazy-loaded in `App.tsx`)

## Compatibility rules (Flutter reads these strictly)

- `menus.est_time_prepare` is a **string** (free text like "15-18 mins"). Writing a number
  breaks the customer menu (`as String?` cast). The same goes for `nutritions`, `image` and
  `category`. `menus.id` must equal the doc id.
- Add-ons are `{name, amount}` everywhere. Item `price` is the base price, and add-ons are
  added per unit.
- Order items live in the `orders/{id}.items` array; guests only append. Update an item by
  index inside a transaction and verify `id`+`name` first (see `setItemsStatus`). Preserve
  unknown fields by spreading the raw item.
- `is_served` drives the guest's "Served" tab; keep it in sync with `status`
  (`fired` → `cooked` → `served`). Treat either flag as served when reading.
- Closing a session (`closeSession`): order → `status: completed, is_active: false`; table →
  `available` + delete `active_order_id` (only if it still points at this order); delete
  `carts/{orderId}`.
- Order queries filter on `created_at` only (range + orderBy on one field) so no composite
  index is needed. Keep it that way, or add the index to the Firebase project.
- The Flutter app caches the menu in Hive but refreshes from Firestore on every home-page
  load, so menu edits reach guests on their next visit or refresh.

## Auth

Firebase Auth email/password. Every Auth user is treated as an admin (guests never sign in),
optionally narrowed by `VITE_ADMIN_EMAILS`. Auth must be enabled in the Firebase console
(it was not initially: the API returned `CONFIGURATION_NOT_FOUND`).
