import React, { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';
import { STORAGE_KEYS } from '../constants/app';
import { PersistStatus, usePersistentStore } from '../hooks/usePersistentStore';
import type { Preferences } from '../types/models';
import { parsePreferences } from './schema';

/** Device-wide preferences (shared by every local account). */
export const DEFAULT_PREFERENCES: Preferences = {
  appearance: 'system',
  weekStartsOn: 1,
  snakeSpeed: 'normal',
  onboardingComplete: false,
};

type PreferencesContextValue = {
  preferences: Preferences;
  status: PersistStatus;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const reducer = (s: Preferences, patch: Partial<Preferences>): Preferences =>
  parsePreferences({ ...s, ...patch }, DEFAULT_PREFERENCES);
const hydratePreferences = (stored: unknown) => parsePreferences(stored, DEFAULT_PREFERENCES);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { state: preferences, dispatch, status } = usePersistentStore(
    STORAGE_KEYS.preferences,
    reducer,
    DEFAULT_PREFERENCES,
    hydratePreferences,
    'useDefaults',
  );

  // Preferences apply immediately in memory; a failed write is logged by the store
  // and simply retried with the next change.
  const setPreference = useCallback<PreferencesContextValue['setPreference']>(
    (key, value) => {
      dispatch({ [key]: value }).catch(() => undefined);
    },
    [dispatch],
  );

  const value = useMemo(() => ({ preferences, status, setPreference }), [preferences, status, setPreference]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
