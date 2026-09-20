'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Search, Star } from 'lucide-react';
import type { LeagueDTO, UserDTO } from '@storm-tips/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { AppShell } from '@/components/navigation';
import { ErrorState } from '@/components/states';
import { CountryFlag, Skeleton } from '@/components/primitives';

/**
 * The leagues a reader wants to hear about.
 *
 * Marking one never removes anything from the feed — everything published is
 * still there. It only narrows what is worth interrupting them for, and only
 * once they have also asked for that in the notification settings.
 */
export default function FavouritesPage(): ReactNode {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login?next=/account/favourites');
  }, [loading, user, router]);

  const profile = useQuery({ queryKey: ['me'], queryFn: () => api<UserDTO>('/me') });
  const leagues = useQuery({
    queryKey: ['leagues'],
    queryFn: () => api<{ items: LeagueDTO[] }>('/leagues', { auth: false }),
    staleTime: 10 * 60_000,
  });

  const update = useMutation({
    mutationFn: (favoriteLeagueIds: string[]) =>
      api<UserDTO>('/me', { method: 'PATCH', body: { favoriteLeagueIds } }),
    onSuccess: (updated) => queryClient.setQueryData(['me'], updated),
  });

  const favouriteIds = profile.data?.favoriteLeagueIds ?? [];
  const selected = useMemo(() => new Set(favouriteIds), [favouriteIds]);

  const visible = useMemo(() => {
    const items = leagues.data?.items ?? [];
    const term = search.trim().toLowerCase();
    const matches = term
      ? items.filter(
          (league) =>
            league.name.toLowerCase().includes(term) ||
            (league.country?.name ?? '').toLowerCase().includes(term),
        )
      : items;
    // Marked leagues first: the list is long, and the answer to "what did I
    // choose?" should not need scrolling.
    return [...matches].sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)));
  }, [leagues.data, search, selected]);

  function toggle(id: string): void {
    const next = selected.has(id)
      ? [...selected].filter((value) => value !== id)
      : [...selected, id];
    update.mutate(next);
  }

  return (
    <AppShell measure="narrow" title={t('favourites.title')}>
      <div id="main" className="flex flex-col gap-3 py-4">
        <p className="text-[12.5px] leading-relaxed text-ink-muted">{t('favourites.intro')}</p>

        <label className="relative block">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-dim"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('favourites.search')}
            aria-label={t('favourites.search')}
            className="field-input w-full rounded-md border border-line bg-bg-input py-2.5 pr-3 pl-9 text-[13px] outline-none focus:border-accent-500"
          />
        </label>

        {profile.isPending || leagues.isPending ? (
          <Skeleton className="h-80 w-full" />
        ) : leagues.isError ? (
          <ErrorState error={leagues.error} onRetry={() => void leagues.refetch()} />
        ) : visible.length === 0 ? (
          <p className="card px-4 py-8 text-center text-[13px] text-ink-muted">
            {t('favourites.empty')}
          </p>
        ) : (
          <section className="card divide-y divide-line-subtle overflow-hidden">
            {visible.map((league) => {
              const on = selected.has(league.id);
              return (
                <button
                  key={league.id}
                  type="button"
                  onClick={() => toggle(league.id)}
                  aria-pressed={on}
                  disabled={update.isPending}
                  className="flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-bg-card-alt"
                >
                  <CountryFlag emoji={league.country?.flagEmoji} code={league.country?.code} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">
                    {league.country?.name ? (
                      <span className="text-ink-muted">{league.country.name} · </span>
                    ) : null}
                    {league.name}
                  </span>
                  <Star
                    size={17}
                    aria-hidden
                    className={clsx(
                      'shrink-0 transition-colors',
                      on ? 'fill-gold-400 text-gold-400' : 'text-ink-dim',
                    )}
                  />
                </button>
              );
            })}
          </section>
        )}
      </div>
    </AppShell>
  );
}
