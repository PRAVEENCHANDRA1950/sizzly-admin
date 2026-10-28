import { useEffect, useState } from 'react';
import type { Unsubscribe } from 'firebase/firestore';
import { subscribeMenus } from '../services/menu';
import { subscribeOrdersSince } from '../services/orders';
import { subscribeTables } from '../services/tables';
import type { MenuItem, Order, RestaurantTable } from '../types';

export interface LiveData<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

type Subscribe<T> = (onData: (data: T) => void, onError: (e: Error) => void) => Unsubscribe;

function useSubscription<T>(subscribe: Subscribe<T>, initial: T, deps: unknown[]): LiveData<T> {
  const [state, setState] = useState<LiveData<T>>({ data: initial, loading: true, error: null });

  useEffect(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    return subscribe(
      (data) => setState({ data, loading: false, error: null }),
      (e) => setState((s) => ({ ...s, loading: false, error: e.message })),
    );
    // `subscribe` is recreated every render; `deps` says when it actually changes.
  }, deps);

  return state;
}

const EMPTY: never[] = [];

export const useMenus = () => useSubscription<MenuItem[]>(subscribeMenus, EMPTY, []);

export const useTables = () => useSubscription<RestaurantTable[]>(subscribeTables, EMPTY, []);

/** Live orders created on/after `since`. Pass a stable Date (e.g. from useMemo). */
export const useOrdersSince = (since: Date) =>
  useSubscription<Order[]>(
    (onData, onError) => subscribeOrdersSince(since, onData, onError),
    EMPTY,
    [since.getTime()],
  );
