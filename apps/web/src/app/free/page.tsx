'use client';

import type { ReactNode } from 'react';
import { ProductFeed } from '@/components/product-feed';
import { useT } from '@/lib/i18n';

export default function FreePage(): ReactNode {
  const t = useT();
  return <ProductFeed product="FREE" title={t('nav.free')} />;
}
