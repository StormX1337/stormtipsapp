import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LegalArticle } from '@/components/legal-article';

export const metadata: Metadata = { title: 'Haftungsausschluss' };

export default function DisclaimerPage(): ReactNode {
  return <LegalArticle slug="disclaimer" />;
}
