/**
 * @module sidepanel/components/shared/Tabs
 * @description Accessible tab bar with `underline`, `segmented` and `rail` variants.
 *
 * Renders the tab strip only — callers own the panels and toggle them on the
 * active key. Implements the ARIA tablist pattern (`role="tablist"`/`role="tab"`,
 * `aria-selected`, roving `tabindex`) with Left/Right/Home/End keyboard
 * navigation and automatic activation. Prefer this over hand-rolling tab bars.
 *
 * The `rail` variant is the side panel's top-level navigation: inactive tabs are
 * icon-only and the active tab's label unfurls (`grid-template-columns: 0fr → 1fr`),
 * which is what lets eight sections fit a panel the user can drag down to 360px.
 * It shares the tablist semantics, roving tabindex and keyboard handling above
 * verbatim; only the container classes, the tab classes and the button children
 * differ. Its overflow affordances — edge fades, scroll-active-into-view and the
 * sliding indicator — are measured by
 * {@link sidepanel/hooks/useTabRail.useTabRail}.
 */
import React, { useRef } from 'react';
import Icon, { type IconType } from '../overview/shared/Icon';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTabRail } from '../../hooks/useTabRail';

/** A single tab descriptor. */
export interface TabItem {
  /** Stable identity for the tab; matched against `activeKey`. */
  key: string;
  /**
   * Visible label. Under the `rail` variant this is also the tab's `aria-label`
   * and `title`, so it is the accessible name whether or not the label is
   * currently unfurled.
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
   * Glyph for the `rail` variant, from the shared {@link IconType} registry.
   * Ignored by `underline` and `segmented`. A rail tab without an icon falls
   * back to a permanently visible label rather than rendering as an empty
   * target.
   */
  icon?: IconType;
}

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
 */
const listClassesByVariant: Record<TabsVariant, string> = {
  segmented: 'flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-1',
  underline:
    'flex items-center gap-1 border-b border-neutral-200 overflow-x-auto overflow-y-hidden',
  rail:
    'relative flex items-center gap-0.5 border-b border-neutral-200 overflow-x-auto overflow-y-hidden ' +
    '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden ' +
    'data-[overflow=start]:[mask-image:linear-gradient(to_right,transparent,black_1.5rem)] ' +
    'data-[overflow=end]:[mask-image:linear-gradient(to_left,transparent,black_1.5rem)] ' +
    'data-[overflow=both]:[mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%_-_1.5rem),transparent)]',
};

/** Shared by every variant's tab button. */
const TAB_BASE =
  'relative flex items-center text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

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
  const { edge, indicator } = useTabRail({
    listRef,
    activeKey,
    tabCount: tabs.length,
    reducedMotion,
  });

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
      className={`${listClassesByVariant[variant]} ${className}`}
    >
      {tabs.map((tab, index) => {
        const active = tab.key === activeKey;

        // Same padding as the `underline` variant — the rail is a sibling of it,
        // not its own sizing system. The wider target also matters here, where an
        // inactive tab is a bare 16px icon. Overflow past the panel edge is the
        // expected case, not a reason to shave padding: the edge masks and
        // scroll-active-into-view exist precisely to absorb it.
        const railClasses = `${TAB_BASE} shrink-0 rounded-t-md px-3 py-2.5 transition-colors duration-(--dur-instant) ${
          active ? 'text-primary' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
        }`;

        const tabClasses = isRail
          ? railClasses
          : isSegmented
            ? `${TAB_BASE} flex-1 justify-center gap-1.5 rounded-md px-3 py-1.5 transition-all duration-(--dur-instant) ${
                active
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`
            : `${TAB_BASE} gap-1.5 whitespace-nowrap px-3 py-2.5 border-b-2 transition-colors duration-(--dur-instant) ${
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

        return (
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
            // still has a name for `button-name`.
            aria-label={isRail ? tab.label : undefined}
            title={isRail ? tab.label : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={tabClasses}
            style={HEADING_FONT}
          >
            {isRail && tab.icon ? (
              <>
                <span aria-hidden="true" className="flex shrink-0 items-center">
                  <Icon type={tab.icon} size="sm" />
                </span>
                {/* Label unfurl: a 0fr → 1fr grid column animates to the label's
                    intrinsic width with no measurement and no `display` toggle,
                    so the strip never jumps to make room. */}
                <span
                  className={`grid transition-[grid-template-columns] duration-(--dur-move) ease-standard ${
                    active ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]'
                  }`}
                >
                  <span className="min-w-0 overflow-hidden whitespace-nowrap ps-1.5">
                    {tab.label}
                  </span>
                </span>
              </>
            ) : (
              <span>{tab.label}</span>
            )}
            {tab.count !== undefined && (
              <span
                className={`ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none ${badgeClasses}`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
      {isRail && (
        // Inside the scrolling track, so it travels with the tabs and never needs
        // re-measuring on scroll. Deliberately un-transitioned: the active label is
        // growing over the same interval, so a transitioned indicator would chase a
        // moving target — the slide comes from the buttons' own reflow instead.
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
    </div>
  );
};

export default Tabs;
