import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { theme, shared } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { Screen } from '@/components/layout';
import { Button, EmptyState } from '@/components/primitives';

export default function NotFoundScreen(): ReactNode {
  const t = useT();
  const router = useRouter();
  return (
    <Screen title={t('common.appName')} back>
      <View style={[shared.centered, { paddingTop: theme.spacing[12] }]}>
        <EmptyState title={t('error.notFound')} body={t('error.generic')} />
        <Button label={t('nav.free')} onPress={() => router.replace('/free')} />
      </View>
    </Screen>
  );
}
