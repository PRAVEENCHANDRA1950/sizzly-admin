import { Timestamp } from 'firebase/firestore';
import type { Addon } from '../types';

// Firestore data is written by two apps; parse defensively instead of trusting types.

export const asString = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : v == null ? fallback : String(v);

export const asNumber = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const asNullableNumber = (v: unknown): number | null =>
  v == null || v === '' ? null : asNumber(v, 0);

export const asBool = (v: unknown, fallback = false): boolean =>
  typeof v === 'boolean' ? v : fallback;

export const asDate = (v: unknown): Date | null => {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

export const asAddons = (v: unknown): Addon[] =>
  Array.isArray(v)
    ? v
        .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
        .map((a) => ({ name: asString(a.name), amount: asNumber(a.amount) }))
    : [];

export const asStringList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => asString(x)).filter(Boolean) : [];
