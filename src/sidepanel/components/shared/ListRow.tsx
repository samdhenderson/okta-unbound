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
 *
 * ## Response motion (ADR-0046)
 *
 * A row whose `as`/`onClick` makes it the click target itself carries `.press`
 * `.press-subtle` — a `scale(.995)` depress, flattened from a button's `.955`
 * because a row is a much wider target and the same ratio would read as a lurch.
 * A row activated instead by an internal `StretchedButton` (the invisible
 * full-bleed overlay pattern — see {@link sidepanel/components/shared/StretchedButton})
 * does not get it here: the overlay has no visible box of its own to depress, and
 * that pattern already carries its own focus ring, matching how `interactive`
 * (below) has always excluded it. `flash` is the other half of response motion —
 * a one-shot `--dur-tell` background/border confirmation for a row that just
 * committed a change optimistically.
 *
 * ## Spacing (ADR-0048)
 *
 * `density`'s two padding recipes resolve against the `--sp-*` spacing roles
 * rather than fixed pixel values, so a row's padding still tightens at 360px and
 * relaxes at 720px exactly like every other spacing-role consumer — see
 * {@link ListRowDensity} for why the prop survives that system rather than being
 * replaced by it.
 */
import React from 'react';

/**
 * Row padding. Two values, not the ten found in the wild.
 *
 * `compact` is a dense scanning list (`GroupListItem`, `MemberRow`); `comfortable`
 * is a rich card with badges and a meta line (`AppListItem`, `RuleCard`,
 * `PolicyCard`). Rows that previously sat between the two round to the nearer one.
 *
 * This is a **content-density** selector, not a width one — it survives the
 * `--sp-*` spacing system (ADR-0048) rather than being replaced by it. "This list
 * is for dense scanning" versus "these are rich cards" is a property of what the
 * row holds, and the panel's measured width cannot know that; the two systems
 * compose instead of competing. `compact` resolves to the dedicated row role
 * (`--sp-row-y`/`--sp-row-x`) and `comfortable` reuses the card role (`--sp-card`)
 * a rich row already resembles — both still move together as the panel resizes,
 * so there is exactly one padding system, not two running in parallel.
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
  compact: 'py-(--sp-row-y) px-(--sp-row-x)',
  comfortable: 'p-(--sp-card)',
};

const stateClasses: Record<ListRowState, string> = {
  default: 'border-neutral-200 bg-white',
  selected: 'border-primary bg-primary-light',
  highlighted: 'border-primary bg-primary-light ring-2 ring-primary ring-offset-2',
};

/** The chrome every row shares — radius and border only; the transition is picked below. */
const baseClasses = 'rounded-md border';

/**
 * A static row's hover-border transition. `transition-colors` (not
 * `transition-all`) so hover animates the border and nothing else — several rows
 * previously used `transition-all` and animated layout properties by accident.
 *
 * Interactive rows use `.press` instead (below), never both: `.press` already
 * transitions `border-color`/`background-color`/`color` at the same
 * `--dur-instant`, and a Tailwind `transition-*` utility sits in a later cascade
 * layer than `.press`'s `@layer components` rule, so keeping this utility on an
 * interactive row would silently win over `.press`'s tuned `:active` timing
 * (`--dur-press` in, `--dur-quick`/`--ease-affirm` out) rather than layering with it.
 */
const restingTransitionClass = 'transition-colors duration-(--dur-instant)';

/**
 * Response motion for a whole-row activation (ADR-0046) — `.press` for the
 * depress mechanics, `.press-subtle` to flatten its scale from `.955` to `.995`,
 * since a row is a much wider target than a button and the same ratio reads as a
 * lurch. Applied only when the row is itself the click target — the same
 * `interactive` check computed in the component body below — not when activation
 * comes from an internal `StretchedButton`, which is invisible and has no box of
 * its own to visibly depress.
 */
const pressClasses = 'press press-subtle';

/**
 * The one hover treatment, and the reason `state` gates it.
 *
 * A `selected` or `highlighted` row already carries `border-primary` to say so.
 * Letting hover repaint that border `neutral-500` would make the row look *less*
 * selected the moment you pointed at it — hover would be overriding state rather
 * than responding to it. So the hover border applies to `default` rows only; the
 * cursor and focus ring still apply everywhere, since those describe what the row
 * does rather than what it is.
 */
