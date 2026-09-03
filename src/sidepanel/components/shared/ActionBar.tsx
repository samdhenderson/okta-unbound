/**
 * @module sidepanel/components/shared/ActionBar
 * @description The page-level action strip of a detail view (ADR-0030, ADR-0038).
 *
 * The rule it enforces: **a verb whose object is the whole page belongs here; a
 * verb scoped to one section's data belongs in that section's
 * `DetailSection.actions` slot.** Before this existed, "Compare" sat in the
 * group-memberships card header — structurally indistinguishable from "Add to
 * group", which acts on that card alone — so the page's most important action
 * read as a property of one section.
 *
 * ## Actions are data, not children
 *
 * The strip takes {@link ActionDescriptor}s rather than `Button` children,
 * because a strip that cannot see what it holds cannot decide what fits. With
 * descriptors it measures each action once and re-splits the row as the panel is
 * dragged: everything on a wide panel, icons dropped when it tightens, and the
 * tail moved behind **More** when it tightens further. The arithmetic is
 * {@link sidepanel/components/shared/actionBarFit.fitActions} and the measuring is
 * {@link sidepanel/components/shared/useActionOverflow.useActionOverflow}; this
 * component only renders their answer.
 *
 * The price is that a descriptor can carry no JSX. That is deliberate — an
 * arbitrary node cannot be measured from a cached width, nor re-rendered into the
 * tier with different chrome. Arbitrary UI goes in {@link ActionBarProps.expansion},
 * which is the whole point of that slot.
 *
 * ## Why it sticks
 *
 * The side panel has exactly one scroller: the `overflow-y-auto` content region
 * of `App.tsx`, which `TabPanel` shares and which the Users tab explicitly does
 * not shadow with a scroll box of its own. `sticky` therefore pins against that
 * region, and no intermediate wrapper sets `overflow` to break it.
 *
 * It is the second band of the sticky stack (ADR-0032), so it parks below the
 * page header rather than at the top of the scroller: `top` resolves to that
 * header's published height. It defaults to `0px`, so a story — or any surface
 * with no header — behaves as a `top-0` strip. The tab rail is not in that sum:
 * it lives outside the scroller entirely, so the scroller's own top edge already
 * begins beneath it.
 *
 * The strip sits at `z-30`, above the page header (`z-20`) so it can cover that
 * header's bottom border as it merges.
 *
 * ## How it docks
 *
 * At rest the strip is a **card like every other card on the rung** — it spans
 * the tab column and stops at its margins, so it lines up with the sections
 * below it rather than announcing itself as a different kind of object. Reaching
 * its parking spot is not the same as looking parked, so over the last
 * `--merge-range` of travel it grows *past* those margins to the panel edges,
 * loses its radius and its top/side borders, covers the header's bottom seam and
 * grows a shadow. Header and strip end up one continuous pinned surface with a
 * single bottom edge.
 *
 * Only the chrome moves. The merge animates the `::before` box, never the row,
 * so the buttons hold still through all of it — the row keeps the column's
 * padding whether the band is inside its margins or past them, which is also
 * what keeps the verbs aligned with the header's own content once the two have
 * become one surface. Nothing in flow is on the timeline, which is why the
 * overflow observer can watch a band width that never churns.
 *
 * An earlier revision made the resting strip hug its buttons — a pill the width
 * of its verbs. It was measured working, and dropped anyway: a pill is a fourth
 * kind of box on a rung that already has a header, cards and rows, and the
 * disclosure that has to sit at its trailing edge ends up floating mid-column
 * with nothing under it.
 *
 * **Over the last `--merge-range` of travel, not the first of scroll.** The merge
 * is a function of how close the strip is to the header, which is why this
 * component renders a zero-size
 * {@link https://drafts.csswg.org/scroll-animations-1/#view-timelines | view-timeline}
 * sentinel immediately before itself. The sentinel keeps moving after the strip
 * has parked, so it — not the scroll offset — says "you are 32px from docking".
 * The geometry is all in `.dock-band` / `.dock-sentinel` in `tailwind.css`, which
 * also explains why the sentinel's timeline has to be hoisted with
 * `timeline-scope` and why `--merge-range` must stay shorter than the strip's
 * real travel.
 *
 * The mechanism is a CSS scroll-driven animation, not a transition on a stuck
 * flag and not a scroll listener. It costs no per-frame JavaScript on the one
 * shared scroller — the same reason
 * {@link sidepanel/hooks/useStuck.useStuck} is an `IntersectionObserver`.
 *
 * A `sticky={false}` strip renders no sentinel, so it never docks and there is
 * nothing for it to dock *into*. It simply keeps the resting card.
 *
 * ## The disclosure tier
 *
 * The tier is a second row that belongs to the strip rather than to the page: it
 * stretches the strip downward instead of dropping a card into the flow beneath
 * it. That distinction is the whole feature. It lives *inside* the band, so the
 * band's painted chrome (which is `inset: 0` of it) grows with it and the merge
 * carries it along; and it opens through the shared `.disclose` grid, so the
 * strip's height animates with no JS measurement.
 *
 * It is the band's **last** row — below {@link ActionBarProps.subRow} and below
 * {@link ActionBarProps.register} when either is present — so on a list rung the
 * disclosure appears under the search field and the selection controls rather
 * than between the verbs and the thing they filter.
 *
 * It holds two things, in order: the actions that did not fit — from the action
 * row and from the register both, which this component owns and the caller never
 * sees — and then {@link ActionBarProps.expansion} verbatim. A separator appears
 * only when both are present.
 *
 * Its children stay mounted while closed, held out of the tab order and the
 * accessible tree with `inert` — the same contract as
 * {@link sidepanel/components/shared/CollapsibleSection}. Do not rely on closing
 * it to reset or unmount anything inside.
 *
 * ## The selection register
 *
 * {@link ActionBarProps.register} is a second measured row for verbs scoped to
 * *what the reader has ticked*, as opposed to the action row's verbs, whose
 * object is the whole page. It exists because those two families were sharing
 * one row, and a shared row cannot express the difference between them without
 * either a divider or a colour — and a strip that has to explain its own
 * grouping has already lost.
 *
 * **The separation is a tonal step and nothing else.** No border, no rule, no
 * divider: the register is a recessed well (`bg-neutral-50`, the panel's one
 * surface tone below white) inside the band's white chrome, so the band reads as
 * two surfaces at two elevations. That is not the grey slab ADR-0051 §Context
 * rejected — that one was the *whole* strip, sitting above a white list, reading
 * as a section switched off. This is an inset well inside a white band, with the
 * band's own verbs on white directly above it.
 *
 * **It shares, it does not stack.** The register renders whenever the caller
 * passes one, whatever is in it — so a rung whose register holds only
 * `Select all (M)` at rest still has the row, and ticking the first checkbox
 * adds controls to a row that was already there. Nothing appears; nothing below
 * the band moves. A register that materialised on the first tick would shift the
 * list down by a row *under the pointer that was ticking it*, which is the
 * specific defect this shape exists to avoid.
 *
 * **It renders one size down.** Its buttons are `xs` (24px) against the action
 * row's `sm` (36px). The tonal step says the two rows are different surfaces;
 * the size step says which one is subordinate — without it a register holding
 * `Select all (247)`, `Deselect all` and `Compare (3)` is simply the widest,
 * loudest thing in the band, and the page's own verbs above it read as the
 * afterthought. Both the visible row and its probe take the size from one
 * constant, because a probe measuring a different button measures nothing.
 *
 * **It overflows independently.** The register runs its own
 * {@link sidepanel/components/shared/useActionOverflow.useActionOverflow} pass
 * against its own width, so a wide selection verb pushes a *selection* verb into
 * the tier and never a page verb, and either row may go compact while the other
 * keeps its glyphs. Both rows overflow into the **one** tier behind the **one**
 * More control, which lives in the action row: two disclosures in one band would
 * be two controls with the same accessible name and no way to tell which held
 * what.
 *
 * **Position one of the register is a safety property** (ADR-0051 §2), and it is
 * the caller's to keep: the register's leading descriptor must be a selection
 * control, because every other verb in it appears and disappears with the
 * selection size. This component pins the leading descriptors it is given and
 * does not reorder them.
 */
