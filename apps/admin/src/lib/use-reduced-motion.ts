'use client';

import { useEffect, useState } from 'react';

/**
 * Whether the reader has asked the system for less movement.
 *
 * The console's CSS guard flattens transitions and keyframes, but Recharts
 * animates from JavaScript and never sees it.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent): void => setReduced(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  return reduced;
}
