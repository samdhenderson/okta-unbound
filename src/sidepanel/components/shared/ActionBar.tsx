/**
 * @module sidepanel/components/shared/ActionBar
 * @description The page-level action strip of a detail view (ADR-0030).
 *
 * The rule it enforces: **a verb whose object is the whole page belongs here; a
 * verb scoped to one section's data belongs in that section's
 * `DetailSection.actions` slot.** Before this existed, "Compare" sat in the
 * group-memberships card header — structurally indistinguishable from "Add to
 * group", which acts on that card alone — so the page's most important action
 * read as a property of one section.
 *
 * ## Why it sticks
 *
 * The side panel has exactly one scroller: the `overflow-y-auto` app root
 * (`App.tsx`), which `TabPanel` shares and which the Users tab explicitly does
 * not shadow with a scroll box of its own. `sticky top-0` therefore pins against
 * that root, and no intermediate wrapper sets `overflow` to break it.
 *
 * It is the third band of the sticky stack (ADR-0032), so it parks below the two above it
 * rather than at the top of the scroller: `top` resolves to the tab rail's published height
 * plus the page header's. Both default to `0px`, so a story — or any surface with neither
 * band — behaves exactly as a `top-0` strip.
 *
 * That offset also fixes a real overlap. This strip and the rail were both `sticky top-0`
 * in one scroller, and the rail's `z-40` beat this strip's, so a pinned action strip was
 * rendering *underneath* the rail. The strip now sits at `z-30`: above the page header
 * (`z-20`) so it can cover that header's bottom border as it merges, and still below the
 * rail.
 *
 * The strip still carries an opaque background and its own border: pinned, it must not let
 * rows show through it.
 *
 * ## How it docks
 *
 * Reaching its parking spot is not the same as looking parked. A strip that stays a rounded,
 * inset card once pinned reads as "a card stopped moving", not "the strip joined the header" —
 * so a sticky strip merges into the band above it as you scroll. Over the first
 * `--merge-range` of scroll it bleeds out to the panel edges, loses its radius and its
 * top/side borders, covers the header's bottom seam and grows a shadow; header and strip end
 * up one continuous pinned surface with a single bottom edge.
 *
 * The mechanism is a CSS scroll-driven animation (`.dock-band` in `tailwind.css`), not a
 * transition on a stuck flag and not a scroll listener. It tracks the scroll position
 * directly, and it costs no per-frame JavaScript on the one shared scroller — the same reason
 * {@link sidepanel/hooks/useStuck.useStuck} is an `IntersectionObserver` rather than an
 * `onScroll` handler.
 *
 * Only the sticky strip merges. A `sticky={false}` strip never docks, so there is nothing for
 * it to dock *into*, and it keeps the plain card chrome.
 */
import React from 'react';

/** Props for {@link ActionBar}. */
export interface ActionBarProps {
  /**
   * The actions, as shared `Button`s. Order them by weight: exactly one
   * `variant="primary"` (the page's main verb), the rest `secondary`. Buttons
   * wrap onto a second line rather than shrinking, so a 360px panel never
   * produces a squeezed label.
   */
  children: React.ReactNode;
  /**
   * Accessible name for the group, e.g. `"Actions for Jane Doe"`. Required: a
   * bare group of buttons announces nothing about what it acts on, and a detail
   * page can hold more than one set of controls.
   */
  ariaLabel: string;
  /**
   * Pin below the bands above it — the tab rail and the page header — while the page
   * scrolls under it, merging into the header as it docks. Defaults to `true`; pass `false`
   * where the strip is already inside a fixed region (or in a story, where there is nothing
   * to scroll), which also opts out of the merge.
   */
  sticky?: boolean;
  /** Extra classes merged after the layout classes. */
  className?: string;
  /** Optional test handle. */
  testId?: string;
}

/**
 * The sticky strip of page-level actions, rendered directly beneath the header
 * and above the detail sections.
 *
 * @example
 * ```tsx
 * <ActionBar ariaLabel={`Actions for ${userDisplayName(user)}`}>
 *   <Button variant="primary" size="sm" icon="users" onClick={onCompare}>Compare</Button>
 *   <Button variant="secondary" size="sm" icon="plus" onClick={onAddToGroup}>Add to group</Button>
 * </ActionBar>
 * ```
 */
const ActionBar: React.FC<ActionBarProps> = ({
  children,
  ariaLabel,
  sticky = true,
  className = '',
  testId,
}) => (
  <div
    role="group"
    aria-label={ariaLabel}
    data-testid={testId}
    className={`
      flex flex-wrap items-center gap-2 p-2
      ${
        sticky
          ? // `dock-band` carries the background, border and radius on a pseudo-element so
            // it can bleed and flatten into the header without shifting the buttons.
            // `z-30` puts the band *above* the page header (`z-20`) and still below the tab
            // rail (`z-40`). Above the header because the merge's last move is covering the
            // header's 1px bottom border with the band's own top edge, and at `z-10` the
            // header simply painted over that cover — the seam stayed visible at full merge.
            // The two bands never overlap by more than that 1px: the strip's `top` tracks
            // `--header-h` live, so it stays flush through the header's collapse.
            'dock-band sticky top-[calc(var(--rail-h,0px)+var(--header-h,0px))] z-30'
          : 'rounded-md border border-neutral-200 bg-white'
      }
      ${className}
    `
      .trim()
      .replace(/\s+/g, ' ')}
  >
    {children}
  </div>
);

export default ActionBar;
