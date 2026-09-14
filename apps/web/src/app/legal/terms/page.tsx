import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LegalArticle } from '@/components/legal-article';

export const metadata: Metadata = { title: 'Terms & Conditions' };

export default function TermsPage(): ReactNode {
  return <LegalArticle slug="terms" />;
}
