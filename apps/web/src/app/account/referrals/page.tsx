'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check } from 'lucide-react';
import type { ReferralSummaryDTO } from '@profit-tips/types';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/navigation';
import { ErrorState } from '@/components/states';
import { StatTile } from '@/components/stat-tiles';
import { Button, Skeleton } from '@/components/primitives';

export default function ReferralsPage(): ReactNode {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const summary = useQuery({
    queryKey: ['referrals'],
    queryFn: () => api<ReferralSummaryDTO>('/me/referrals'),
  });

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the code stays selectable on screen.
    }
  }

  return (
    <AppShell title={t('referral.title')}>
      <div id="main" className="flex flex-col gap-4 py-4">
        {summary.isPending ? (
          <Skeleton className="h-56 w-full" />
        ) : summary.isError ? (
          <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
        ) : (
          <>
            <section className="card p-4 text-center">
              <p className="text-[12px] text-ink-muted">{t('referral.yourCode')}</p>
              <p className="mt-1 text-[26px] font-black tracking-[3px] text-accent-500">
                {summary.data.code}
              </p>
              <p className="mt-3 text-[12px] text-ink-muted">
                {t('referral.explain', { days: summary.data.program.rewardDays })}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button variant="outline" onClick={() => void copy(summary.data.code)}>
                  {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                  {copied ? t('common.copied') : t('common.copy')}
                </Button>
                <Button onClick={() => void copy(summary.data.link)}>
                  {t('referral.yourLink')}
                </Button>
              </div>
            </section>

            <div className="grid grid-cols-3 gap-2">
              <StatTile label={t('referral.invited')} value={String(summary.data.totalReferrals)} />
              <StatTile
                label={t('referral.qualified')}
                value={String(summary.data.qualifiedReferrals)}
                tone="gold"
              />
              <StatTile
                label={t('referral.rewards')}
                value={String(summary.data.rewards.length)}
                tone="positive"
              />
            </div>

            {summary.data.rewards.length > 0 ? (
              <section className="card overflow-hidden">
                <h2 className="border-b border-line-subtle px-3 py-2.5 text-[13px] font-bold">
                  {t('referral.rewards')}
                </h2>
                <ul className="divide-y divide-line-subtle">
                  {summary.data.rewards.map((reward) => (
                    <li
                      key={reward.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <span className="text-[12.5px]">
                        {reward.days
                          ? `${reward.days} Tage`
                          : (reward.amount?.formatted ?? reward.type)}
                      </span>
                      <span className="text-[11px] text-ink-dim">{reward.status}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
