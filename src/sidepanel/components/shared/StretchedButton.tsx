/**
 * @module sidepanel/components/shared/StretchedButton
 * @description Invisible full-bleed button that makes an enclosing card or row activatable.
 *
 * The "stretched link" pattern, as a real `<button>`. It solves the problem of
 * "clicking the row opens it" without either of the usual bad answers:
 *
 * - **Not** `role="button"` on a `<div>` — that has to re-implement Enter/Space,
 *   focus and disabled semantics by hand.
 * - **Not** wrapping the card's content in a `<button>` — headings, meters and
 *   nested controls are not valid button content, and nesting a control inside a
 *   button is an axe `nested-interactive` violation.
 *
 * Instead it renders an empty, absolutely-positioned button that covers its
 * positioned ancestor, sitting *behind* the card's own controls. Content stays
 * plain content, and the button carries its own accessible name.
 *
 * ## Contract
 *
 * - The intended click target must be a positioned ancestor (`relative`); the
 *   button stretches to it, so scope that ancestor to the clickable region.
 * - Sibling controls (checkboxes, icon buttons, links) must be `relative z-10`
 *   or they sit under the overlay and become unclickable.
 * - `label` is the accessible name and is the same for every card in a list, so
 *   pass `describedBy` pointing at the element that names *this* card — screen
 *   readers then announce "Open details, Engineering".
 *
 * @example
 * ```tsx
 * <div className="relative rounded-md border p-3">
 *   <StretchedButton label="View group details" describedBy={nameId} onClick={open} />
 *   <h3 id={nameId}>{group.name}</h3>
 *   <div className="relative z-10">
 *     <IconButton label="Expand" onClick={toggle}>…</IconButton>
 *   </div>
 * </div>
 * ```
 *
 * ## Response motion (ADR-0046)
 *
 * The overlay paints nothing, so the shared `.press` scale — built for a surface
 * with a visible box to depress — would be a no-op here. Instead the button
 * itself gains a faint `--color-neutral-900` wash on `:active`, a "state layer"
 * over the whole card rather than a transform on an invisible one; it eases in and
 * out over `--dur-instant` and, like `.press`, fires only on the user's own
 * pointer-down.
 */
import React from 'react';

/** Props for {@link StretchedButton}. */
interface StretchedButtonProps {
  /** Accessible name — required, since the button has no visible content. */
  label: string;
  /** Activation handler. */
  onClick: () => void;
  /**
   * `id` of the element that names the specific card (usually its title), read
   * after the label so identically-named overlays stay distinguishable.
   */
  describedBy?: string;
  /**
   * For a card whose whole surface is the **disclosure trigger** — reflected as
   * `aria-expanded`. Pair with {@link StretchedButtonProps.controls}.
   *
   * Same contract `IconButton` already carries, deliberately: the alternative
   * for an expandable card is either a `<div onClick>` (which has to
   * re-implement Enter/Space and announces nothing) or a chevron button beside a
   * separately-clickable card, which offers assistive tech two controls for one
   * action. Scope the overlay to the *header* region — a stretched trigger over
   * the whole card would also fire on clicks inside what it just opened.
   */
  expanded?: boolean;
  /** `id` of the region this button shows/hides — reflected as `aria-controls`. */
  controls?: string;
  /** Tooltip text; defaults to `label`. */
  title?: string;
  disabled?: boolean;
  /** Extra classes merged after the base positioning classes. */
  className?: string;
}

/**
 * An invisible button that covers its positioned ancestor, making the whole card
 * or row activatable while leaving its content — and its own controls —
 * untouched. See the module header for the layout contract.
 */
const StretchedButton: React.FC<StretchedButtonProps> = ({
  label,
  onClick,
  describedBy,
  expanded,
  controls,
  title,
  disabled = false,
  className = '',
}) => (
  <button
    type="button"
    aria-label={label}
    aria-describedby={describedBy}
    aria-expanded={expanded}
    aria-controls={controls}
    title={title ?? label}
    onClick={onClick}
    disabled={disabled}
    className={`absolute inset-0 z-0 h-full w-full rounded-md transition-colors duration-(--dur-instant) active:bg-neutral-900/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed ${className}`}
  />
);

export default StretchedButton;
