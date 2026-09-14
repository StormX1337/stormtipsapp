import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { colors } from '@storm-tips/ui';
import { api, tokens } from './api';
import { preferences } from './storage';

const TOKEN_KEY = 'pushToken';

/** Foreground presentation: show the banner but never steal focus mid-scroll. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

/** Android requires channels to be created before the first notification. */
export async function configureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const channels: { id: string; name: string; importance: Notifications.AndroidImportance }[] = [
    { id: 'tips', name: 'Neue Analysen', importance: Notifications.AndroidImportance.HIGH },
    { id: 'results', name: 'Ergebnisse', importance: Notifications.AndroidImportance.DEFAULT },
    {
      id: 'reminders',
      name: 'Anstoß-Erinnerungen',
      importance: Notifications.AndroidImportance.HIGH,
    },
    { id: 'account', name: 'Konto & Abo', importance: Notifications.AndroidImportance.DEFAULT },
    { id: 'promotions', name: 'Angebote', importance: Notifications.AndroidImportance.LOW },
  ];
  for (const channel of channels) {
    await Notifications.setNotificationChannelAsync(channel.id, {
      name: channel.name,
      importance: channel.importance,
      lightColor: colors.accent.DEFAULT,
      vibrationPattern: [0, 200, 100, 200],
    });
  }
}

/**
 * Requests permission and registers the Expo push token with the API.
 * Silently does nothing on a simulator or when the user declines.
 */
export async function registerPushToken(): Promise<string | null> {
  // Expo web has no push module, and a simulator has no token to register.
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  if (!tokens.access) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  await configureAndroidChannels();

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await api('/me/devices', {
      method: 'POST',
      body: {
        token: data,
        provider: 'EXPO',
        platform: Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB',
        deviceName: Device.deviceName ?? undefined,
        appVersion: Constants.expoConfig?.version,
      },
    });
    await preferences.set(TOKEN_KEY, data);
    return data;
  } catch {
    // Push is a convenience; failing to register must not break sign-in.
    return null;
  }
}

export async function unregisterPushToken(): Promise<void> {
  const token = await preferences.get(TOKEN_KEY);
  if (!token) return;
  try {
    await api(`/me/devices/${encodeURIComponent(token)}`, { method: 'DELETE' });
  } catch {
    // Best effort — the server also drops tokens that stop receiving.
  }
}

/** Maps a notification payload to an in-app route. */
export function routeForNotification(data: Record<string, unknown> | undefined): string | null {
  const deepLink = typeof data?.deepLink === 'string' ? data.deepLink : null;
  if (!deepLink) return null;
  const withoutScheme = deepLink.replace(/^stormtips:\/\//, '');
  if (!withoutScheme || withoutScheme === 'home') return '/free';
  return `/${withoutScheme}`;
}
