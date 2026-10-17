import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

/**
 * Supabase client for cloud backup of the profile, steps and screen-time summaries.
 *
 * Only the project URL and the public anon key are used (from .env / EAS environment
 * variables). They are safe to ship in the app: every table is protected by Row Level
 * Security, so a signed-in device can only read and write its own rows. Privileged keys
 * (service_role) must never be added to the app.
 *
 * Identity is an anonymous Supabase Auth user created silently on first launch, so the
 * user never sees a log-in screen but still gets their own `auth.uid()` for RLS.
 * The session is kept in AsyncStorage (app-private storage), as Supabase recommends for
 * React Native; it can exceed SecureStore's per-item size limit.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

if (!supabase && __DEV__) {
  console.warn('[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing: cloud sync is off.');
}

if (supabase) {
  // Refresh tokens only while the app is in the foreground (Supabase's React Native guidance).
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const AVATAR_BUCKET = 'avatars';

/**
 * Returns the signed-in (anonymous) user's id, creating the anonymous user on first use.
 * Throws when offline or when Supabase isn't configured; callers retry later.
 */
export async function ensureUserId(): Promise<string> {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error || !created.user) throw error ?? new Error('Anonymous sign-in failed.');
  return created.user.id;
}
