/**
 * @module sidepanel/components/shared/Tabs
 * @description Accessible tab bar with `underline`, `segmented` and `rail` variants.
 *
 * Renders the tab strip only — callers own the panels and toggle them on the
 * active key. Implements the ARIA tablist pattern (`role="tablist"`/`role="tab"`,
 * `aria-selected`, roving `tabindex`) with Left/Right/Home/End keyboard
 * navigation and automatic activation. Prefer this over hand-rolling tab bars: a
 * hand-rolled `role="tablist"` reliably ships the ARIA attributes and skips the
 * keyboard handling, which is a keyboard user reaching a strip they cannot move
 * inside.
 *
 * A tab may carry an `icon` (rendered before its label in every variant) and a
 * `count` badge, whose zero can be suppressed for a count that reports a
 * *finding* rather than a size (`countDisplay`). A `segmented` strip that cannot
 * fit one line in a 360px panel takes a second row with `wrap` instead of
 * truncating a label or dropping its glyphs.
 *
 * The `rail` variant is the side panel's top-level navigation: inactive tabs are
 * icon-only and the active tab's label unfurls (`grid-template-columns: 0fr → 1fr`),
 * which is what lets nine sections fit a panel the user can drag down to 360px. It
 * shares the tablist semantics, roving tabindex and keyboard handling verbatim; only
 * the container classes, the tab classes and the button children differ. Its overflow
 * affordances are measured by {@link sidepanel/hooks/useTabRail.useTabRail}, and its
 * slide and label unfurl are **sequenced** — see that hook's header.
 *
 * Its states are read from Odyssey, not invented: active is `Tabs`' 2px underline
 * plus `TypographyColorAction` text at `TypographyWeightBodyBold` and never a filled
 * block (that is `SideNav`'s, for a vertical rail); the hover wash and the inset
 * focus ring are `SideNav`'s.
 */
import React, { useRef } from 'react';
import Icon, { type IconType } from '../shared/Icon';
import StableWidth from './StableWidth';
import Tooltip, { type TooltipTriggerProps } from './Tooltip';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTabRail } from '../../hooks/useTabRail';

/** A single tab descriptor. */
export interface TabItem {
  /** Stable identity for the tab; matched against `activeKey`. */
  key: string;
  /**
   * Visible label. Under the `rail` variant this is also the tab's `aria-label`
   * and its `Tooltip` text, so it is the accessible name whether or not the label
   * is currently unfurled.
   *
   * @remarks Because `aria-label` overrides an element's contents, a rail tab's
   * `count` badge is **not** part of its accessible name. If counts are ever
   * shown on the rail, the label passed to `aria-label` must become
   * `` `${label}, ${count}` `` so screen-reader users hear the badge too.
   */
  label: string;
  /** Optional count rendered as a small badge after the label. */
  count?: number;
  /**
   * How a `count` of `0` is presented. `always` (the default) badges it, which
   * is right for a count that states a size — "0 groups" is an answer. `nonzero`
   * suppresses the badge instead, for a count that states a **finding** —
   * "0 differences" is nothing to report, not a fact worth a pill.
   *
   * Under `nonzero` the badge's slot is also held open at two digits from first
   * render ({@link StableWidth}), because such a count typically arrives with a
   * fetch: without the reservation the badge landing on three tabs at once
   * shoves each label sideways (ADR-0044, `D-053e`).
   */
  countDisplay?: TabCountDisplay;
  /**
   * Glyph from the shared {@link IconType} registry, rendered before the label
   * in every variant. Only `rail` treats it specially: there the icon is the
   * whole target until the tab is selected and its label unfurls, so a rail tab
   * without an icon falls back to a permanently visible label rather than
   * rendering as an empty target.
   */
  icon?: IconType;
}

/**
 * Whether a tab's `count` badge appears when the count is `0`. See
 * {@link TabItem.countDisplay}.
 */
export type TabCountDisplay = 'always' | 'nonzero';

/** Visual treatment for the tab strip. */
export type TabsVariant = 'underline' | 'segmented' | 'rail';

