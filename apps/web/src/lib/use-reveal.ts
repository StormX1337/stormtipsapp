'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `false` on the first paint and `true` immediately after.
 *
 * A bar rendered straight at its final width has nothing to transition from, so
 * the `transition` on it never runs: the result simply appears. Starting at
 * zero and growing on the next frame is what makes a tally read as a tally.
 */
export function useReveal(): boolean {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return revealed;
}

/**
 * Counts from zero to `value` over `durationMs`.
 *
 * Reserved for the few figures a reader is meant to weigh — the paywall's
 * record. A number that counts up everywhere is a number nobody reads.
 *
 * Falls straight to the value when the reader has asked for less motion: the
 * global CSS guard cannot reach a number driven from JavaScript.
 */
export function useCountUp(value: number, durationMs = 900): number {
  const [current, setCurrent] = useState(value);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setCurrent(value);
      return;
    }

    let frame = 0;
    const started = performance.now();
    const step = (now: number): void => {
      const progress = Math.min((now - started) / durationMs, 1);
      // Ease out, so it arrives rather than stopping dead.
      setCurrent(value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return current;
}
