'use client';

import { use, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/navigation';
import { Paywall, type PaywallData } from '@/components/paywall';
import { ErrorState } from '@/components/states';
import { Skeleton } from '@/components/primitives';

export default function PaywallPage({
  params,
}: {
  params: Promise<{ product: string }>;
}): ReactNode {
  const { product } = use(params);
  const { t } = useI18n();
  const router = useRouter();

  const query = useQuery({
    queryKey: ['paywall', product],
    queryFn: () => api<PaywallData>(`/billing/paywall/${product}`, { auth: true }),
  });

  return (
    <AppShell
      title={query.data?.product.name ?? t('common.loading')}
      left={
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-md text-ink-muted hover:bg-bg-card hover:text-ink"
        >
          <ChevronLeft size={22} aria-hidden />
        </button>
      }
    >
      <div id="main" className="mx-auto w-full max-w-2xl">
        {query.isPending ? (
          <div className="flex flex-col gap-3 pt-6">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : query.isError ? (
          <div className="pt-6">
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : (
          <Paywall data={query.data} />
        )}
      </div>
    </AppShell>
  );
}