/** Props for {@link Tabs}. */
interface TabsProps {
  /** Tabs to render, in display order. */
  tabs: TabItem[];
  /** Key of the currently selected tab. */
  activeKey: string;
  /** Invoked with the newly selected tab key. */
  onChange: (key: string) => void;
  /**
   * `underline` (default) for section navigation; `segmented` for compact
   * toggles; `rail` for icon-first primary navigation that must survive a narrow
   * panel.
   */
  variant?: TabsVariant;
  /**
   * Let a `segmented` strip take a **second row** on a narrow panel: two equal
   * columns below `sm`, one equal-width row above it. Ignored by `underline` and
   * `rail`, which answer the same problem by scrolling.
   *
   * For a strip whose tabs cannot all fit one line in a 360px side panel. The
   * alternatives there are truncating a label (which hides the word the tab is
   * named for) or dropping the glyphs; a second row costs only height.
   */
  wrap?: boolean;
  /** Accessible label for the tablist (e.g. "User profile sections"). */
  ariaLabel?: string;
  /** Extra classes merged onto the tablist container. */
  className?: string;
}

const HEADING_FONT = { fontFamily: 'var(--font-heading)' };

/**
 * Container classes per variant. The rail hides its scrollbar (a visible one
 * eats vertical space in a 360px panel) and carries `mask-image` edge fades
 * keyed off the `data-overflow` attribute, so scrolling never writes a style.
 * `black`/`transparent` in those gradients are mask alpha stops, not colors.
 *
 * The rail deliberately has **no border of its own** — it was bordered above (by
 * `ContextBar`) *and* below, which detached it from both neighbours. It is one band
 * of the top-chrome slab now and `TabNavigation`'s `<nav>` carries the slab's single
 * closing rule; `underline` keeps its border, which is the indicator's own track.
 */
const SEGMENTED_CHROME =
  'items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-1';

/**
 * `segmented` under `wrap`: two equal columns below `sm`, then back to one row of
 * equal-width columns. `grid-flow-col` + `auto-cols-fr` reproduces `flex` +
 * `flex-1` without naming a column count, so the strip does not need a new class
 * when it grows a tab (a `sm:grid-cols-${n}` would not survive Tailwind's static
 * scan anyway).
 */
const SEGMENTED_WRAPPED_LAYOUT =
  'grid grid-cols-2 sm:grid-cols-none sm:auto-cols-fr sm:grid-flow-col';

const listClassesByVariant: Record<TabsVariant, string> = {
  segmented: `flex ${SEGMENTED_CHROME}`,
  underline:
    'flex items-center gap-1 border-b border-neutral-200 overflow-x-auto overflow-y-hidden',
  rail:
    'relative flex items-center gap-0.5 pb-1.5 overflow-x-auto overflow-y-hidden ' +
    '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden ' +
    'data-[overflow=start]:[mask-image:linear-gradient(to_right,transparent,black_1.5rem)] ' +
    'data-[overflow=end]:[mask-image:linear-gradient(to_left,transparent,black_1.5rem)] ' +
    'data-[overflow=both]:[mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%_-_1.5rem),transparent)]',
};

/**
 * Shared by every variant's tab button. Weight and focus are deliberately *not* here:
 * the rail follows Odyssey's navigation recipe (body weight inactive, bold active; an
 * inset ring), the other two the panel's own (uniform `font-semibold`; an outset
 * ring). Folding either in would make one override the other, and Tailwind class
 * order in a template string does not decide which wins.
 */
const TAB_BASE = 'relative flex items-center text-xs focus-visible:outline-none';

/** Focus treatment for the two non-rail variants: the panel's standard outset ring. */
const RING_FOCUS = 'focus-visible:ring-2 focus-visible:ring-primary';

/** The count pill, shared by every variant; only its colours vary. */
const BADGE_BASE =
  'inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none';

/** The two-digit floor a `nonzero` count's slot is held open at. */
const BADGE_RESERVE = 'inline-flex min-w-[18px] px-1.5 text-[10px] leading-none';

