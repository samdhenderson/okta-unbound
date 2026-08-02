/**
 * @module sidepanel/hooks/useDebouncedValue
 * @description Generic value debouncer for search boxes and other rapid inputs.
 *
 * Returns the trailing value once it has been stable for `delayMs`: every change
 * restarts the window, and the initial value is returned immediately. Shared by
 * the live group search, the Add-to-Group type-ahead, and the member explorer's
 * filter query.
 */

import { useEffect, useState } from 'react';

/**
 * Debounce a changing value.
 *
 * @param value - The rapidly changing source value (e.g. a search input).
 * @param delayMs - How long the value must be stable before it is emitted.
 * @returns The debounced value: the initial value immediately, then the latest
 *   value once `delayMs` has elapsed without further changes.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
