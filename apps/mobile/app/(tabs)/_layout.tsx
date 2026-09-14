import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { theme } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { BallIcon, BoltIcon, CrownIcon, PollIcon, TicketIcon } from '@/components/icons';

const { colors, fontSize, sizes } = theme;

/** Free is the landing tab, exactly as in the reference app. */
export const unstable_settings = { initialRouteName: 'free' };

/**
 * Bottom tab bar.
 *
 * Free · Combo · Extra · VIP · Poll — the same five destinations as the
 * reference app, each tinted with its product colour when active.
 */
export default function TabsLayout(): ReactNode {
  const t = useT();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent.DEFAULT,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        sceneStyle: { backgroundColor: colors.bg.base },
      }}
    >
      <Tabs.Screen
        name="free"
        options={{
          title: t('nav.free'),
          tabBarIcon: ({ color }) => <BallIcon color={color} size={sizes.iconMd} />,
        }}
      />
      <Tabs.Screen
        name="combo"
        options={{
          title: t('nav.combo'),
          tabBarActiveTintColor: colors.product.COMBO,
          tabBarIcon: ({ color }) => <TicketIcon color={color} size={sizes.iconMd} />,
        }}
      />
      <Tabs.Screen
        name="extra"
        options={{
          title: t('nav.extra'),
          tabBarActiveTintColor: colors.product.EXTRA,
          tabBarIcon: ({ color }) => <BoltIcon color={color} size={sizes.iconMd} />,
        }}
      />
      <Tabs.Screen
        name="vip"
        options={{
          title: t('nav.vip'),
          tabBarActiveTintColor: colors.product.VIP,
          tabBarIcon: ({ color }) => <CrownIcon color={color} size={sizes.iconMd} />,
        }}
      />
      <Tabs.Screen
        name="poll"
        options={{
          title: t('nav.poll'),
          tabBarIcon: ({ color }) => <PollIcon color={color} size={sizes.iconMd} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
    height: sizes.tabBarHeight,
    paddingTop: 4,
  },
  label: { fontSize: fontSize['2xs'], fontWeight: '600' },
  item: { paddingVertical: 2 },
});
