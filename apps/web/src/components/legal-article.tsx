'use client';

import type { ReactNode } from 'react';
import { LEGAL_FOOTNOTE, getLegalDocument, type LegalSlug } from '@profit-tips/ui';
import { useI18n } from '@/lib/i18n';

/**
 * Renders a legal or support document from the shared content module, so the
 * website and the native app always show identical wording.
 */
export function LegalArticle({ slug }: { slug: LegalSlug }): ReactNode {
  const { locale } = useI18n();
  const document = getLegalDocument(locale, slug);

  return (
    <article>
      <h1 className="text-[22px] font-extrabold">{document.title}</h1>
      {document.intro ? <p>{document.intro}</p> : null}

      {document.blocks.map((block, index) => {
        if (block.type === 'h2') return <h2 key={index}>{block.text}</h2>;
        if (block.type === 'h3') return <h3 key={index}>{block.text}</h3>;
        if (block.type === 'ul') {
          return (
            <ul key={index}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}

      <p className="mt-10 border-t border-line-subtle pt-6 text-[11px] text-ink-dim">
        {LEGAL_FOOTNOTE[locale]}
      </p>
    </article>
  );
}
