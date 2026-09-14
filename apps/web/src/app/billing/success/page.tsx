'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/primitives';

export default function CheckoutSuccessPage(): ReactNode {
  const { refresh } = useAuth();

  // Entitlements are granted by the webhook, so re-read the profile on return.
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 2000);
    const stop = setTimeout(() => clearInterval(timer), 12_000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [refresh]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <CheckCircle2 size={48} className="text-accent-500" aria-hidden />
      <h1 className="text-[22px] font-extrabold">Thank you!</h1>
      <p className="text-[13.5px] text-ink-muted">
        We are confirming your purchase. As soon as the provider verifies the payment your premium
        content unlocks automatically — usually within a few seconds.
      </p>
      <Link href="/combo" className="w-full">
        <Button size="lg">Go to the analyses</Button>
      </Link>
      <Link href="/account/subscription" className="text-[12px] text-ink-muted hover:text-ink">
        View my subscription
      </Link>
    </main>
  );
}
