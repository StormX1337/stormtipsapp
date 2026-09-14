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
 * Promotional banner.
 *
 * Recreates the reference banner: a gradient card with a neon inner frame and a
 * decorative ball glyph. Content is fully admin-configurable.
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
        className="absolute -right-4 bottom-[-10px] h-20 w-20 opacity-90"
      >
        <circle cx="50" cy="50" r="34" fill="#0E1117" stroke="#12E17F" strokeWidth="2.5" />
        <path
          d="M50 28l10 7-4 12H44l-4-12z M50 72l-10-7 4-12h12l4 12z M28 50l7-10 12 4v12l-12 4z M72 50l-7 10-12-4V44l12-4z"
          fill="#12E17F"
          opacity="0.85"
        />
      </svg>

      <div className="relative z-[1] py-4 pr-20 pl-4">
        <p className="text-[14px] leading-tight font-extrabold text-accent-300">
          {promotion.title}
        </p>
        {promotion.subtitle ? (
          <p className="mt-1 line-clamp-3 max-w-[30ch] text-[10.5px] leading-[1.35] text-white/85">
            {promotion.subtitle}
          </p>
        ) : null}
        {promotion.ctaLabel ? (
          <span className="mt-2.5 inline-block rounded-sm bg-accent-500 px-2.5 py-1 text-[10.5px] font-bold text-ink-inverse">
            {promotion.ctaLabel}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