/**
 * Accessible tab bar. Selection is controlled by the caller via
 * `activeKey`/`onChange`; only the tab strip is rendered here.
 *
 * @example
 * ```tsx
 * <Tabs
 *   tabs={[{ key: 'account', label: 'Account' }, { key: 'org', label: 'Org' }]}
 *   activeKey={active}
 *   onChange={setActive}
 *   ariaLabel="User profile sections"
 * />
 * ```
 */
const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeKey,
  onChange,
  variant = 'underline',
  wrap = false,
  ariaLabel,
  className = '',
}) => {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const isSegmented = variant === 'segmented';
  const isRail = variant === 'rail';
  const reducedMotion = useReducedMotion();

  // The ref is attached only for `rail`, so every effect in the hook short-circuits
  // on a null node for the other variants — no conditional hook, no behavior change.
  const { edge, indicator, sliding } = useTabRail({
    listRef,
    activeKey,
    tabCount: tabs.length,
    reducedMotion,
  });

  // The roving anchor: the one tab in the page's tab order.
  //
  // Normally that is the selected tab. It falls back to the first tab when
  // `activeKey` matches nothing in this strip, which is a real state rather than
  // a bug — the panel's rail deliberately has no seat for the rail-hidden
  // sections (ADR-0063), so standing on one selects none of its tabs. Without
  // the fallback every tab would carry `tabIndex={-1}` and **the whole tablist
  // would drop out of the tab order**, leaving a keyboard user on such a section
  // with no way to Tab back into the nav. WAI-ARIA's tabs pattern requires
  // exactly one tab stop; this keeps that true when nothing is selected.
  //
  // `aria-selected` is deliberately *not* forced to match: the anchor is
  // focusable, not selected, and claiming otherwise would announce a tab the
  // reader is not on.
  const activeIndex = tabs.findIndex((tab) => tab.key === activeKey);
  const anchorIndex = activeIndex === -1 ? 0 : activeIndex;

  const focusTab = (index: number) => {
    const clamped = (index + tabs.length) % tabs.length;
    const tab = tabs[clamped];
    if (!tab) return;
    onChange(tab.key);
    buttonRefs.current[clamped]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        focusTab(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        focusTab(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusTab(0);
        break;
      case 'End':
        event.preventDefault();
        focusTab(tabs.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      ref={isRail ? listRef : undefined}
      data-overflow={isRail ? edge : undefined}
      className={`${
        isSegmented && wrap
          ? `${SEGMENTED_WRAPPED_LAYOUT} ${SEGMENTED_CHROME}`
          : listClassesByVariant[variant]
      } ${className}`}
    >
      {tabs.map((tab, index) => {
        const active = tab.key === activeKey;

        // Same padding as `underline` — the rail is a sibling of it, not its own
        // sizing system, and the wider target matters where an inactive tab is a bare
        // 16px icon. `rounded-md` all round now that the item sits on no border (6px
        // is Odyssey's `BorderRadiusMain`), and active text is `--color-primary-text`
        // (`TypographyColorAction`) — `--color-primary` is the fill hue, which on this
        // rail means the underline and nothing else.
        const railClasses = `${TAB_BASE} shrink-0 rounded-md px-3 py-2.5 transition-colors duration-(--dur-instant) focus-visible:inset-ring-2 focus-visible:inset-ring-primary ${
          active
            ? 'text-primary-text font-semibold'
            : 'font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
        }`;

        const tabClasses = isRail
          ? railClasses
          : isSegmented
            ? `${TAB_BASE} ${RING_FOCUS} flex-1 justify-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all duration-(--dur-instant) ${
                active
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`
            : `${TAB_BASE} ${RING_FOCUS} gap-1.5 whitespace-nowrap px-3 py-2.5 font-semibold border-b-2 transition-colors duration-(--dur-instant) ${
                active
                  ? 'text-primary border-primary'
                  : 'text-neutral-600 border-transparent hover:text-neutral-900'
              }`;

        const badgeClasses = isSegmented
          ? active
            ? 'bg-primary text-white'
            : 'bg-neutral-200 text-neutral-700'
          : active
            ? 'bg-primary-light text-primary-text'
            : 'bg-neutral-100 text-neutral-600';

        // A `nonzero` count with nothing to report renders no pill — but the slot
        // stays, because such a count lands with a fetch and three badges arriving
        // at once would otherwise shove three labels sideways in one frame
        // (ADR-0044, `D-053e`). Two digits are reserved rather than the current
        // value, so a badge that lands as `12` does not widen a slot measured at `0`.
        const pillClasses = `${BADGE_BASE} ${badgeClasses}`;
        const badge =
          tab.count === undefined ? null : tab.countDisplay === 'nonzero' ? (
            <StableWidth
              reserve={<span className={BADGE_RESERVE}>00</span>}
              align="center"
              className="ml-0.5 shrink-0"
            >
              {tab.count > 0 && <span className={pillClasses}>{tab.count}</span>}
            </StableWidth>
          ) : (
            <span className={`ml-0.5 ${pillClasses}`}>{tab.count}</span>
          );

        const renderTab = (trigger?: TooltipTriggerProps) => (
          <button
            key={tab.key}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            // Derived from `tab.label` rather than a separate prop so the visible
            // label and the accessible name cannot drift, and so an icon-only tab
            // still has a name for `button-name`. The tooltip below is *additive* —
            // it describes, the `aria-label` names.
            aria-label={isRail ? tab.label : undefined}
            tabIndex={index === anchorIndex ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={tabClasses}
            style={HEADING_FONT}
            {...trigger}
          >
            {isRail && tab.icon ? (
              <>
                <span aria-hidden="true" className="flex shrink-0 items-center">
                  <Icon type={tab.icon} size="sm" />
                </span>
                {/* Label unfurl: a 0fr → 1fr grid column animates to the label's
                    intrinsic width with no measurement and no `display` toggle. The
                    `--dur-move` delay is phase 2 of `useTabRail`'s sequence — it holds
                    the strip still while the underline slides, and both the collapsing
                    and the unfurling label carry it so they cross over together.
                    Dropped under reduced motion: the CSS freeze zeroes the duration
                    but not the delay, leaving a label 220ms late. */}
                <span
                  className={`grid transition-[grid-template-columns] duration-(--dur-move) ease-standard ${
                    reducedMotion ? '' : 'delay-(--dur-move)'
                  } ${active ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]'}`}
                >
                  <span className="min-w-0 overflow-hidden whitespace-nowrap ps-1.5">
                    {tab.label}
                  </span>
                </span>
              </>
            ) : (
              <>
                {/* Decorative in every variant but `rail`: the label is right beside
                    it, so announcing the glyph would only repeat the tab's name. */}
                {tab.icon && (
                  <span aria-hidden="true" className="flex shrink-0 items-center">
                    <Icon type={tab.icon} size="sm" />
                  </span>
                )}
                <span>{tab.label}</span>
              </>
            )}
            {badge}
          </button>
        );

        // Only the rail collapses a tab to a glyph, so only it needs a chip naming
        // one. `Tooltip` renders no wrapper of its own, which keeps these buttons
        // direct children of the tablist — an intervening `<span>` would break
        // `aria-required-children`.
        return isRail ? (
          <Tooltip key={tab.key} label={tab.label}>
            {renderTab}
          </Tooltip>
        ) : (
          renderTab()
        );
      })}
      {isRail && (
        // Inside the scrolling track, so it travels with the tabs and never needs
        // re-measuring on scroll. The transition applies *only* while `sliding` —
        // phase 1, when the labels' delay holds the strip still. Outside it the
        // geometry tracks a live reflow frame by frame, where a transition would lag
        // behind rather than describe it (the failure ADR-0028 avoided by never
        // transitioning at all). `--ease-glide` overshoots gently: over this short a
        // distance, right under the pointer, `--ease-affirm` reads as a wobble.
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary ${
            sliding ? 'transition-[left,width] duration-(--dur-move) ease-glide' : ''
          }`}
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
    </div>
  );
};

export default Tabs;
