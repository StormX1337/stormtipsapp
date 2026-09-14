import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LegalArticle } from '@/components/legal-article';

export const metadata: Metadata = { title: 'Responsible gambling' };

export default function ResponsibleGamblingPage(): ReactNode {
  return <LegalArticle slug="responsible-gambling" />;
}
