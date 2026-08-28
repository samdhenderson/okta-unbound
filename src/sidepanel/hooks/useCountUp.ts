/**
 * @module sidepanel/hooks/useCountUp
 * @description Interpolates a metric towards its new value over `--dur-tell`, so a
 * stat card *counts to* its number instead of snapping to it — and flags the brief
 * window right after, so the card can tint the settled figure (ADR-0046).
 *
 * A number that appears fully formed reads as "this was always here"; a number that
 * counts up reads as "this just resolved". That is the only reason this exists —
 * motion explaining causality, not decoration. It is therefore deliberately narrow:
 * it animates when the target actually changes (mount, first resolve, an explicit
 * refresh) and does nothing at all on an incidental re-render, which is what would
 * otherwise turn the Overview into a slot machine.
 *
 * When it does not animate it is **instant in the same render**, not one commit
 * later — the new figure is derived during render rather than in an effect, so a
 * synchronous assertion straight after the data lands reads the final number.
 */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * Count-up duration, mirroring `--dur-tell` in `tailwind.css` (500ms). Hardcoded
 * for the same reason `Modal`'s `EXIT_MS` mirrors `--dur-quick`: the token cannot be
 * read back at runtime in every environment this code runs in — jsdom parses no
 * stylesheet, so `getComputedStyle().getPropertyValue('--dur-tell')` returns `''`.
 * Keep the two in step by hand; the scale changes about once a year.
 */
const COUNT_UP_MS = 500;

/**
 * Whether a count-up should actually animate in the current environment.
 *
 * Three ways to answer no, all of which must produce an instant, exact number:
 *
 * - **No motion scale loaded.** `--dur-tell` is absent, which in practice means a
 *   jsdom unit test. Nothing else on screen is animating either, so neither is this.
 * - **`[data-motion='off']`** — the explicit opt-out `tailwind.css` honours and the
 *   Storybook `withMotion` decorator sets, which keeps the browser story suite
 *   deterministic.
 * - **`prefers-reduced-motion`**, handled by the caller via {@link useReducedMotion}.
 */
function motionAvailable(): boolean {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return false;
  if (document.querySelector('[data-motion="off"]')) return false;
  return getComputedStyle(document.documentElement).getPropertyValue('--dur-tell').trim() !== '';
}

/** Ease-out curve — the JS analogue of `--ease-standard`: fast start, gentle settle. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Options for {@link useCountUp}. */
export interface UseCountUpOptions {
  /**
   * Set `false` to bypass the animation entirely and mirror `target` exactly — for
   * a metric that is not a resolved number yet (a placeholder em dash, a status
   * string), or a surface that should never animate. Defaults to `true`.
   */
  enabled?: boolean;
}

/** What {@link useCountUp} returns each render. */
export interface UseCountUpResult {
  /** The value to display this frame. */
  value: number;
  /**
   * True for `--dur-tell` immediately after `target` changes to a new value —
   * never on the initial mount, since nothing "just resolved" against a number
   * that has not been shown before. A card renders this as a brief
   * `text-success-text` tint that eases back to its resting colour over the same
   * `--dur-tell` (`transition-colors duration-(--dur-tell)`), so a metric that
   * silently swapped instead visibly tells you it changed. Mirrors `enabled`,
   * not `target`'s own animation: a card that opted out of counting the digits
   * (`enabled: false`) opts out of this tint too, since both answer the same
   * question — "should this card narrate its own changes?"
   */
  justResolved: boolean;
}

/**
 * Count a metric up to `target` over `--dur-tell` on an ease-out curve, and flag
 * the brief window right after it lands.
 *
 * `value` is always an integer and always lands exactly on `target`. A new
 * animation starts only when `target` changes, so a component that re-renders for
 * unrelated reasons (a progress tick, a parent state change) shows a perfectly
 * still number.
 *
 * Render `value` with `tabular-nums` — proportional digits change width as they
 * count, which makes the card twitch.
 *
 * @param target - The value to count towards. Intermediate frames are rounded; the
 * final frame is the exact `target`.
 * @param options - See {@link UseCountUpOptions}.
 * @returns See {@link UseCountUpResult}.
 *
 * @example
 * ```tsx
 * const { value, justResolved } = useCountUp(members.length);
 * return (
 *   <p className={`tabular-nums transition-colors duration-(--dur-tell) ${justResolved ? 'text-success-text' : ''}`}>
 *     {value.toLocaleString()}
 *   </p>
 * );
 * ```
 */
export function useCountUp(target: number, options: UseCountUpOptions = {}): UseCountUpResult {
  const { enabled = true } = options;
  const reduced = useReducedMotion();
  const animates = enabled && !reduced && motionAvailable();

  // Start at zero only when there is genuinely going to be an animation; otherwise
  // the first painted frame is already the real number.
  const [display, setDisplay] = useState(() => (animates ? 0 : target));
  const [seenTarget, setSeenTarget] = useState(target);
  const [justResolved, setJustResolved] = useState(false);

  // Mirrors `display` so the animation effect can read where the count is *now*
  // without depending on it — a `display` dependency would restart it every frame.
  // Written only from effects and animation frames, never during render (a render
  // can be discarded, a ref write cannot be taken back).
  const displayRef = useRef(display);

  // Adjust state during render rather than in an effect (the documented React
  // pattern, used elsewhere in this repo by MemberExplorer's reset key). An effect
  // would land the new figure one commit late, which is invisible to a user but
  // very visible to a test asserting synchronously after the data arrives.
  if (target !== seenTarget) {
    setSeenTarget(target);
    if (!animates) setDisplay(target);
    // Only a real change tells; the first render (where `seenTarget` already
    // equals `target`, so this branch never runs) has nothing to compare against.
    if (enabled) setJustResolved(true);
  }

  // Declared before the animation effect so that effect always sees the value that
  // is actually on screen this commit.
  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    const from = displayRef.current;
    if (!animates || from === target) {
      // The render-phase adjustment above already handles a target change while
      // motion is off; this only catches motion being switched off mid-flight.
      if (from !== target) {
        displayRef.current = target;
        setDisplay(target);
      }
      return;
    }

    const start = performance.now();
    const distance = target - from;
    let frame = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_UP_MS);
      const next = progress >= 1 ? target : Math.round(from + distance * easeOut(progress));
      displayRef.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, animates]);

  // Clears the tint `COUNT_UP_MS` after it was set, independent of whether the
  // digits themselves animated — an instant swap still gets the same window to
  // tell the user it changed. A fresh `target` change while the window is still
  // open keeps the existing timer rather than restarting it; both end at
  // "roughly `--dur-tell` after the most recent change", which is the effect this
  // is standing in for.
  useEffect(() => {
    if (!justResolved) return undefined;
    const timer = setTimeout(() => setJustResolved(false), COUNT_UP_MS);
    return () => clearTimeout(timer);
  }, [justResolved]);

  return { value: display, justResolved };
}