const hoverBorderClass = 'hover:border-neutral-500';

/** Applied only when the row is itself the click target. */
const interactiveClasses =
  'w-full text-left cursor-pointer ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

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
   * A region below the header — inside the row's border, outside its padding.
   *
   * This is what an expandable row needs. Four of the six primary list rows carry
   * a `.disclose` body whose own padding differs from the header's, so the row
   * cannot simply be "a padded box": the border belongs to the card, the padding
   * belongs to the header, and the body sets its own.
   *
   * Passing it moves the density padding off the container and onto an inner
   * wrapper around `children`, and adds `overflow-hidden` so a body animating
   * from `0fr` clips against the rounded corners. Omitting it leaves the simple
   * case as a single padded element with no extra wrapper.
   */
  body?: React.ReactNode;
  /**
   * Extra classes on the header wrapper `body` creates. Layout and interaction
   * only — the padding is already supplied by `density`.
   *
   * Ignored without `body`, since there is no separate header to style.
   */
  headerClassName?: string;
  /**
   * Click handler on the header region alone, for an expandable row whose header
   * toggles it.
   *
   * Deliberately separate from {@link ListRowProps.onClick}, which covers the
   * whole card: a toggle on the card would also fire on clicks inside the
   * expanded body, collapsing the row the moment a user interacted with what they
   * had just opened.
   */
  onHeaderClick?: () => void;
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
  /**
   * Ref to the row element itself.
   *
   * Exists for rows that must listen on their own card — `RuleCard` clears its
   * `flash` on the card's `animationend` rather than on a timer alone, which needs
   * the element the animation actually runs on.
   */
  elementRef?: React.Ref<HTMLElement>;
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
  body,
  headerClassName = '',
  onHeaderClick,
  onClick,
  href,
  target,
  ariaLabel,
  title,
  describedBy,
  className = '',
  dataAttributes,
  elementRef,
  testId,
}) => {
  // A row is interactive when it can be activated by the user directly — not when
  // a `StretchedButton` sits on top of it, which carries its own focus ring.
  const interactive = as === 'button' || as === 'a' || onClick !== undefined;

  // With a body, the padding belongs to the header rather than the card, and the
  // card clips so a `0fr` disclose body cannot escape the rounded corners.
  const hasBody = body !== undefined && body !== null;

  const classes = [
    baseClasses,
    interactive ? pressClasses : restingTransitionClass,
    hasBody ? 'overflow-hidden' : densityClasses[density],
    stateClasses[state],
    state === 'default' ? hoverBorderClass : '',
    interactive ? interactiveClasses : '',
    elementClasses[as] ?? '',
    flash ? 'animate-affirm-flash' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = hasBody ? (
    <>
      <div
        className={[densityClasses[density], headerClassName].filter(Boolean).join(' ')}
        onClick={onHeaderClick}
      >
        {children}
      </div>
      {body}
    </>
  ) : (
    children
  );

  const shared = {
    className: classes,
    onClick,
    title,
    'aria-label': ariaLabel,
    'aria-describedby': describedBy,
    'data-testid': testId,
    ...dataAttributes,
  };

  // One `React.Ref<HTMLElement>` serves every branch; each element type wants its
  // own narrower ref, so the cast is per-branch rather than the prop being loose.
  if (as === 'button') {
    // Explicit `type`: a bare <button> inside a form defaults to submit.
    return (
      <button type="button" ref={elementRef as React.Ref<HTMLButtonElement>} {...shared}>
        {content}
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
        ref={elementRef as React.Ref<HTMLAnchorElement>}
        {...shared}
      >
        {content}
      </a>
    );
  }

  if (as === 'li') {
    return (
      <li ref={elementRef as React.Ref<HTMLLIElement>} {...shared}>
        {content}
      </li>
    );
  }

  return (
    <div ref={elementRef as React.Ref<HTMLDivElement>} {...shared}>
      {content}
    </div>
  );
};

export default ListRow;
