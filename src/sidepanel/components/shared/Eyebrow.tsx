/**
 * @module sidepanel/components/shared/Eyebrow
 * @description The single home for the uppercase section-label recipe.
 *
 * The small uppercase label that titles a section — "MEMBERSHIP SOURCE",
 * "PROFILE", "RULES" — was hand-rolled in roughly eighteen files under four
 * competing recipes: `tracking-wide` against `tracking-wider`, `text-xs` against
 * off-scale `text-[10px]` / `text-[11px]`, and `text-neutral-500` against `-600`
 * against `-700`. Every new section picked whichever copy its author happened to
 * read first, so the panel showed several sizes of the same element on one
 * screen.
 *
 * ADR-0030 already settled the values — `DetailSection`'s `tracking-wide` eyebrow
 * is named there as "the survivor of the tracking-wide/tracking-wider split" —
 * but it settled them as prose rather than as code, so the drift kept
 * accumulating. This component is that decision made mechanical: the recipe
 * exists once, and a call site cannot pick a different one without deleting the
 * import.
 *
 * An eyebrow is a **label, not a control**. It has no click handler, no focus
 * ring and no interactive element; a section header that needs a verb composes
 * this beside a `Button` or `IconButton` rather than making the label itself
 * pressable.
 *
 * There is deliberately **no colour prop, no size prop and no tracking prop**.
 * A section that wants a differently-coloured or differently-sized eyebrow is
 * precisely the drift this component exists to stop — if a genuinely new
 * treatment is needed, it changes here, once, for everyone. `className` is for
 * layout and spacing only.
 */
import React from 'react';

/** Props for {@link Eyebrow}. */
export interface EyebrowProps {
  /** The label text. Keep it short — an eyebrow titles a section, it does not explain it. */
  children: React.ReactNode;
  /**
   * Element to render. Use `'h3'` when the eyebrow is a real section heading and
   * should join the document outline; keep the default `'span'` (or `'div'` when
   * a block box is wanted) for a decorative label that would otherwise break
   * heading order.
   */
  as?: 'span' | 'div' | 'h3';
  /**
   * Extra classes — layout and spacing only (`mb-2`, `block`, `flex-1`), never
   * colour or type. The type recipe is fixed on purpose.
   */
  className?: string;
  /** Native `title` tooltip, for a label whose full meaning does not fit. */
  title?: string;
  /**
   * DOM `id`, so a control elsewhere can point at this label with
   * `aria-labelledby`/`aria-describedby`.
   *
   * The case it exists for: a `StretchedButton` covering a card carries the same
   * generic name on every card in a list ("Open groups"), and `describedBy`
   * pointing at the card's eyebrow is what makes each one distinguishable to a
   * screen reader.
   */
  id?: string;
  /** Optional test handle. */
  testId?: string;
}

/**
 * The one uppercase type recipe every section label shares. Not configurable —
 * see the module header for why.
 */
const eyebrowClasses = 'text-xs font-semibold uppercase tracking-wide text-neutral-600';

/**
 * A small uppercase label that titles a section.
 *
 * @example
 * ```tsx
 * // A decorative label above a block of facts.
 * <Eyebrow className="mb-2">Membership source</Eyebrow>
 *
 * // A real section heading, joining the document outline.
 * <Eyebrow as="h3" className="mb-2">Rules</Eyebrow>
 * ```
 */
const Eyebrow: React.FC<EyebrowProps> = ({
  children,
  as: Component = 'span',
  className = '',
  title,
  testId,
  id,
}) => (
  <Component
    id={id}
    className={`${eyebrowClasses} ${className}`}
    title={title}
    data-testid={testId}
  >
    {children}
  </Component>
);

export default Eyebrow;
