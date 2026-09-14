import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LegalArticle } from '@/components/legal-article';

export const metadata: Metadata = { title: 'Help & support' };

export default function HelpPage(): ReactNode {
  return <LegalArticle slug="help" />;
}
