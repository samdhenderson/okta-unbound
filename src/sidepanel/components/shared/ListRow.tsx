/**
 * @module sidepanel/components/shared/ListRow
 * @description The card a list row sits in — border, radius, hover, padding, state.
 *
 * A row is the most repeated visual element in the panel and was the least
 * consistent: an inventory found ten padding values, five hover treatments and
 * four separator strategies for the same conceptual element, plus class strings
 * hand-copied between files. `ListRow` is the one place that decision now lives
 * (ADR-0029).
 *
 * ## It owns the box, never the interior
 *
 * Children are whatever the feature needs. That boundary is deliberate: the
 * interiors genuinely differ — {@link sidepanel/components/groups/GroupListItem}
 * carries a checkbox, a `StretchedButton` overlay and a `.disclose` body, while
 * `MemberRow` is three lines of text and a pill — so a primitive that owned them
 * would need a prop per variation and would be reconfigured rather than reused.
 * What is identical across all thirty rows is the box, and the box is what drifts.
 *
 * The interior still has a rule; it just isn't enforced here. Primary line
 * `text-sm font-semibold text-neutral-900`, secondary `text-xs text-neutral-600`,
 * identifiers `font-mono text-xs text-neutral-500`, badges
 * `px-2 py-0.5 rounded-md text-xs font-medium` — see `docs/design-system.md`.
 *
 * ## What is not configurable
 *
 * The radius, the resting border, the hover border and the transition are fixed.
 * A row that wants a different hover colour is the problem this component exists
 * to solve, so there is no prop for it.
 */
import React from 'react';

/**
 * Row padding. Two values, not the ten found in the wild.
 *
 * `compact` is a dense scanning list (`GroupListItem`, `MemberRow`); `comfortable`
 * is a rich card with badges and a meta line (`AppListItem`, `RuleCard`,
 * `PolicyCard`). Rows that previously sat between the two round to the nearer one.
 */
export type ListRowDensity = 'compact' | 'comfortable';

/**
 * Resting appearance.
 *
 * `selected` is a user choice (a checked row, a picked merge survivor);
 * `highlighted` is a transient deep-link target the app scrolled to. They are
 * distinct because a highlight fades and a selection does not.
 */
export type ListRowState = 'default' | 'selected' | 'highlighted';

/** Element the row renders as. */
export type ListRowAs = 'div' | 'li' | 'a' | 'button';

const densityClasses: Record<ListRowDensity, string> = {
  compact: 'px-3 py-2',
  comfortable: 'p-4',
};

const stateClasses: Record<ListRowState, string> = {
  default: 'border-neutral-200 bg-white',
  selected: 'border-primary bg-primary-light',
  highlighted: 'border-primary bg-primary-light ring-2 ring-primary ring-offset-2',
};

/**
 * The chrome every row shares. `transition-colors` (not `transition-all`) so a
 * row's hover animates its border and nothing else — several rows previously used
 * `transition-all` and animated layout properties by accident.
 */
const baseClasses = 'rounded-md border transition-colors duration-(--dur-instant)';

/** Applied only when the row is itself the click target. */
const interactiveClasses =
  'w-full text-left cursor-pointer hover:border-neutral-500 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** Applied when the row is static content, or when a `StretchedButton` covers it. */
const hoverOnlyClasses = 'hover:border-neutral-500';

/**
 * `block` on the anchor: an `<a>` is inline by default, so without it the row's
 * padding would not affect line height and `w-full` would do nothing.
 */
const elementClasses: Partial<Record<ListRowAs, string>> = {
  a: 'block',
};

/** Props for {@link ListRow}. */
export interface ListRowProps {
  /** The row's content — owned by the feature, not by this component. */
  children: React.ReactNode;
  /** Padding scale. Defaults to `comfortable`. */
  density?: ListRowDensity;
  /** Resting appearance. Defaults to `default`. */
  state?: ListRowState;
  /**
   * One-shot success confirmation (`animate-affirm-flash`) — a row that was just
   * added or changed. Transient by nature; pair it with a timer that clears the
   * flag, or the row keeps its confirmation forever.
   */
  flash?: boolean;
  /**
   * Element to render. `li` inside a `ul`/`ol`, `a` for a real navigation, and
   * `button` when the whole row activates something.
   *
   * Prefer {@link sidepanel/components/shared/StretchedButton} over `as="button"`
   * when the row contains its **own** controls: a button cannot legally contain a
   * checkbox or another button, and axe reports `nested-interactive` when it does.
   * Defaults to `div`.
   */
  as?: ListRowAs;
  /**
   * Activation handler. Supplying it makes the row interactive — it gains a
   * pointer cursor and a focus ring — so pass an interactive `as` with it.
   */
  onClick?: () => void;
  /** `href` for `as="a"`. Ignored otherwise. */
  href?: string;
  /** Link target for `as="a"`. `_blank` also sets `rel="noopener noreferrer"`. */
  target?: string;
  /** Accessible name, when the visible content does not provide a sufficient one. */
  ariaLabel?: string;
  /** Tooltip text. */
  title?: string;
  /** `id` of the element describing this row, for an interactive row in a list. */
  describedBy?: string;
  /** Extra classes merged after the resolved chrome — layout only, never colour. */
  className?: string;
  /** Escape hatch for row-identity attributes (`data-group-id`, `data-rule-id`). */
  dataAttributes?: Record<string, string>;
  /** Test id applied to the row element. */
  testId?: string;
}

/**
 * A list row's card: border, radius, hover, padding, and resting state.
 *
 * @example
 * ```tsx
 * // A dense, static row inside a <ul>
 * <ListRow as="li" density="compact">
 *   <span className="text-sm font-semibold text-neutral-900">{group.name}</span>
 * </ListRow>
 *
 * // A whole-row activation with no nested controls
 * <ListRow as="button" onClick={() => onSelect(user)} describedBy={nameId}>
 *   <h4 id={nameId} className="text-sm font-semibold text-neutral-900">{name}</h4>
 * </ListRow>
 * ```
 *
 * @param props - See {@link ListRowProps}.
 */
const ListRow: React.FC<ListRowProps> = ({
  children,
  density = 'comfortable',
  state = 'default',
  flash = false,
  as = 'div',
  onClick,
  href,
  target,
  ariaLabel,
  title,
  describedBy,
  className = '',
  dataAttributes,
  testId,
}) => {
  // A row is interactive when it can be activated by the user directly — not when
  // a `StretchedButton` sits on top of it, which carries its own focus ring.
  const interactive = as === 'button' || as === 'a' || onClick !== undefined;

  const classes = [
    baseClasses,
    densityClasses[density],
    stateClasses[state],
    interactive ? interactiveClasses : hoverOnlyClasses,
    elementClasses[as] ?? '',
    flash ? 'animate-affirm-flash' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const shared = {
    className: classes,
    onClick,
    title,
    'aria-label': ariaLabel,
    'aria-describedby': describedBy,
    'data-testid': testId,
    ...dataAttributes,
  };

  if (as === 'button') {
    // Explicit `type`: a bare <button> inside a form defaults to submit.
    return (
      <button type="button" {...shared}>
        {children}
      </button>
    );
  }

  if (as === 'a') {
    return (
      <a
        href={href}
        target={target}
        // Tabnabbing guard, applied here rather than left to each call site.
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        {...shared}
      >
        {children}
      </a>
    );
  }

  if (as === 'li') {
    return <li {...shared}>{children}</li>;
  }

  return <div {...shared}>{children}</div>;
};

export default ListRow;
