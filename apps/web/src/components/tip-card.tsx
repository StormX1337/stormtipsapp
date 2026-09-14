'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TipDTO, TipFeedGroupDTO } from '@storm-tips/types';
import { formatKickoff } from '@storm-tips/ui';
import { useI18n } from '@/lib/i18n';
import { CountryFlag, OddsBadge, ProductBadge, StatusBadge, TeamCrest } from './primitives';

/**
 * League header.
 *
 * Mirrors the reference layout: country flag, "Country : League", and the
 * bookmaker wordmark right-aligned in its brand colour.
 */
export function LeagueHeader({ group }: { group: TipFeedGroupDTO }): ReactNode {
  const { league, bookmaker } = group;
  return (
    <div className="flex items-center gap-2 px-1 pt-4 pb-2">
      <CountryFlag emoji={league.country?.flagEmoji} code={league.country?.code} />
      <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
        {league.country?.name ? `${league.country.name} : ` : ''}
        {league.name}
      </h2>
      {bookmaker ? (
        <span
          className="shrink-0 text-[12px] font-black tracking-tight italic"
          style={{ color: bookmaker.color ?? '#9BA5B7' }}
        >
          {bookmaker.name}
        </span>
      ) : null}
    </div>
  );
}

function TeamRow({
  name,
  logoUrl,
  color,
  score,
  emphasised,
}: {
  name: string;
  logoUrl?: string | null;
  color?: string | null;
  score?: number | null;
  emphasised?: boolean;
}): ReactNode {
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <TeamCrest name={name} logoUrl={logoUrl} color={color} />
      <span
        className={clsx(
          'min-w-0 flex-1 truncate text-[13px]',
          emphasised ? 'font-semibold text-ink' : 'text-ink',
        )}
      >
        {name}
      </span>
      {score !== null && score !== undefined ? (
        <span className="tabular shrink-0 text-[13px] font-bold text-ink">{score}</span>
      ) : null}
    </div>
  );
}

export function TipCard({ tip, href }: { tip: TipDTO; href?: string }): ReactNode {
  const { t, locale } = useI18n();
  const { event } = tip;
  const settled = tip.settledAt !== null;
  // A settled tip keeps its kick-off time even if the fixture feed still
  // reports the match as in play.
  const isLive = !settled && (event.status === 'LIVE' || event.status === 'HALFTIME');
  const showScore = isLive || event.status === 'FINISHED' || settled;

  const body = (
    <article
      className={clsx(
        'card relative flex gap-3 p-3 transition-colors duration-150',
        href && 'hover:border-line-strong',
        tip.isLocked && 'overflow-hidden',
      )}
    >
      {/* Left rail: date over kick-off time, exactly as in the reference feed. */}
      <div className="w-9 shrink-0 pt-0.5 text-left">
        <div className="text-[10px] leading-[1.15] font-medium text-ink-dim">
          {new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', { month: 'short' }).format(
            new Date(event.startsAt),
          )}
        </div>
        <div className="text-[10px] leading-[1.15] font-medium text-ink-dim">
          {new Date(event.startsAt).getDate()}
        </div>
        <div className="mt-2 text-[11px] font-semibold text-ink-muted">
          {isLive ? (
            <span className="live-dot text-live">{event.minute ? `${event.minute}'` : 'LIVE'}</span>
          ) : (
            formatKickoff(event.startsAt, undefined, locale)
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <TeamRow
          name={event.homeTeam.shortName ?? event.homeTeam.name}
          logoUrl={event.homeTeam.logoUrl}
          color={event.homeTeam.colorPrimary}
          score={showScore ? event.homeScore : null}
        />
        <TeamRow
          name={event.awayTeam.shortName ?? event.awayTeam.name}
          logoUrl={event.awayTeam.logoUrl}
          color={event.awayTeam.colorPrimary}
          score={showScore ? event.awayScore : null}
        />

        <div className="mt-1.5 flex items-baseline gap-2.5">
          <OddsBadge odds={tip.odds} locked={tip.isLocked} changed={tip.oddsChanged} />
          {tip.isLocked ? (
            <span className="flex items-center gap-1.5 text-[11.5px] font-bold tracking-wide text-ink-dim uppercase">
              <Lock size={11} aria-hidden />
              {t('feed.lockedTitle')}
            </span>
          ) : (
            <span className="min-w-0 flex-1 text-[12px] leading-[1.25] font-bold tracking-[0.2px] text-accent-500 uppercase">
              {tip.selectionLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusBadge outcome={tip.outcome} />
        <ProductBadge product={tip.product} />
      </div>
    </article>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block focus-visible:outline-offset-4">
      {body}
    </Link>
  );
}

/** A whole league block: header plus its stacked tip cards. */
export function TipGroup({ group }: { group: TipFeedGroupDTO }): ReactNode {
  return (
    <section>
      <LeagueHeader group={group} />
      <div className="flex flex-col gap-2">
        {group.tips.map((tip) => (
          <TipCard key={tip.id} tip={tip} href={`/tips/${tip.id}`} />
        ))}
      </div>
    </section>
  );
}

export function TipCardSkeleton(): ReactNode {
  return (
    <div className="card flex gap-3 p-3">
      <div className="w-9 shrink-0 space-y-1">
        <div className="skeleton h-2 w-6" />
        <div className="skeleton h-2 w-4" />
        <div className="skeleton mt-2 h-3 w-8" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton h-4 w-3/4" />
      </div>
      <div className="skeleton h-5 w-5 rounded-sm" />
    </div>
  );
}
