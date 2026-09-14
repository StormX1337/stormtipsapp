import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { theme } from '@/lib/theme';
import { I18nProvider } from '@/lib/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';
import { reachability } from '@/lib/api';
import { configureAndroidChannels, routeForNotification } from '@/lib/notifications';
import { endPurchases, initPurchases } from '@/lib/purchases';
import { preferences } from '@/lib/storage';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 30 * 60_000,
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status ?? 0;
        // 4xx responses are final; only transport problems are worth retrying.
        if (status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
    },
  },
});

// React Query learns about connectivity from the API client's own signal.
onlineManager.setEventListener((setOnline) => reachability.subscribe(setOnline));

/** Hides the splash once the stored session has been restored. */
function SplashGate({ children }: { children: ReactNode }): ReactNode {
  const { ready } = useAuth();
  const router = useRouter();
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const seen = await preferences.get('onboarded');
      if (!seen) router.replace('/onboarding');
      setCheckedOnboarding(true);
      await SplashScreen.hideAsync();
    })();
  }, [ready, router]);

  return (
    <View style={styles.root}>
      {children}
      {!ready || !checkedOnboarding ? <View style={styles.cover} /> : null}
    </View>
  );
}

/** Opens the screen a push notification points at. */
function NotificationRouter(): null {
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    // Push notifications are a native-only surface; Expo web has no module.
    if (Platform.OS === 'web') return;

    void configureAndroidChannels();

    const open = (response: Notifications.NotificationResponse): void => {
      if (handled.current === response.notification.request.identifier) return;
      handled.current = response.notification.request.identifier;
      const route = routeForNotification(
        response.notification.request.content.data as Record<string, unknown> | undefined,
      );
      if (route) router.push(route as never);
    };

    // A notification may have cold-started the app.
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) open(response);
      })
      .catch(() => undefined);

    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [router]);

  return null;
}

export default function RootLayout(): ReactNode {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.bg.base);
    void initPurchases();

    // React Query refetches when the app comes back to the foreground.
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });

    return () => {
      subscription.remove();
      void endPurchases();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <AuthProvider>
              <SplashGate>
                <StatusBar style="light" backgroundColor={theme.colors.bg.subtle} />
                <NotificationRouter />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: theme.colors.bg.base },
                    animation: 'slide_from_right',
                  }}
                >
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                  <Stack.Screen name="paywall/[product]" options={{ presentation: 'modal' }} />
                </Stack>
              </SplashGate>
            </AuthProvider>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg.base },
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.bg.base },
});
