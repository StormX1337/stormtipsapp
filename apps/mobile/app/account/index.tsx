import type { ReactNode } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { maskEmail } from '@storm-tips/ui';
import { theme } from '@/lib/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Card, ListRow, Screen, SectionTitle } from '@/components/layout';
import { Button } from '@/components/primitives';
import {
  BellIcon,
  ChartIcon,
  ClockIcon,
  CrownIcon,
  GiftIcon,
  ShieldIcon,
  UserIcon,
} from '@/components/icons';

const { colors, fontSize, spacing } = theme;

export default function AccountScreen(): ReactNode {
  const { t } = useI18n();
  const router = useRouter();
  const { user, logout } = useAuth();

  function confirmDelete(): void {
    Alert.alert(t('profile.deleteAccount'), t('subscription.cancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccount'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await api('/me', { method: 'DELETE' });
            await logout();
            router.replace('/free');
          })();
        },
      },
    ]);
  }

  if (!user) {
    return (
      <Screen title={t('profile.title')} back>
        <Card style={{ marginTop: spacing[6], alignItems: 'center', gap: spacing[3] }}>
          <UserIcon size={32} color={colors.text.secondary} />
          <Text style={styles.signedOut}>{t('poll.loginRequired')}</Text>
          <Button
            label={t('auth.login')}
            onPress={() => router.push('/auth/login')}
            style={{ alignSelf: 'stretch' }}
          />
          <Button
            label={t('auth.register')}
            variant="outline"
            onPress={() => router.push('/auth/register')}
            style={{ alignSelf: 'stretch' }}
          />
        </Card>
      </Screen>
    );
  }

  const activeProducts = user.entitlements.filter((entitlement) => entitlement.active);

  return (
    <Screen title={t('profile.title')} back>
      <Card style={{ marginTop: spacing[4] }}>
        <Text style={styles.name}>{user.displayName ?? user.username ?? t('profile.account')}</Text>
        <Text style={styles.email}>{maskEmail(user.email)}</Text>
        {!user.emailVerified ? (
          <Text style={styles.unverified}>{t('auth.verifyEmail')}</Text>
        ) : null}
        <Text style={styles.products}>
          {activeProducts.length > 0
            ? activeProducts.map((entitlement) => entitlement.product).join(' · ')
            : t('subscription.none')}
        </Text>
      </Card>

      <SectionTitle>{t('profile.account')}</SectionTitle>
      <Card>
        <ListRow
          label={t('subscription.title')}
          icon={<CrownIcon size={18} color={colors.gold.DEFAULT} />}
          onPress={() => router.push('/account/subscription')}
        />
        <ListRow
          label={t('profile.notifications')}
          icon={<BellIcon size={18} color={colors.text.secondary} />}
          onPress={() => router.push('/account/notifications')}
        />
        <ListRow
          label={t('referral.title')}
          icon={<GiftIcon size={18} color={colors.accent.DEFAULT} />}
          onPress={() => router.push('/account/referrals')}
        />
        <ListRow
          label={t('nav.history')}
          icon={<ClockIcon size={18} color={colors.text.secondary} />}
          onPress={() => router.push('/history')}
        />
        <ListRow
          label={t('stats.title')}
          icon={<ChartIcon size={18} color={colors.text.secondary} />}
          onPress={() => router.push('/statistics')}
        />
      </Card>

      <SectionTitle>{t('profile.preferences')}</SectionTitle>
      <Card>
        <ListRow label={t('profile.timezone')} value={user.timezone} />
        <ListRow label={t('profile.currency')} value={user.currency} />
      </Card>

      <SectionTitle>{t('legal.help')}</SectionTitle>
      <Card>
        <ListRow
          label={t('legal.responsible')}
          icon={<ShieldIcon size={18} color={colors.text.secondary} />}
          onPress={() => router.push('/legal/responsible-gambling')}
        />
        <ListRow label={t('legal.terms')} onPress={() => router.push('/legal/terms')} />
        <ListRow label={t('legal.privacy')} onPress={() => router.push('/legal/privacy')} />
        <ListRow label={t('legal.disclaimer')} onPress={() => router.push('/legal/disclaimer')} />
        <ListRow
          label={t('legal.helpLine')}
          onPress={() => void Linking.openURL('https://www.bzga.de/service/beratungsstellen/')}
        />
      </Card>

      <View style={{ marginTop: spacing[6], gap: spacing[3] }}>
        <Button
          label={t('auth.logout')}
          variant="outline"
          onPress={() => {
            void (async () => {
              await logout();
              router.replace('/free');
            })();
          }}
        />
        <Button label={t('profile.deleteAccount')} variant="danger" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  signedOut: { color: colors.text.secondary, fontSize: fontSize.md, textAlign: 'center' },
  name: { color: colors.text.primary, fontSize: fontSize.xl, fontWeight: '800' },
  email: { marginTop: 2, color: colors.text.muted, fontSize: fontSize.base },
  unverified: { marginTop: spacing[2], color: colors.gold.DEFAULT, fontSize: fontSize.sm },
  products: {
    marginTop: spacing[2],
    color: colors.accent.DEFAULT,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
