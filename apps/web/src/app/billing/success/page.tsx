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
      <h1 className="text-[22px] font-extrabold">Vielen Dank!</h1>
      <p className="text-[13.5px] text-ink-muted">
        Dein Kauf wird bestätigt. Sobald die Zahlung vom Anbieter verifiziert ist, werden deine
        Premium-Inhalte automatisch freigeschaltet — das dauert in der Regel nur wenige Sekunden.
      </p>
      <Link href="/combo" className="w-full">
        <Button size="lg">Zu den Analysen</Button>
      </Link>
      <Link href="/account/subscription" className="text-[12px] text-ink-muted hover:text-ink">
        Mein Abo ansehen
      </Link>
    </main>
  );
}
