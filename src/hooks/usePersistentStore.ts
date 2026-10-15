import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readJSON, writeJSON } from '../services/storage';
import { createWriteQueue } from '../services/writeQueue';

export type PersistStatus = 'loading' | 'ready' | 'error';

export type PersistentStore<S, A> = {
  state: S;
  status: PersistStatus;
  /** Last write failure (cleared by the next successful write). */
  saveError: Error | null;
  /**
   * Applies an action and persists the result. Resolves once the new state is on
   * disk; rejects if the write fails (the in-memory state is kept so a retry can
   * save it without re-applying the action).
   */
  dispatch: (action: A) => Promise<void>;
  /** Re-attempts writing the current state (after a failed save). */
  retrySave: () => Promise<void>;
  /** Latest state, including changes not yet rendered. */
  getState: () => S;
};

/**
 * Reducer-driven state mirrored to AsyncStorage under `key`.
 *
 * - The next state is computed synchronously (from a ref), so the value written
 *   is always the one the action produced — never a stale render's.
 * - Writes are serialised and coalesced: while one write is in flight, further
 *   changes are batched into a single follow-up write of the latest state.
 * - Storage is read exactly once per key, so effects re-running (Fast Refresh,
 *   remounts) can never overwrite newer in-memory changes with older stored data.
 */
export function usePersistentStore<S, A>(
  key: string,
  reducer: (state: S, action: A) => S,
  initial: S,
  hydrate: (stored: Partial<S>) => S = (stored) => ({ ...initial, ...stored }),
  /** 'block' surfaces the error (user data); 'useDefaults' carries on with `initial` (preferences). */
  onLoadError: 'block' | 'useDefaults' = 'block',
): PersistentStore<S, A> {
  const [state, setState] = useState(initial);
  const [status, setStatus] = useState<PersistStatus>('loading');
  const [saveError, setSaveError] = useState<Error | null>(null);

  const stateRef = useRef(initial);
  const loadedKey = useRef<string | null>(null);
  const reducerRef = useRef(reducer);
  reducerRef.current = reducer;
  const hydrateRef = useRef(hydrate);
  hydrateRef.current = hydrate;

  useEffect(() => {
    if (loadedKey.current === key) return;
    let cancelled = false;
    setStatus('loading');
    readJSON<Partial<S>>(key)
      .then((stored) => {
        if (cancelled) return;
        const next = stored ? hydrateRef.current(stored) : stateRef.current;
        stateRef.current = next;
        loadedKey.current = key;
        setState(next);
        setStatus('ready');
      })
      .catch((e) => {
        if (__DEV__) console.warn(`[storage] failed to load ${key}`, e); // dev only: keys stay out of device logs
        if (cancelled) return;
        if (onLoadError === 'useDefaults') {
          loadedKey.current = key;
          setStatus('ready');
        } else {
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, onLoadError]);

  const enqueueWrite = useMemo(() => createWriteQueue(() => stateRef.current, (v: S) => writeJSON(key, v)), [key]);

  const save = useCallback((): Promise<void> => {
    const write = enqueueWrite();
    write.then(
      () => setSaveError(null),
      (e: unknown) => {
        if (__DEV__) console.warn(`[storage] failed to save ${key}`, e);
        setSaveError(e instanceof Error ? e : new Error(String(e)));
      },
    );
    return write;
  }, [enqueueWrite, key]);

  const dispatch = useCallback(
    (action: A): Promise<void> => {
      if (loadedKey.current !== key) {
        // Never write before stored data is loaded, or defaults would overwrite it.
        return Promise.reject(new Error('Storage is not ready yet.'));
      }
      const next = reducerRef.current(stateRef.current, action);
      if (next === stateRef.current) return Promise.resolve();
      stateRef.current = next;
      setState(next);
      return save();
    },
    [key, save],
  );

  const getState = useCallback(() => stateRef.current, []);

  return { state, status, saveError, dispatch, retrySave: save, getState };
}
