/**
 * @module sidepanel/hooks/useReducedMotion
 * @description Tracks the user's `prefers-reduced-motion` preference live.
 *
 * The side panel's motion primitives (`tailwind.css`) already freeze animation and
 * transition durations to `1ms` under `prefers-reduced-motion: reduce` via CSS
 * alone, but some interactions — like `scrollIntoView({ behavior: 'smooth' })` —
 * take a JS `behavior` option that the CSS `scroll-behavior: auto !important`
 * override cannot suppress. Components performing this kind of imperative motion
 * read this hook to pick `'smooth'` vs `'auto'` themselves. Backed by a `change`
 * listener on the `prefers-reduced-motion` media query, so it re-renders if the OS
 * setting flips while the panel is open.
 */
import { useState, useEffect } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** True when the OS is currently set to reduce motion. */
function prefersReduced(): boolean {
  return typeof window.matchMedia !== 'undefined' && window.matchMedia(QUERY).matches;
}

/**
 * Subscribe to whether the user has requested reduced motion.
 *
 * @returns `true` when `prefers-reduced-motion: reduce` currently matches,
 * `false` otherwise. Updates live if the OS setting changes.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => prefersReduced());

  useEffect(() => {
    if (typeof window.matchMedia === 'undefined') {
      return;
    }
    const mql = window.matchMedia(QUERY);
    const update = () => setReduced(mql.matches);
    // Sync once in case the preference changed between the initial render and mount.
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return reduced;
}
