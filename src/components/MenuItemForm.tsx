import { useEffect, useState, type FormEvent } from 'react';
import { ImageOff, Plus, Trash2 } from 'lucide-react';
import { createMenuItem, updateMenuItem } from '../services/menu';
import { useToast } from '../context/ToastContext';
import { Button, Field, Modal, Toggle, inputClass } from './ui';
import type { MenuItem, MenuItemInput } from '../types';

interface FormState {
  name: string;
  category: string;
  price: string;
  mrp: string;
  description: string;
  image: string;
  ingredients: string;
  nutritions: string;
  ratings: string;
  est_time_prepare: string;
  is_veg: boolean;
  is_stock: boolean;
  isaddons: boolean;
  addons: { name: string; amount: string }[];
}

const EMPTY: FormState = {
  name: '',
  category: '',
  price: '',
  mrp: '',
  description: '',
  image: '',
  ingredients: '',
  nutritions: '',
  ratings: '',
  est_time_prepare: '',
  is_veg: false,
  is_stock: true,
  isaddons: false,
  addons: [],
};

function toForm(item: MenuItem): FormState {
  return {
    name: item.name,
    category: item.category,
    price: String(item.price),
    mrp: item.mrp == null ? '' : String(item.mrp),
    description: item.description,
    image: item.image,
    ingredients: item.ingredients.join(', '),
    nutritions: item.nutritions,
    ratings: item.ratings == null ? '' : String(item.ratings),
    est_time_prepare: item.est_time_prepare,
    is_veg: item.is_veg,
    is_stock: item.is_stock,
    isaddons: item.isaddons,
    addons: item.addons.map((a) => ({ name: a.name, amount: String(a.amount) })),
  };
}

type Errors = Partial<Record<keyof FormState | 'addonsList', string>>;

