'use client';

import clsx from 'clsx';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { PromotionDTO } from '@storm-tips/types';
import { PromoBadge, contrastOn } from './primitives';

function targetHref(promotion: PromotionDTO): string {
  if (promotion.ctaUrl) return promotion.ctaUrl;
  if (promotion.deepLink?.startsWith('stormtips://paywall/')) {
    const product = promotion.deepLink.split('/').pop()?.toLowerCase() ?? 'combo';
    return `/paywall/${product === 'bundle' ? 'combo' : product}`;
  }
  if (promotion.product) return `/paywall/${promotion.product.toLowerCase().replace('_', '-')}`;
  return '/combo';
}

/**
 * Promotional banner. Every word, colour and destination is set in the admin.
 *
 * The type is sized for a phone and steps up from `md`, where the same banner
 * runs the full width of a desktop column and 10px copy in it looks like a
 * mistake rather than a deliberately quiet subtitle.
 */
export function PromoBanner({ promotion }: { promotion: PromotionDTO }): ReactNode {
  const gradient =
    promotion.gradientFrom && promotion.gradientTo
      ? `linear-gradient(135deg, ${promotion.gradientFrom} 0%, ${promotion.gradientTo} 100%)`
      : undefined;

  /*
   * The banner's colours are the operator's, its text was not.
   *
   * Light green on white-ish and white on gold are both unreadable, and an
   * operator picking a bright gradient in the admin has no way to know that.
   * The copy takes its colour from the background it is actually sitting on —
   * the gradient's start, since the text is on the left of a 135° sweep.
   */
  const onLight = promotion.gradientFrom ? contrastOn(promotion.gradientFrom) !== '#FFFFFF' : false;

  return (
    <Link
      href={targetHref(promotion)}
      className="neon-frame relative block overflow-hidden"
      style={
        {
          ...(gradient ? { background: gradient } : {}),
          ...(onLight ? { '--promo-line': 'rgb(0 0 0 / 0.22)' } : {}),
        } as CSSProperties
      }
    >
      {/* Decorative ball, drawn rather than imported so no asset is bundled. */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute -right-4 bottom-[-10px] h-20 w-20 opacity-90 md:right-2 md:bottom-[-6px] md:h-28 md:w-28"
      >
        {/* The ball follows the banner too: a green-on-black marble sitting on
            a gold banner looks like a sticker from another product. */}
        <circle
          cx="50"
          cy="50"
          r="34"
          fill={onLight ? 'rgb(0 0 0 / 0.10)' : '#0C101A'}
          stroke={onLight ? 'rgb(0 0 0 / 0.30)' : '#12E17F'}
          strokeWidth="2.5"
        />
        <path
          d="M50 28l10 7-4 12H44l-4-12z M50 72l-10-7 4-12h12l4 12z M28 50l7-10 12 4v12l-12 4z M72 50l-7 10-12-4V44l12-4z"
          fill={onLight ? 'rgb(0 0 0 / 0.30)' : '#12E17F'}
          opacity="0.85"
        />
      </svg>

      <div className="relative z-[1] py-4 pr-20 pl-4 md:py-6 md:pr-36 md:pl-6">
        {/* In the flow, not over it: pinned to the corner the badge covered
            the first line of the title at phone width. */}
        {promotion.badge !== 'NONE' ? (
          <span className="mb-2 inline-block">
            <PromoBadge badge={promotion.badge} />
          </span>
        ) : null}
        <p
          className={clsx(
            'text-[14px] leading-tight font-extrabold md:text-[19px]',
            onLight ? 'text-ink-inverse' : 'text-accent-300',
          )}
        >
          {promotion.title}
        </p>
        {promotion.subtitle ? (
          <p
            className={clsx(
              'mt-1 line-clamp-3 max-w-[30ch] text-[10.5px] leading-[1.35] md:mt-2 md:max-w-[52ch] md:text-[13px] md:leading-[1.45]',
              onLight ? 'text-black/75' : 'text-white/85',
            )}
          >
            {promotion.subtitle}
          </p>
        ) : null}
        {promotion.ctaLabel ? (
          <span
            className={clsx(
              'mt-2.5 inline-block rounded-sm px-2.5 py-1 text-[10.5px] font-bold md:mt-4 md:px-4 md:py-1.5 md:text-[13px]',
              onLight ? 'bg-ink-inverse text-ink' : 'bg-accent-500 text-ink-inverse',
            )}
          >
            {promotion.ctaLabel}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
