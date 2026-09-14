import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LegalArticle } from '@/components/legal-article';

export const metadata: Metadata = { title: 'Datenschutzerklärung' };

export default function PrivacyPage(): ReactNode {
  return <LegalArticle slug="privacy" />;
}
