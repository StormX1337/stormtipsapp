'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * True for a moment after `value` changes, so the change can be shown.
 *
 * The feed re-fetches every 30 seconds while a match is on, and a score going
 * from 0 to 1 simply became a different number on the screen — the one thing a
 * reader is there for, and the easiest to miss. This marks the moment so the
 * new value can announce itself.
 *
 * Deliberately silent on the first render: everything is "new" when a page
 * loads, and flashing all of it says nothing.
 */
export function useChanged<T>(value: T, durationMs = 1400): boolean {
  const previous = useRef<T>(value);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    setChanged(true);
    const timer = setTimeout(() => setChanged(false), durationMs);
    return () => clearTimeout(timer);
  }, [value, durationMs]);

  return changed;
}