function validate(f: FormState): Errors {
  const errors: Errors = {};
  if (!f.name.trim()) errors.name = 'Name is required.';
  if (!f.category.trim()) errors.category = 'Category is required.';
  const price = Number(f.price);
  if (f.price.trim() === '' || !Number.isFinite(price) || price <= 0) errors.price = 'Enter a price above 0.';
  if (f.mrp.trim() !== '') {
    const mrp = Number(f.mrp);
    if (!Number.isFinite(mrp) || mrp < 0) errors.mrp = 'Enter a valid MRP.';
    else if (mrp < price) errors.mrp = 'MRP should not be lower than the selling price.';
  }
  if (f.ratings.trim() !== '') {
    const r = Number(f.ratings);
    if (!Number.isFinite(r) || r < 0 || r > 5) errors.ratings = 'Rating must be between 0 and 5.';
  }
  if (f.image.trim() && !/^https?:\/\//i.test(f.image.trim())) errors.image = 'Must be an http(s) URL.';

  if (!f.isaddons) return errors;
  const names = new Set<string>();
  for (const a of f.addons) {
    const name = a.name.trim().toLowerCase();
    const amount = Number(a.amount);
    if (!name) errors.addonsList = 'Every add-on needs a name.';
    else if (names.has(name)) errors.addonsList = `Duplicate add-on "${a.name.trim()}".`;
    else if (a.amount.trim() === '' || !Number.isFinite(amount) || amount < 0)
      errors.addonsList = `Enter a price for "${a.name.trim()}" (0 or more).`;
    names.add(name);
  }
  if (f.addons.length === 0) errors.addonsList = 'Add at least one add-on, or turn add-ons off.';
  return errors;
}

function toInput(f: FormState): MenuItemInput {
  return {
    name: f.name,
    category: f.category,
    price: Number(f.price),
    mrp: f.mrp.trim() === '' ? null : Number(f.mrp),
    description: f.description,
    image: f.image,
    ingredients: f.ingredients.split(','),
    nutritions: f.nutritions,
    ratings: f.ratings.trim() === '' ? null : Number(f.ratings),
    est_time_prepare: f.est_time_prepare,
    is_veg: f.is_veg,
    is_stock: f.is_stock,
    isaddons: f.isaddons,
    addons: f.isaddons ? f.addons.map((a) => ({ name: a.name, amount: Number(a.amount) })) : [],
  };
}

export function MenuItemForm({
  open,
  item,
  categories,
  onClose,
}: {
  open: boolean;
  /** Item to edit; omit to create a new one. */
  item: MenuItem | null;
  categories: string[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(item ? toForm(item) : EMPTY);
    setErrors({});
    setImageFailed(false);
  }, [open, item]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setAddon = (index: number, patch: Partial<FormState['addons'][number]>) =>
    setForm((f) => ({
      ...f,
      addons: f.addons.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      if (item) {
        await updateMenuItem(item.id, toInput(form));
        toast.success(`"${form.name.trim()}" updated.`);
      } else {
        await createMenuItem(toInput(form));
        toast.success(`"${form.name.trim()}" added to the menu.`);
      }
      onClose();
    } catch (err) {
      toast.error(`Could not save: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={item ? `Edit ${item.name}` : 'Add menu item'}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="menu-item-form" loading={saving}>
            {item ? 'Save changes' : 'Add item'}
          </Button>
        </>
      }
    >
      <form id="menu-item-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.name}>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Chicken 65"
              autoFocus
            />
          </Field>
          <Field label="Category" required error={errors.category} hint="Pick an existing one or type a new one.">
            <input
              className={inputClass}
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              list="menu-categories"
              placeholder="Quick Bites"
            />
            <datalist id="menu-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Price (₹)" required error={errors.price}>
            <input
              className={inputClass}
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              placeholder="180"
            />
          </Field>
          <Field label="MRP (₹)" error={errors.mrp} hint="Optional. Shown struck-through if higher than the price.">
            <input
              className={inputClass}
              inputMode="decimal"
              value={form.mrp}
              onChange={(e) => set('mrp', e.target.value)}
              placeholder="220"
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className={`${inputClass} min-h-[80px]`}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Crispy fried chicken tossed in curry leaves and red chilli."
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Image URL" error={errors.image} hint="Public image link (e.g. Supabase storage).">
            <input
              className={inputClass}
              value={form.image}
              onChange={(e) => {
                set('image', e.target.value);
                setImageFailed(false);
              }}
              placeholder="https://…/images/chicken-65.png"
            />
          </Field>
          <div className="flex h-[100px] items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50 sm:mt-6">
            {form.image.trim() && !imageFailed ? (
              <img
                src={form.image.trim()}
                alt="Preview"
                className="h-full w-full object-cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <span className="flex flex-col items-center gap-1 text-xs text-gray-400">
                <ImageOff className="h-5 w-5" />
                {imageFailed ? 'Not loading' : 'Preview'}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">Type</span>
            <div className="inline-flex rounded-lg border border-gray-300 p-0.5 text-sm">
              <button
                type="button"
                onClick={() => set('is_veg', true)}
                className={`flex-1 rounded-md px-2 py-1.5 font-medium ${form.is_veg ? 'bg-emerald-600 text-white' : 'text-gray-600'}`}
              >
                Veg
              </button>
              <button
                type="button"
                onClick={() => set('is_veg', false)}
                className={`flex-1 rounded-md px-2 py-1.5 font-medium ${!form.is_veg ? 'bg-red-600 text-white' : 'text-gray-600'}`}
              >
                Non-veg
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">In stock</span>
            <div className="flex h-9 items-center">
              <Toggle checked={form.is_stock} onChange={(v) => set('is_stock', v)} label="In stock" />
            </div>
          </div>
          <Field label="Prep time">
            <input
              className={inputClass}
              value={form.est_time_prepare}
              onChange={(e) => set('est_time_prepare', e.target.value)}
              placeholder="15-18 mins"
            />
          </Field>
          <Field label="Rating" error={errors.ratings}>
            <input
              className={inputClass}
              inputMode="decimal"
              value={form.ratings}
              onChange={(e) => set('ratings', e.target.value)}
              placeholder="4.5"
            />
          </Field>
        </div>

        <Field label="Ingredients" hint="Comma separated.">
          <input
            className={inputClass}
            value={form.ingredients}
            onChange={(e) => set('ingredients', e.target.value)}
            placeholder="Chicken, Curry leaves, Red chilli, Garlic"
          />
        </Field>

        <Field label="Nutritional info">
          <textarea
            className={`${inputClass} min-h-[60px]`}
            value={form.nutritions}
            onChange={(e) => set('nutritions', e.target.value)}
            placeholder="320 kcal · 18g protein · 12g carbs · 22g fat"
          />
        </Field>

        {/* Add-ons */}
        <div className="rounded-xl border border-gray-200">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Add-ons</p>
              <p className="text-xs text-gray-500">
                Optional extras guests can pick on the item page, charged per unit.
              </p>
            </div>
            <Toggle
              checked={form.isaddons}
              label="Enable add-ons"
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  isaddons: v,
                  addons: v && f.addons.length === 0 ? [{ name: '', amount: '' }] : f.addons,
                }))
              }
            />
          </div>
          {form.isaddons && (
            <div className="space-y-2 border-t border-gray-100 px-4 py-3">
              {form.addons.map((addon, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    value={addon.name}
                    onChange={(e) => setAddon(i, { name: e.target.value })}
                    placeholder="Extra cheese"
                    aria-label={`Add-on ${i + 1} name`}
                  />
                  <div className="relative w-32 shrink-0">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                    <input
                      className={`${inputClass} pl-7`}
                      inputMode="decimal"
                      value={addon.amount}
                      onChange={(e) => setAddon(i, { amount: e.target.value })}
                      placeholder="30"
                      aria-label={`Add-on ${i + 1} price`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => set('addons', form.addons.filter((_, j) => j !== i))}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove add-on ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {errors.addonsList && <p className="text-xs text-red-600">{errors.addonsList}</p>}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => set('addons', [...form.addons, { name: '', amount: '' }])}
              >
                Add another
              </Button>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