import React, { useCallback, useId, useRef, useState } from 'react';
import Button, { type ButtonSize, type ButtonVariant } from './Button';
import type { IconType } from '../shared/Icon';
import { useActionOverflow } from './useActionOverflow';

/**
 * Where an action is allowed to live when the bar runs out of room.
 *
 * - `pinned` — never overflows; the row wraps before this action leaves it.
 * - `flex` — overflows when it does not fit. The last declared leaves first.
 * - `tier` — never appears in the bar; it lives behind **More** from the start.
 */
export type ActionPriority = 'pinned' | 'flex' | 'tier';

/** One page-level verb. Data only — see the module note on why it carries no JSX. */
export interface ActionDescriptor {
  /** Stable identity: the width-cache key, the React key, and `data-action-id`. */
  id: string;
  /** Visible label and accessible name. Sentence case. */
  label: string;
  /** Leading glyph. Dropped from every bar action at once when the row tightens. */
  icon?: IconType;
  /** Defaults to `secondary`. At most one `primary` per strip. */
  variant?: ButtonVariant;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Native tooltip. Use it for the *why*, never to restate the label. */
  title?: string;
  /** Defaults to `flex` — except a `primary` action, which defaults to `pinned`. */
  priority?: ActionPriority;
  /** Optional test handle, rendered on the action's wrapper. */
  testId?: string;
}

