import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import { useMenus } from '../hooks/useLiveData';
import { deleteMenuItem, setMenuItemStock } from '../services/menu';
import { useToast } from '../context/ToastContext';
import { MenuItemForm } from '../components/MenuItemForm';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Spinner,
  Toggle,
  VegMark,
  inputClass,
} from '../components/ui';
import { formatCurrency } from '../lib/format';
import type { MenuItem } from '../types';

type VegFilter = 'all' | 'veg' | 'nonveg';
type StockFilter = 'all' | 'in' | 'out';

export function MenuPage() {
  const menus = useMenus();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [veg, setVeg] = useState<VegFilter>('all');
  const [stock, setStock] = useState<StockFilter>('all');
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(menus.data.map((m) => m.category).filter(Boolean))].sort(),
    [menus.data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menus.data.filter(
      (m) =>
        (!q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)) &&
        (category === 'all' || m.category === category) &&
        (veg === 'all' || m.is_veg === (veg === 'veg')) &&
        (stock === 'all' || m.is_stock === (stock === 'in')),
    );
  }, [menus.data, search, category, veg, stock]);

  function openForm(item: MenuItem | null) {
    setEditing(item);
    setFormOpen(true);
  }

  async function toggleStock(item: MenuItem, inStock: boolean) {
    setPending(item.id);
    try {
      await setMenuItemStock(item.id, inStock);
      toast.success(`${item.name} marked ${inStock ? 'in stock' : 'out of stock'}.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function remove(item: MenuItem) {
    if (!window.confirm(`Delete "${item.name}" from the menu? This cannot be undone.`)) return;
    setPending(item.id);
    try {
      await deleteMenuItem(item.id);
      toast.success(`"${item.name}" deleted.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  const outOfStock = menus.data.filter((m) => !m.is_stock).length;

  return (
    <>
      <PageHeader
        title="Menu"
        subtitle={`${menus.data.length} items in ${categories.length} categories${
          outOfStock ? ` · ${outOfStock} out of stock` : ''
        }`}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => openForm(null)}>
            Add item
          </Button>
        }
      />

      {menus.error && <ErrorBanner message={`Could not load the menu: ${menus.error}`} />}

      <Card>
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search items"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 lg:flex">
            <select className={`${inputClass} lg:w-44`} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select className={`${inputClass} lg:w-32`} value={veg} onChange={(e) => setVeg(e.target.value as VegFilter)} aria-label="Veg filter">
              <option value="all">Veg & non-veg</option>
              <option value="veg">Veg</option>
              <option value="nonveg">Non-veg</option>
            </select>
            <select className={`${inputClass} lg:w-36`} value={stock} onChange={(e) => setStock(e.target.value as StockFilter)} aria-label="Stock filter">
              <option value="all">Any stock</option>
              <option value="in">In stock</option>
              <option value="out">Out of stock</option>
            </select>
          </div>
        </div>

        {menus.loading ? (
          <Spinner label="Loading menu…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="h-6 w-6" />}
            title={menus.data.length ? 'No items match these filters' : 'Your menu is empty'}
            description={menus.data.length ? 'Try a different search or filter.' : 'Add your first dish to get started.'}
            action={
              !menus.data.length && (
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => openForm(null)}>
                  Add item
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3">Add-ons</th>
                  <th className="px-4 py-3">In stock</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <tr key={item.id} className={item.is_stock ? '' : 'bg-gray-50/60'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                          {item.image && (
                            <img src={item.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium text-ink">
                            <VegMark veg={item.is_veg} />
                            <span className="truncate">{item.name}</span>
                          </p>
                          <p className="mt-0.5 max-w-xs truncate text-xs text-gray-500">
                            {item.description || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.category || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="font-semibold text-ink">{formatCurrency(item.price)}</span>
                      {item.mrp != null && item.mrp > item.price && (
                        <span className="block text-xs text-gray-400 line-through">{formatCurrency(item.mrp)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.isaddons && item.addons.length > 0 ? (
                        <span title={item.addons.map((a) => `${a.name} (+₹${a.amount})`).join(', ')}>
                          <Badge tone="blue">{item.addons.length} add-on{item.addons.length > 1 ? 's' : ''}</Badge>
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Toggle
                        checked={item.is_stock}
                        disabled={pending === item.id}
                        onChange={(v) => toggleStock(item, v)}
                        label={`${item.name} in stock`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openForm(item)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-ink"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(item)}
                          disabled={pending === item.id}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <MenuItemForm
        open={formOpen}
        item={editing}
        categories={categories}
        onClose={() => setFormOpen(false)}
      />
    </>
  );
}
