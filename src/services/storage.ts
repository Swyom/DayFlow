import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin JSON wrapper around AsyncStorage. Unparseable values are moved aside to
 * `<key>:corrupt` instead of being silently overwritten, so data can be recovered.
 */
export async function readJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    await AsyncStorage.setItem(`${key}:corrupt`, raw);
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function writeJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
