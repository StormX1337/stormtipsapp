import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { theme } from '@/lib/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Screen } from '@/components/layout';
import { Paywall, type PaywallData } from '@/components/paywall';
import { ErrorState, Skeleton } from '@/components/primitives';

const VALID = new Set(['free', 'vip', 'extra', 'combo', 'fix-odds']);

/**
 * Product paywall.
 *
 * The figures, plans and benefits all come from the API; nothing on this screen
 * is hardcoded, and the unlock itself happens server-side after verification.
 */
export default function PaywallScreen(): ReactNode {
  const { product } = useLocalSearchParams<{ product: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const { refresh } = useAuth();

  const slug = (product ?? 'combo').toLowerCase();
  const valid = VALID.has(slug);

  const query = useQuery({
    queryKey: ['paywall', slug],
    queryFn: () => api<PaywallData>(`/billing/paywall/${slug}`),
    enabled: valid,
  });

  return (
    <Screen title={query.data?.product.name ?? t('paywall.checkout')} back>
      {!valid ? (
        <ErrorState message={t('error.notFound')} />
      ) : query.isPending ? (
        <View style={{ paddingTop: theme.spacing[5] }}>
          <Skeleton height={40} width="60%" />
          <Skeleton height={220} />
          <Skeleton height={120} />
        </View>
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />
      ) : (
        <Paywall
          data={query.data}
          onPurchased={() => {
            void refresh();
            router.back();
          }}
        />
      )}
    </Screen>
  );
}