/**
 * The selection register: the strip's second row, holding the verbs whose object
 * is the reader's selection rather than the page.
 *
 * See the module note. It is a separate array rather than a flag on
 * {@link ActionDescriptor} on purpose — "the first control here is a selection
 * control" is then a property of one list that a test can state in one line,
 * instead of a property of a filtered view of a mixed one.
 */
export interface ActionRegister {
  /**
   * Accessible name for the register's group, e.g. `"Selection actions"`. Required
   * for the same reason {@link ActionBarProps.ariaLabel} is: the band now holds
   * two groups of buttons, and a reader arriving at either needs to be told which.
   */
  ariaLabel: string;
  /**
   * The selection-scoped verbs, in reading order.
   *
   * **The first must be a selection control** — `Deselect all`, then
   * `Select all (M)` — and the leading `pinned` ones never overflow (ADR-0051 §2).
   * Everything else here appears and disappears with the selection size, so a
   * register led by anything else puts a different verb under the pointer every
   * time a row is ticked.
   */
  actions: readonly ActionDescriptor[];
}

/** Props for {@link ActionBar}. */
export interface ActionBarProps {
  /**
   * The page's verbs, ordered by weight. Exactly one `variant="primary"` (the
   * page's main verb); the rest `secondary`. Order matters twice: it is the
   * reading order, and the tail is what overflows first.
   */
  actions: readonly ActionDescriptor[];
  /**
   * Accessible name for the group, e.g. `"Actions for Jane Doe"`. Required: a
   * bare group of buttons announces nothing about what it acts on, and a detail
   * page can hold more than one set of controls.
   */
  ariaLabel: string;
  /**
   * Pin below the bands above it — the tab rail and the page header — while the
   * page scrolls under it, merging into the header as it docks. Defaults to
   * `true`; pass `false` where the strip is already inside a fixed region (or in
   * a story, where there is nothing to scroll), which also opts out of the merge.
   */
  sticky?: boolean;
  /**
   * Arbitrary caller UI rendered **inside the band, directly beneath the action
   * row** — above {@link ActionBarProps.register} and above the disclosure tier.
   * Unlike {@link ActionBarProps.expansion}
   * it is always visible, so it is for a control that belongs to the strip's
   * surface rather than behind its disclosure — a list rung's search field is the
   * case it exists for (ADR-0051).
   *
   * It rides the merge: whatever is here docks and goes full-bleed with the rest
   * of the band, which is the point. Keep it to one row. A tall sub-row makes a
   * tall pinned band, and the panel is 360px wide at its narrowest.
   *
   * Unlike a descriptor it may carry JSX, because it is never measured — the fit
   * arithmetic only looks at the action row.
   */
  subRow?: React.ReactNode;
  /**
   * The selection register — a second, tonally recessed row of selection-scoped
   * verbs, rendered below {@link ActionBarProps.subRow} and above the tier.
   *
   * Pass it whenever the rung has a selection at all, not only once something is
   * ticked: the row holds its space in both states, so the first tick adds
   * controls to a row that already exists instead of pushing the list down.
   * See {@link ActionRegister} and the module note.
   */
  register?: ActionRegister;
  /**
   * Arbitrary caller UI for the tier — an account-state block, a form, anything.
   * It is appended below any actions that overflowed there, and it is the reason
   * the tier is a region rather than a menu: `role="menu"` would forbid all of it.
   */
  expansion?: React.ReactNode;
  /** Whether the tier is open. Omit to let the strip own the state. */
  tierOpen?: boolean;
  /** Initial open state when uncontrolled. Defaults to `false`. */
  defaultTierOpen?: boolean;
  /** Called with the next open state whenever the disclosure is toggled. */
  onTierOpenChange?: (open: boolean) => void;
  /** Extra classes merged after the layout classes. */
  className?: string;
  /** Optional test handle. */
  testId?: string;
}

