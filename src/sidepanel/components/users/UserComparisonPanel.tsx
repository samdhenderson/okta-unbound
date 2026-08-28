/**
 * @module sidepanel/components/users/UserComparisonPanel
 * @description View-stack host for the two-user comparison — the Users tab's mount site.
 *
 * The Users-tab comparison host, and since the Overview tab's dialog was
 * retired the only one. It owns the
 * {@link sidepanel/hooks/useUserComparison.useUserComparison} instance and renders
 * the shared {@link UserComparisonView} with no dialog chrome, because the tab shows
 * the comparison as a **pushed view** (ADR-0016) — one `PageHeader` above it carries
 * the title, the breadcrumb trail and the back affordance.
 *
 * It stays mounted while the tab is at the root of its view stack, exactly as the
 * browse body stays mounted while a view is pushed, so the comparison's own state is
 * cleared by `useUserComparison`'s reset effect rather than by an unmount, and so the
 * element focus is restored to on `pop` is still in the document. That makes two
 * obligations concrete, both of which are the host's to meet:
 *
 * - {@link UserComparisonPanelProps.isActive} — false while popped, which is what
 *   drives the reset. A stale comparison is otherwise exactly what a mounted view
 *   would show on the next push.
 * - {@link UserComparisonPanelProps.searchEnabled} — false while popped *or* while
 *   the whole tab is hidden, so a mounted comparison never becomes a background
 *   caller of the Okta user-search API (ADR-0018).
 *
 * ## Scroll offset
 *
 * Staying mounted preserves React state but not DOM state, and scroll offset is DOM
 * state. The comparison owns no scroll box: like the rest of the Users tab it scrolls
 * the app root scroller, the one `overflow-y-auto` element every root-scrolling tab
 * shares. So the rung you are *not* looking at is the one that last moved that
 * element — pushing Compare from a scrolled-down detail page used to open the
 * comparison part-way down, and returning to a comparison landed wherever the detail
 * page had left the shared scroller.
 *
 * This panel therefore runs its own {@link sidepanel/hooks/useScrollPreservation}
 * against that scroller, exactly as {@link TabPanel} does for a top-level tab: while
 * the comparison is on screen the hook mirrors `scrollTop` on a passive listener, and
 * on the way back it writes the comparison's own offset before paint. The hook's
 * `capture()` escape hatch is deliberately unused (as in `TabPanel`) — the state
 * update that hides this panel is the Users tab's `nav.pop()`, which this component
 * neither owns nor is told about, and the passive mirror is the hook's answer for
 * exactly that case. A first push has nothing banked, so it opens at the top.
 */
import React, { useLayoutEffect, useRef } from 'react';
import UserComparisonView from './UserComparisonView';
import { useUserComparison } from '../../hooks/useUserComparison';
import { useScrollPreservation } from '../../hooks/useScrollPreservation';
import type { OktaUser, GroupMembership } from '../../../shared/types';

/**
 * The nearest ancestor that actually scrolls, or `null` when nothing above the node
 * does.
 *
 * The scroller this panel lives in belongs to {@link sidepanel/App} and is several
 * components above it, so it is found by walking up from a node this panel owns —
 * the same "discover your scope from your own element" shape
 * {@link sidepanel/hooks/usePublishedHeight} uses for sticky bands, rather than a
 * hard-coded selector or a prop every host would have to thread through.
 *
 * @param node - The panel's own anchor element.
 * @returns The first ancestor whose computed `overflow-y` scrolls, else `null` — in
 * which case scroll preservation is simply inert (stories, jsdom without styles, a
 * future host that constrains nothing).
 */
function findScrollContainer(node: HTMLElement | null): HTMLElement | null {
  for (let el = node?.parentElement ?? null; el; el = el.parentElement) {
    const { overflowY } = window.getComputedStyle(el);
    if (overflowY === 'auto' || overflowY === 'scroll') return el;
  }
  return null;
}

/** Props for {@link UserComparisonPanel}. */
export interface UserComparisonPanelProps {
  /**
   * Whether a comparison view is currently pushed. Going false resets the
   * comparison, so the next push starts from a pristine search phase.
   */
  isActive: boolean;
  /**
   * Whether the debounced user search may reach Okta — i.e. the comparison is
   * pushed *and* the Users tab is the selected tab (ADR-0018).
   *
   * That predicate is also, exactly, "the comparison is the thing on screen", so it
   * is what gates the scroll mirror as well: the app root scroller is shared with
   * every other tab, and a mirror left attached while the tab is hidden would bank
   * whichever *other* tab's offset the admin scrolled to in between.
   */
  searchEnabled: boolean;
  /** The "context" user being compared from (the tab's selected user). */
  contextUser: OktaUser;
  /** The context user's group memberships, used as the left-hand comparison baseline. */
  contextGroups: GroupMembership[];
  /**
   * Okta org origin. Two uses: the deep link offered for a group the user must
   * *leave* (absent, the link simply does not render), and the cache/storage key
   * for the org profile schema and the admin's profile display configuration
   * behind the Attributes tab (absent, both fall back to defaults).
   */
  oktaOrigin?: string | null;
  /** Tab id of the Okta admin tab; API calls are scheduled against it. */
  targetTabId: number;
  /** Called after a group is copied onto the context user so the tab can refresh it. */
  onGroupsChanged: () => void;
  /**
   * Publishes a context-user profile save back to whoever owns that user.
   *
   * The context user is the Users tab's `selectedUser`, held in React state
   * rather than in the entity cache, so a save here is invisible to the rest of
   * the tab unless it is lifted. **Without this prop the left column is
   * deliberately read-only** — an edit that reached Okta with nothing to publish
   * it would leave both this panel and the Profile pane rendering values Okta no
   * longer holds, silently.
   */
  onContextUserUpdated?: (user: OktaUser) => void;
}

/**
 * Hosts the comparison surface inside the Users tab's view stack.
 *
 * @param props - See {@link UserComparisonPanelProps}.
 */
const UserComparisonPanel: React.FC<UserComparisonPanelProps> = ({
  isActive,
  searchEnabled,
  contextUser,
  contextGroups,
  oktaOrigin,
  targetTabId,
  onGroupsChanged,
  onContextUserUpdated,
}) => {
  const comparison = useUserComparison({
    isActive,
    searchEnabled,
    contextUser,
    contextGroups,
    targetTabId,
    // Also what keys the org profile schema and the admin's profile display
    // config behind the Attributes tab, not only the deep link below.
    oktaOrigin,
    onGroupsChanged,
    onContextUserUpdated,
  });

  // The anchor is a node this panel owns; the element whose offset is preserved is
  // the scroller above it (see the module header).
  const anchorRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  // Declared BEFORE `useScrollPreservation` so this layout effect runs first: the
  // hook reads `scrollRef.current` in a layout effect of its own, and on the very
  // first push that read is the one that restores. The scroller never changes for a
  // given mount, so this resolves once.
  useLayoutEffect(() => {
    scrollRef.current = findScrollContainer(anchorRef.current);
  }, []);
  // On screen = pushed *and* the tab shown — the same composition the Groups tab
  // uses for its list (`isActive && nav.isRoot`).
  useScrollPreservation(scrollRef, isActive && searchEnabled);

  return (
    <div ref={anchorRef}>
      <UserComparisonView
        contextUser={contextUser}
        comparison={comparison}
        oktaOrigin={oktaOrigin}
      />
    </div>
  );
};

export default UserComparisonPanel;
