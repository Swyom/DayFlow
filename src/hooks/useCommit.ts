import { useCallback, useRef, useState } from 'react';

export const SAVE_ERROR_MESSAGE = 'Couldn’t save to this device. Check that storage isn’t full, then try again.';

/**
 * Tracks an editor's save: `saving` disables the submit button (no double taps →
 * no duplicates) and `error` is shown inline. `commit` resolves to true once the
 * change is persisted. Callers must make `apply` idempotent (see editors: after the
 * first create, retries update the same id instead of creating again).
 */
export function useCommit() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const commit = useCallback(async (apply: () => Promise<void>): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await apply();
      return true;
    } catch {
      setError(SAVE_ERROR_MESSAGE);
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, []);

  return { saving, error, commit, clearError: () => setError(null) };
}