/** A `primary` verb is the page's main action, so it defaults to never overflowing. */
const priorityOf = (action: ActionDescriptor): ActionPriority =>
  action.priority ?? (action.variant === 'primary' ? 'pinned' : 'flex');

/**
 * Split one row's descriptors into what the fit pass may see and what it may
 * not.
 *
 * Shared by the action row and the register so the two rows cannot drift apart
 * on what `pinned`/`flex`/`tier` mean — the whole point of the register is that
 * it is *the same row arithmetic* run against a different width, not a second
 * layout with its own rules.
 */
const splitByPriority = (
  actions: readonly ActionDescriptor[],
): { ordered: ActionDescriptor[]; pinned: number; tierOnly: ActionDescriptor[] } => {
  const barEligible = actions.filter((a) => priorityOf(a) !== 'tier');
  const pinnedActions = barEligible.filter((a) => priorityOf(a) === 'pinned');
  return {
    ordered: [...pinnedActions, ...barEligible.filter((a) => priorityOf(a) === 'flex')],
    pinned: pinnedActions.length,
    tierOnly: actions.filter((a) => priorityOf(a) === 'tier'),
  };
};

/**
 * The register renders one size below the action row (24px against 36px).
 * Selection controls are furniture around the list — how many rows are ticked,
 * how to stop ticking them — and at the row's own size they read as the loudest
 * thing in the band, which is exactly backwards: the page's verbs sit above
 * them. Declared once because the visible row and its measurement probe must
 * agree; see {@link MeasureProbe}.
 */
const REGISTER_BUTTON_SIZE = 'xs' as const;

/**
 * One action's button, wrapped so the wrapper can carry the measurement and
 * focus-recovery handles. `Button` takes an explicit prop list rather than
 * spreading, so `data-action-id` cannot go on it directly; an `inline-flex` span
 * is the same width as the button it holds, so measuring the wrapper is
 * measuring the button.
 */
const Action: React.FC<{
  action: ActionDescriptor;
  /** Drop the icon — set for every bar action at once, or not at all. */
  compact?: boolean;
  /** `full` / `compact` mark the two probe copies; omitted in the visible row. */
  measure?: 'full' | 'compact';
  /** Overridden to `secondary` in the tier: a filled primary inside a
      disclosure is a second focal point competing with the real one. */
  variant?: ButtonVariant;
  /** `xs` in the selection register; `sm` — the strip's default — everywhere else. */
  size?: ButtonSize;
}> = ({ action, compact = false, measure, variant, size = 'sm' }) => (
  <span
    className="inline-flex"
    data-action-id={action.id}
    {...(measure ? { 'data-measure': measure } : {})}
    {...(action.testId ? { 'data-testid': action.testId } : {})}
  >
    <Button
      variant={variant ?? action.variant ?? 'secondary'}
      size={size}
      {...(compact || !action.icon ? {} : { icon: action.icon })}
      onClick={action.onClick}
      disabled={action.disabled ?? false}
      loading={action.loading ?? false}
      {...(action.title ? { title: action.title } : {})}
    >
      {action.label}
    </Button>
  </span>
);

