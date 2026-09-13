'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import clsx from 'clsx';
import type { Paginated, PollDTO } from '@profit-tips/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/navigation';
import { ErrorState, NoResults, OfflineBanner } from '@/components/states';
import { Button, Skeleton } from '@/components/primitives';

function PollCard({ poll }: { poll: PollDTO }): ReactNode {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vote = useMutation({
    mutationFn: (optionId: string) =>
      api<PollDTO>(`/polls/${poll.id}/vote`, { method: 'POST', body: { optionIds: [optionId] } }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['polls'] });
    },
    onError: (caught: Error) => setError(caught.message),
  });

  const closed = poll.status === 'CLOSED';
  const canVote = Boolean(user) && !poll.hasVoted && !closed;

  return (
    <article className="card p-4">
      <h3 className="text-[14px] font-bold">{poll.question}</h3>
      {poll.description ? (
        <p className="mt-1 text-[12px] text-ink-muted">{poll.description}</p>
      ) : null}

      <ul className="mt-3 flex flex-col gap-2">
        {poll.options.map((option) => {
          const active = selected === option.id || option.isMyVote;
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={!canVote}
                onClick={() => setSelected(option.id)}
                aria-pressed={active}
                className={clsx(
                  'relative w-full overflow-hidden rounded-md border px-3 py-2.5 text-left transition-colors',
                  active ? 'border-accent-500' : 'border-line-subtle',
                  canVote ? 'hover:border-line-strong' : 'cursor-default',
                )}
              >
                {poll.showResults ? (
                  <span
                    aria-hidden
                    className={clsx(
                      'absolute inset-y-0 left-0 transition-[width] duration-500',
                      option.isMyVote ? 'bg-accent-500/20' : 'bg-bg-card-alt',
                    )}
                    style={{ width: `${option.percentage}%` }}
                  />
                ) : null}
                <span className="relative flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium">{option.label}</span>
                  {poll.showResults ? (
                    <span className="tabular shrink-0 text-[12px] font-bold text-ink-muted">
                      {option.percentage.toFixed(1)}%
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p role="alert" className="mt-2 text-[12px] text-lost">
          {error}
        </p>
      ) : null}

      <footer className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] text-ink-dim">
          {t('poll.totalVotes', { count: poll.totalVotes })}
          {closed ? ` · ${t('poll.closed')}` : ''}
        </span>
        {!user ? (
          <Link href="/auth/login" className="text-[12px] text-accent-500 hover:underline">
            {t('poll.loginRequired')}
          </Link>
        ) : poll.hasVoted ? (
          <span className="text-[12px] text-accent-500">{t('poll.voted')}</span>
        ) : (
          <Button
            size="sm"
            disabled={!selected || vote.isPending || closed}
            onClick={() => selected && vote.mutate(selected)}
          >
            {t('poll.vote')}
          </Button>
        )}
      </footer>
    </article>
  );
}

export default function PollPage(): ReactNode {
  const { t } = useI18n();
  const polls = useQuery({
    queryKey: ['polls'],
    queryFn: () => api<Paginated<PollDTO>>('/polls?limit=20', { auth: true }),
  });

  return (
    <AppShell
      title={t('poll.title')}
      left={
        <Link
          href="/statistics"
          aria-label={t('stats.title')}
          className="grid h-9 w-9 place-items-center rounded-md text-ink-muted hover:bg-bg-card hover:text-ink"
        >
          <BarChart3 size={20} aria-hidden />
        </Link>
      }
    >
      <div id="main" className="flex flex-col gap-3 py-4">
        <OfflineBanner />
        {polls.isPending ? (
          Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-44 w-full" />)
        ) : polls.isError ? (
          <ErrorState error={polls.error} onRetry={() => void polls.refetch()} />
        ) : polls.data.items.length === 0 ? (
          <NoResults title={t('poll.empty')} body="" />
        ) : (
          polls.data.items.map((poll) => <PollCard key={poll.id} poll={poll} />)
        )}
      </div>
    </AppShell>
  );
}
