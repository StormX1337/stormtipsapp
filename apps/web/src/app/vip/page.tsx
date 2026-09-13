'use client';

import type { ReactNode } from 'react';
import { ProductFeed } from '@/components/product-feed';
import { useT } from '@/lib/i18n';

export default function VipPage(): ReactNode {
  const t = useT();
  return <ProductFeed product="VIP" title={t('nav.vip')} />;
}
