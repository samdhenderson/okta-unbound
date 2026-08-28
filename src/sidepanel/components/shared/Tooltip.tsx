/**
 * @module sidepanel/components/shared/Tooltip
 * @description Hover- and focus-triggered label chip for a control whose own
 * rendering does not name it.
 *
 * Replaces the native `title` attribute, which cannot be styled, fires on an
 * uncontrollable ~1s delay, and never appears for a keyboard user at all. This one
 * opens on hover **and** on focus after `--dur-hover-intent`, carries
 * `role="tooltip"` wired to its trigger with `aria-describedby`, and closes on
 * Escape, on blur, on pointer-leave, and on any scroll that would move the trigger
 * out from under it.
 *
 * A tooltip is **additive**: it describes, it does not name. A control with no
 * visible text still needs its own `aria-label` — the chip is a second, richer
 * affordance for sighted pointer and keyboard users, not the accessible name.
 *
 * ## Why a render prop and not a wrapper element
 *
 * The first consumer is the icon rail, whose buttons are `role="tab"` inside a
 * `role="tablist"`. A positioning `<span>` between the two breaks the tablist's
 * ownership of its tabs and fails axe's `aria-required-children`. So `Tooltip`
 * renders **no wrapper at all**: it hands a bag of props to the trigger the caller
 * renders, and puts the chip in a portal on `document.body`. That also keeps the
 * chip out of any ancestor's `overflow: hidden` — the rail is a scroll container.
 */
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * Hover-intent threshold in milliseconds, mirroring `--dur-hover-intent` in
 * `tailwind.css` (400ms). Hardcoded for the same reason `useCountUp`'s
 * `COUNT_UP_MS` mirrors `--dur-tell`: this is a `setTimeout`, not a transition, and
 * the token cannot be read back at runtime in every environment this code runs in —
 * jsdom parses no stylesheet, so `getComputedStyle().getPropertyValue()` returns
 * `''`. Keep the two in step by hand.
 */
const HOVER_INTENT_MS = 400;

/**
 * Minimum gap between the chip and the viewport edge, in pixels. A tooltip is
 * centred under its trigger, and the rail's first and last tabs sit within half a
 * chip of the panel edge at 360px — without this clamp the chip would hang off it.
 */
const EDGE_GUTTER = 4;

/**
 * The props {@link Tooltip} hands to the trigger. Spread them onto the element the
 * tooltip describes; they are all additive and none of them are `ref`s, so the
 * caller keeps full control of its own element.
 */
export interface TooltipTriggerProps {
  /** Points at the chip while it is open, and is absent while it is closed. */
  'aria-describedby': string | undefined;
  /** Starts the hover-intent timer. */
  onPointerEnter: React.PointerEventHandler<HTMLElement>;
  /** Cancels a pending open and closes an open chip. */
  onPointerLeave: React.PointerEventHandler<HTMLElement>;
  /** Starts the hover-intent timer for keyboard users. */
  onFocus: React.FocusEventHandler<HTMLElement>;
  /** Cancels a pending open and closes an open chip. */
  onBlur: React.FocusEventHandler<HTMLElement>;
}

/** Props for {@link Tooltip}. */
interface TooltipProps {
  /**
   * The chip's text. Keep it to a few words — a tooltip names a thing, it does not
   * explain it, and the chip never wraps.
   */
  label: string;
  /**
   * Set `true` to suppress the chip entirely while still rendering the trigger, for
   * a control that is temporarily meaningless to describe. The trigger props are
   * still supplied (as inert handlers) so the caller's markup does not change shape.
   */
  disabled?: boolean;
  /**
   * Renders the trigger. Spread the supplied {@link TooltipTriggerProps} onto the
   * element the tooltip describes.
   */
  children: (trigger: TooltipTriggerProps) => React.ReactNode;
}

/** Where the chip is currently parked, in viewport coordinates. */
interface ChipAnchor {
  /** Horizontal centre of the trigger; clamped to the viewport once measured. */
  centre: number;
  /** Bottom edge of the trigger; the chip's own margin adds the gap. */
  bottom: number;
}

