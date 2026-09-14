import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/primitives';

export default function CheckoutCancelledPage(): ReactNode {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-[22px] font-extrabold">Checkout cancelled</h1>
      <p className="text-[13.5px] text-ink-muted">
        Nothing was charged. You can start the purchase again whenever you like.
      </p>
      <Link href="/combo" className="w-full">
        <Button size="lg" variant="outline">
          Back to the plans
        </Button>
      </Link>
    </main>
  );
}
