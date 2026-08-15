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
 * in one scroller, and the rail's `z-40` beat this strip's `z-10`, so a pinned action strip
 * was rendering *underneath* the rail.
 *
 * The strip still carries an opaque background and its own border: pinned, it must not let
 * rows show through it.
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
   * scrolls under it. Defaults to `true`; pass `false` where the strip is already inside a
   * fixed region (or in a story, where there is nothing to scroll).
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
      flex flex-wrap items-center gap-2
      rounded-md border border-neutral-200 bg-white p-2
      ${sticky ? 'sticky top-[calc(var(--rail-h,0px)+var(--header-h,0px))] z-10' : ''}
      ${className}
    `
      .trim()
      .replace(/\s+/g, ' ')}
  >
    {children}
  </div>
);

export default ActionBar;
