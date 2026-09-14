import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Two-tier storage.
 *
 * Credentials go into the Keychain / Keystore through expo-secure-store;
 * everything else (cached feeds, preferences) goes into AsyncStorage, which is
 * fast but must never hold a token.
 */
export const secureStorage = {
  async get(key: string): Promise<string | null> {
    // SecureStore has no web implementation; the app degrades to AsyncStorage
    // there, which is acceptable because Expo web is a development surface.
    if (Platform.OS === 'web') return AsyncStorage.getItem(`secure.${key}`);
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(`secure.${key}`, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(`secure.${key}`);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

interface CacheEnvelope<T> {
  at: number;
  value: T;
}

/** Offline cache with a soft TTL: stale data is still returned when offline. */
export const cache = {
  async read<T>(
    key: string,
    maxAgeMs = 24 * 3_600_000,
  ): Promise<{ value: T; stale: boolean } | null> {
    try {
      const raw = await AsyncStorage.getItem(`cache.${key}`);
      if (!raw) return null;
      const envelope = JSON.parse(raw) as CacheEnvelope<T>;
      return { value: envelope.value, stale: Date.now() - envelope.at > maxAgeMs };
    } catch {
      return null;
    }
  },
  async write<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `cache.${key}`,
        JSON.stringify({ at: Date.now(), value } satisfies CacheEnvelope<T>),
      );
    } catch {
      // A full disk must not break the screen.
    }
  },
  async clear(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith('cache.')));
  },
};

export const preferences = {
  async get(key: string): Promise<string | null> {
    return AsyncStorage.getItem(`pref.${key}`);
  },
  async set(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(`pref.${key}`, value);
  },
};