/**
 * One row's hidden measurement probe.
 *
 * Never measure inside the real row: `Button` is `flex: 0 1 auto`, so a
 * width-constrained wrapping row reports the *shrunk* width, not the natural
 * one. Absolutely positioned so it adds no layout, `max-content` + `nowrap` so
 * nothing shrinks, and `aria-hidden`+`inert` because jsdom loads no stylesheet —
 * without them `getByRole` would find every action three times.
 *
 * `cluster` is rendered only for the row that owns the **More** control. The
 * register does not: it overflows into the action row's tier, so it is charged
 * no trailing box and `useActionOverflow` reads its cluster width as zero.
 */
const MeasureProbe: React.FC<{
  actions: readonly ActionDescriptor[];
  cluster: boolean;
  probeRef: React.RefObject<HTMLDivElement | null>;
  /** Must match the size the measured row actually renders at, or every width
      the fit arithmetic reads is a width from a different button. */
  size?: ButtonSize;
}> = ({ actions, cluster, probeRef, size }) => (
  <div
    ref={probeRef}
    aria-hidden="true"
    inert
    className="pointer-events-none invisible absolute top-0 left-0 flex w-max items-center gap-2 whitespace-nowrap"
  >
    {actions.map((action) => (
      <Action key={`f-${action.id}`} action={action} measure="full" {...(size ? { size } : {})} />
    ))}
    {actions.map((action) => (
      <Action
        key={`c-${action.id}`}
        action={action}
        compact
        measure="compact"
        {...(size ? { size } : {})}
      />
    ))}
    {cluster && (
      <span className="inline-flex items-center" data-measure="cluster">
        <span aria-hidden="true" className="mx-1 w-px self-stretch bg-neutral-200" />
        <Button variant="ghost" size="sm" icon="chevron-down" iconPosition="right">
          More
        </Button>
      </span>
    )}
  </div>
);

/**
 * The sticky strip of page-level actions, rendered directly beneath the header
 * and above the detail sections.
 *
 * @example
 * ```tsx
 * <ActionBar
 *   ariaLabel={`Actions for ${userDisplayName(user)}`}
 *   actions={[
 *     { id: 'add', label: 'Add group', icon: 'plus', variant: 'primary', onClick: onAddToGroup },
 *     { id: 'compare', label: 'Compare', icon: 'users', onClick: onCompare },
 *   ]}
 *   expansion={<UserLifecycleActions {...lifecycle} />}
 * />
 * ```
 */
