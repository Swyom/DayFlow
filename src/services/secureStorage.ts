import * as SecureStore from 'expo-secure-store';

/**
 * Small JSON wrapper around expo-secure-store (iOS Keychain / Android Keystore-backed
 * encrypted storage) for secrets: password credentials and the active session.
 * Values are readable only while the device is unlocked and never leave the device
 * (no iCloud Keychain sync, excluded from backups).
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function readSecureJSON<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key, OPTIONS);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    await SecureStore.deleteItemAsync(key, OPTIONS);
    return null;
  }
}

export async function writeSecureJSON(key: string, value: unknown): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(value), OPTIONS);
}

export async function removeSecure(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key, OPTIONS);
}
