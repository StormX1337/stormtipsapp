'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { PromotionDTO } from '@storm-tips/types';
import { PromoBadge } from './primitives';

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

  return (
    <Link
      href={targetHref(promotion)}
      className="neon-frame relative block overflow-hidden"
      style={gradient ? { background: gradient } : undefined}
    >
      {promotion.badge !== 'NONE' ? (
        <span className="absolute top-2 left-3 z-10">
          <PromoBadge badge={promotion.badge} />
        </span>
      ) : null}

      {/* Decorative ball, drawn rather than imported so no asset is bundled. */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute -right-4 bottom-[-10px] h-20 w-20 opacity-90 md:right-2 md:bottom-[-6px] md:h-28 md:w-28"
      >
        <circle cx="50" cy="50" r="34" fill="#0E1117" stroke="#12E17F" strokeWidth="2.5" />
        <path
          d="M50 28l10 7-4 12H44l-4-12z M50 72l-10-7 4-12h12l4 12z M28 50l7-10 12 4v12l-12 4z M72 50l-7 10-12-4V44l12-4z"
          fill="#12E17F"
          opacity="0.85"
        />
      </svg>

      <div className="relative z-[1] py-4 pr-20 pl-4 md:py-6 md:pr-36 md:pl-6">
        <p className="text-[14px] leading-tight font-extrabold text-accent-300 md:text-[19px]">
          {promotion.title}
        </p>
        {promotion.subtitle ? (
          <p className="mt-1 line-clamp-3 max-w-[30ch] text-[10.5px] leading-[1.35] text-white/85 md:mt-2 md:max-w-[52ch] md:text-[13px] md:leading-[1.45]">
            {promotion.subtitle}
          </p>
        ) : null}
        {promotion.ctaLabel ? (
          <span className="mt-2.5 inline-block rounded-sm bg-accent-500 px-2.5 py-1 text-[10.5px] font-bold text-ink-inverse md:mt-4 md:px-4 md:py-1.5 md:text-[13px]">
            {promotion.ctaLabel}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