/**
 * Describe a control with a small dark chip on hover and on focus.
 *
 * @param props - See {@link TooltipProps}.
 * @returns The caller's trigger, plus the chip portalled to `document.body` while
 * it is open.
 *
 * @example
 * ```tsx
 * <Tooltip label="Groups">
 *   {(trigger) => (
 *     <button type="button" aria-label="Groups" {...trigger}>
 *       <Icon type="users" />
 *     </button>
 *   )}
 * </Tooltip>
 * ```
 */
const Tooltip: React.FC<TooltipProps> = ({ label, disabled = false, children }) => {
  const id = useId();
  const reducedMotion = useReducedMotion();
  const [anchor, setAnchor] = useState<ChipAnchor | null>(null);
  const [pending, setPending] = useState<HTMLElement | null>(null);
  const chipRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setPending(null);
    setAnchor(null);
  }, []);

  const open = useCallback(
    (event: React.SyntheticEvent<HTMLElement>) => {
      if (!disabled) setPending(event.currentTarget);
    },
    [disabled],
  );

  // The hover-intent threshold, as state plus an effect rather than a `setTimeout`
  // held in a ref. Two reasons, and only one of them is the lint rule that forbids
  // handing ref-reading callbacks to a render prop: the effect's own cleanup already
  // cancels a pending open when the pointer moves on, when the tooltip closes, and
  // when the trigger unmounts mid-hover — three cases a hand-managed timer has to
  // remember separately, and the third of which is the one that leaks.
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => {
      // Measured when the timer fires rather than when it is set: the rail scrolls
      // the active tab into view, so the trigger can still be moving at t=0.
      const rect = pending.getBoundingClientRect();
      setAnchor({ centre: rect.left + rect.width / 2, bottom: rect.bottom });
    }, HOVER_INTENT_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  // Escape dismisses, and any scroll or resize that could move the trigger closes
  // rather than re-following it — a chip that chases a scrolling strip reads as a
  // bug, and a stale one is worse. `capture: true` is what catches the rail's own
  // horizontal scroll, which does not bubble.
  useEffect(() => {
    if (!anchor) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Deliberately not `preventDefault`/`stopPropagation`: the tooltip traps
      // nothing, so an Escape that also closes an enclosing surface is correct.
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [anchor, close]);

  // Keep the chip inside the viewport. Runs after the chip has laid out because its
  // width is intrinsic to the label — there is nothing to clamp against until then.
  useLayoutEffect(() => {
    const chip = chipRef.current;
    if (!chip || !anchor) return;
    const half = chip.offsetWidth / 2;
    const min = EDGE_GUTTER + half;
    const max = window.innerWidth - EDGE_GUTTER - half;
    // A chip wider than the viewport has no satisfying position; leave it centred.
    const clamped = max < min ? anchor.centre : Math.min(Math.max(anchor.centre, min), max);
    if (clamped !== anchor.centre) {
      setAnchor({ centre: clamped, bottom: anchor.bottom });
    }
  }, [anchor]);

  const trigger: TooltipTriggerProps = {
    'aria-describedby': anchor ? id : undefined,
    onPointerEnter: open,
    onPointerLeave: close,
    onFocus: open,
    onBlur: close,
  };

  const chip = anchor ? (
    // Two elements, not one: the outer holds the centring `translateX`, the inner the
    // entrance animation. `animate-rise-in` sets `transform` outright, so a single
    // element would drop the centring for the length of the animation and the chip
    // would slide in from half its own width to the right.
    //
    // `pointer-events-none` so the chip can never sit between the pointer and the
    // trigger it describes and flicker itself closed.
    <div
      className="pointer-events-none fixed z-50 mt-1.5 -translate-x-1/2"
      style={{ left: anchor.centre, top: anchor.bottom }}
    >
      <div
        ref={chipRef}
        id={id}
        role="tooltip"
        className={`whitespace-nowrap rounded-sm bg-neutral-900 px-(--sp-inline) py-1 text-xs font-medium leading-none text-white ${
          reducedMotion ? '' : 'animate-rise-in'
        }`}
        style={{ fontFamily: 'var(--font-primary)' }}
      >
        {label}
      </div>
    </div>
  ) : null;

  return (
    <>
      {children(trigger)}
      {chip && typeof document !== 'undefined' ? createPortal(chip, document.body) : null}
    </>
  );
};

export default Tooltip;