const ActionBar: React.FC<ActionBarProps> = ({
  actions,
  ariaLabel,
  sticky = true,
  subRow,
  register,
  expansion,
  tierOpen,
  defaultTierOpen = false,
  onTierOpenChange,
  className = '',
  testId,
}) => {
  const tierId = useId();
  const bandRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const clusterRef = useRef<HTMLElement | null>(null);
  const moreRef = useRef<HTMLButtonElement | null>(null);
  const registerProbeRef = useRef<HTMLDivElement>(null);
  /*
   * The register's stand-in for a trailing cluster. `useActionOverflow` finds the
   * row it is fitting by walking up from the cluster it was handed, so a row with
   * no **More** control of its own still has to name itself somehow — and the
   * hook's fallback (the band's first non-probe child) would hand it the action
   * row's box instead. A zero-size, absolutely positioned marker inside the
   * register row is that name: it is out of flow, so it neither takes a `gap-2`
   * step nor changes where the row wraps, and the hook only ever reads its
   * `parentElement`. The register's cluster *width* is a separate input and is
   * zero — see {@link MeasureProbe}.
   */
  const registerAnchorRef = useRef<HTMLElement | null>(null);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultTierOpen);
  const open = tierOpen ?? uncontrolledOpen;

  const toggle = useCallback(() => {
    const next = !open;
    if (tierOpen === undefined) setUncontrolledOpen(next);
    onTierOpenChange?.(next);
  }, [open, tierOpen, onTierOpenChange]);

  // Pinned first, then flex, each in declaration order; `tier` actions never
  // reach the bar at all. The measured split then takes from the tail.
  const { ordered, pinned, tierOnly } = splitByPriority(actions);
  const registerSplit = splitByPriority(register?.actions ?? []);

  // The tier exists regardless of overflow when the caller put something in it —
  // and "in it" now includes the register's own `tier` verbs, which spill into
  // this one tier rather than growing a second disclosure of their own.
  const tierAlwaysPresent =
    expansion !== undefined || tierOnly.length > 0 || registerSplit.tierOnly.length > 0;

  /*
   * The register's fit pass, run first because the action row's depends on it:
   * anything the register overflows makes the **More** control real, so the row
   * above has to pay for that control's width even when nothing of its own
   * overflowed. The dependency only goes this way — the register is measured
   * against its own box and never sees the action row's split — which is what
   * makes the two rows overflow independently.
   */
  const registerFit = useActionOverflow(registerSplit.ordered, {
    pinned: registerSplit.pinned,
    tierAlwaysPresent,
    tierOpen: open,
    refs: {
      band: bandRef,
      probe: registerProbeRef,
      sentinel: sentinelRef,
      cluster: registerAnchorRef,
      // The one **More**, in the action row: a register verb that overflows goes
      // behind it, so that is also where focus has to land when one does.
      more: moreRef,
    },
  });
  const registerInBar = registerSplit.ordered.slice(0, registerFit.inBar);
  const registerOverflowed = [
    ...registerSplit.ordered.slice(registerFit.inBar),
    ...registerSplit.tierOnly,
  ];

  const { inBar, compact, measuring } = useActionOverflow(ordered, {
    pinned,
    tierAlwaysPresent: tierAlwaysPresent || registerOverflowed.length > 0,
    tierOpen: open,
    refs: {
      band: bandRef,
      probe: probeRef,
      sentinel: sentinelRef,
      cluster: clusterRef,
      more: moreRef,
    },
  });

  const inBarActions = ordered.slice(0, inBar);
  const overflowed = [...ordered.slice(inBar), ...tierOnly, ...registerOverflowed];
  const hasTier = overflowed.length > 0 || expansion !== undefined;

  const band = (
    <div
      ref={bandRef}
      role="group"
      aria-label={ariaLabel}
      data-testid={testId}
      className={`
      dock-band
      ${
        sticky
          ? // `z-30` puts the band *above* the page header (`z-20`) and still below
            // the tab rail (`z-40`). Above the header because the merge's last move
            // is covering the header's 1px bottom border with the band's own top
            // edge, and at `z-10` the header simply painted over that cover — the
            // seam stayed visible at full merge. The two bands never overlap by more
            // than that 1px: the strip's `top` tracks `--header-h` live, so it stays
            // flush through the header's collapse.
            'sticky top-[var(--header-h,0px)] z-30'
          : ''
      }
      ${className}
    `
        .trim()
        .replace(/\s+/g, ' ')}
    >
      {/* The padding lives here rather than on the band, so the tier below can run
          the full width of the strip and draw its own separator edge to edge. */}
      <div ref={rowRef} className="flex flex-wrap items-center gap-2 p-2">
        {inBarActions.map((action) => (
          <Action key={action.id} action={action} compact={compact} />
        ))}

        {hasTier && (
          // A callback ref, because `Button` does not forward one: by the time this
          // runs the button is attached, so the query is safe and needs no effect.
          <span
            ref={(node) => {
              clusterRef.current = node;
              moreRef.current = node?.querySelector('button') ?? null;
            }}
            /*
             * `ms-auto` parks the whole cluster — separator and control together —
             * at the strip's trailing edge, so the rule reads as the boundary
             * between "the verbs" and "the way to the rest of them" wherever the
             * verbs happen to end. The separator is inside this span rather than a
             * sibling of it precisely so it cannot be left behind by that margin.
             * The row's `gap-2` still applies on top of the auto margin, so a full
             * row keeps its breathing room instead of butting the last verb
             * against the rule.
             */
            className="ms-auto inline-flex items-center"
          >
            <span aria-hidden="true" className="mx-1 w-px self-stretch bg-neutral-200" />
            <Button
              variant="ghost"
              size="sm"
              icon="chevron-down"
              iconPosition="right"
              onClick={toggle}
              expanded={open}
              controls={tierId}
              title={open ? 'Hide more actions' : 'Show more actions'}
              // Rotated, never swapped for another glyph: a label or icon that
              // changes with state changes the cluster's width, and the fit
              // arithmetic requires that width to be constant.
              className="[&_svg]:transition-transform [&_svg]:duration-(--dur-quick) aria-expanded:[&_svg]:rotate-180"
            >
              More
            </Button>
          </span>
        )}
      </div>

      {subRow !== undefined && (
        /* Same horizontal padding as the row above it and no rule between them:
           the two are one surface, and a hairline here would read as the tier
           opening. The tier's own `border-t` still separates *it* from this. */
        <div className="px-2 pb-2">{subRow}</div>
      )}

      {register !== undefined && (
        /*
         * The selection register: one tonal step below the band's white chrome
         * and separated from it by nothing else — no border, no rule, no divider.
         * Inset (`mx-2 mb-2`) and radiused so it reads as a well sunk into the
         * card rather than a second card stacked on it, and so its corners cannot
         * poke out past the band's own rounded chrome at rest.
         *
         * Rendered whenever the caller passes a register, empty or not: the row
         * holds its space in both states, so ticking the first row adds controls
         * to a row that already exists instead of pushing the list down under the
         * pointer that ticked it.
         */
        <div
          role="group"
          aria-label={register.ariaLabel}
          data-testid="action-bar-register"
          className="mx-2 mb-2 flex flex-wrap items-center gap-2 rounded-md bg-neutral-50 px-2 py-1.5"
        >
          <span
            ref={registerAnchorRef}
            aria-hidden="true"
            className="pointer-events-none absolute h-0 w-0"
          />
          {registerInBar.map((action) => (
            <Action
              key={action.id}
              action={action}
              compact={registerFit.compact}
              size={REGISTER_BUTTON_SIZE}
            />
          ))}
        </div>
      )}

      {hasTier && (
        /*
          `.disclose` animates `grid-template-rows` between 0fr and 1fr, so the strip's height
          animates with no JS measurement and without toggling `display`, which cannot be
          transitioned. Its direct child is the CSS-owned clipping row; the padding and the
          separator live one level further in so they are clipped with the content instead of
          holding the row open at 0fr.
        */
        <div id={tierId} className="disclose" data-open={open} inert={!open || undefined}>
          <div>
            <div className="space-y-3 border-t border-neutral-200 px-4 py-3">
              {overflowed.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {overflowed.map((action) => (
                    <Action key={action.id} action={action} variant="secondary" />
                  ))}
                </div>
              )}
              {overflowed.length > 0 && expansion !== undefined && (
                <div className="h-px bg-neutral-200" />
              )}
              {expansion}
            </div>
          </div>
        </div>
      )}

      {measuring && <MeasureProbe actions={ordered} cluster probeRef={probeRef} />}
      {/* Unconditional on `register`, so a strip without one still lets the second
          fit pass read its (empty) probe and settle instead of asking for a probe
          on every commit forever. */}
      {registerFit.measuring && (
        <MeasureProbe
          actions={registerSplit.ordered}
          cluster={false}
          probeRef={registerProbeRef}
          size={REGISTER_BUTTON_SIZE}
        />
      )}
    </div>
  );

  if (!sticky) return band;

  return (
    <>
      {/*
        The docking sentinel: a zero-size float sitting at the strip's *undocked* position,
        publishing the `--dock-progress` view timeline the merge is driven by. It must be a
        sibling of the band — `tailwind.css` hoists the timeline name to their shared parent
        with `timeline-scope`, because a named timeline is otherwise visible only to the
        declaring element's descendants. It floats so that being a sibling in a `space-y-*`
        rung costs no layout. See `.dock-sentinel` in `tailwind.css` for why not
        `position: absolute`, and why the timeline's inset has to subtract `--dock-offset`.
      */}
      <div ref={sentinelRef} aria-hidden="true" className="dock-sentinel" />
      {band}
    </>
  );
};

export default ActionBar;
