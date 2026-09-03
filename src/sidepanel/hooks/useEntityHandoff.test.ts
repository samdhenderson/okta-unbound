/**
 * The handoff offer's contract (ADR-0069, generalising the Users tab's
 * detected-user banner).
 *
 * Three things are pinned, and the first two are the ones a shared affordance
 * gets wrong.
 *
 * **It covers every navigable kind, and refuses the rest without crashing.**
 * `PageType` carries `'admin'` and `'unknown'`, which have no entity behind
 * them at all, and the panel's reachability sets do not agree with each other —
 * `navigationHandlers` covers five kinds while `isLivePinnable` covers two. A
 * case per `PageType` asserts the offer is *absent*, not thrown, for each of
 * them.
 *
 * **It offers; it never navigates.** The banner it replaces was manual-load only
 * by design, so that admin navigation could not hijack the panel, and that
 * property has to survive being moved into the chrome.
 *
 * **Dismissal is per entity.** Declining hides the offer for that entity and
 * returns it for a different one. A permanently-dismissed affordance is a dead
 * feature; a re-nagging one is worse.
 *
 * Fixtures use only fake placeholders (`00gFAKE…`, `user@example.com`) per
 * CLAUDE.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEntityHandoff } from './useEntityHandoff';
import type { OktaPageContext, PageType } from './useOktaPageContext';
import type { JumpKind } from './useJumpResolver';

/** A connected page context with no entity on it. */
function pageContext(over: Partial<OktaPageContext> = {}): OktaPageContext {
  return {
    pageType: 'unknown',
    groupInfo: null,
    userInfo: null,
    appInfo: null,
    policyInfo: null,
    connectionStatus: 'connected',
    targetTabId: 1,
    error: null,
    isLoading: false,
    refetch: async () => {},
    oktaOrigin: 'https://example.okta.com',
    resyncPending: false,
    ...over,
  };
}

/** One connected page per `PageType`, and what (if anything) it should offer. */
const PAGES: Record<PageType, { page: OktaPageContext; offers: string | null }> = {
  group: {
    page: pageContext({
      pageType: 'group',
      groupInfo: { groupId: '00gFAKE0001', groupName: 'Payments Team' },
    }),
    offers: 'Payments Team',
  },
  user: {
    page: pageContext({
      pageType: 'user',
      userInfo: { userId: '00uFAKE0001', userName: 'user@example.com', userStatus: 'ACTIVE' },
    }),
    offers: 'user@example.com',
  },
  app: {
    page: pageContext({
      pageType: 'app',
      appInfo: { appId: '0oaFAKE0001', appName: 'Salesforce' },
    }),
    offers: 'Salesforce',
  },
  policy: {
    page: pageContext({
      pageType: 'policy',
      policyInfo: { policyId: 'rstFAKE0001', policyName: 'Default Policy' },
    }),
    offers: 'Default Policy',
  },
  // The two `PageType`s with no `EntityType` behind them. Neither may produce an
  // offer, and neither may throw reaching for an entity that is not there.
  admin: { page: pageContext({ pageType: 'admin' }), offers: null },
  unknown: { page: pageContext({ pageType: 'unknown' }), offers: null },
};

/** Everything reachable, nothing suppressed. */
function options(page: OktaPageContext, over: Record<string, unknown> = {}) {
  return {
    page,
    suppressed: false,
    canNavigateTo: () => true,
    navigateTo: vi.fn(),
    ...over,
  };
}

describe('useEntityHandoff', () => {
  describe('one case per PageType', () => {
    for (const [pageType, { page, offers }] of Object.entries(PAGES)) {
      it(`${offers === null ? 'offers nothing' : 'offers the entity'} on a ${pageType} page`, () => {
        const { result } = renderHook(() => useEntityHandoff(options(page)));

        if (offers === null) {
          expect(result.current.offer).toBeNull();
        } else {
          expect(result.current.offer?.name).toBe(offers);
          expect(result.current.offer?.kind).toBe(pageType);
        }
      });
    }
  });

  it('offers nothing while the probe has not landed — unknown is not the same as empty', () => {
    const { result } = renderHook(() =>
      useEntityHandoff(
        options(
          pageContext({
            pageType: 'group',
            groupInfo: { groupId: '00gFAKE0001', groupName: 'Payments Team' },
            connectionStatus: 'error',
            error: 'Content script is gone',
          }),
        ),
      ),
    );
    expect(result.current.offer).toBeNull();
  });

  it('offers nothing for a kind this build cannot reach', () => {
    // The affordance must not widen past what `navigationHandlers` honours: a
    // control that only refuses is worse than no control (ADR-0039).
    const { result } = renderHook(() =>
      useEntityHandoff(
        options(PAGES.policy.page, { canNavigateTo: (kind: JumpKind) => kind !== 'policy' }),
      ),
    );
    expect(result.current.offer).toBeNull();
  });

  it('is withheld while pinned, where the bar has its own switch hint', () => {
    const { result } = renderHook(() =>
      useEntityHandoff(options(PAGES.group.page, { suppressed: true })),
    );
    expect(result.current.offer).toBeNull();
  });

  it('offers; it does not navigate, until it is accepted', () => {
    const navigateTo = vi.fn();
    const { result } = renderHook(() => useEntityHandoff(options(PAGES.user.page, { navigateTo })));

    // Detection alone does nothing — the property that kept admin navigation
    // from hijacking the tab, carried over from the banner unchanged.
    expect(navigateTo).not.toHaveBeenCalled();

    act(() => result.current.accept());
    expect(navigateTo).toHaveBeenCalledWith('user', '00uFAKE0001');
    // And it stops offering what it has just opened.
    expect(result.current.offer).toBeNull();
  });

  describe('dismissal', () => {
    it('hides the offer for that entity, without navigating', () => {
      const navigateTo = vi.fn();
      const { result } = renderHook(() =>
        useEntityHandoff(options(PAGES.group.page, { navigateTo })),
      );

      act(() => result.current.dismiss());

      expect(result.current.offer).toBeNull();
      expect(navigateTo).not.toHaveBeenCalled();
    });

    it('returns when the live tab moves to a different entity', () => {
      const { result, rerender } = renderHook(
        ({ page }: { page: OktaPageContext }) => useEntityHandoff(options(page)),
        { initialProps: { page: PAGES.group.page } },
      );

      act(() => result.current.dismiss());
      expect(result.current.offer).toBeNull();

      // A different entity is a different question. This is the half that stops
      // the affordance being dead after one decline.
      rerender({
        page: pageContext({
          pageType: 'group',
          groupInfo: { groupId: '00gFAKE0002', groupName: 'Finance Team' },
        }),
      });
      expect(result.current.offer?.name).toBe('Finance Team');
    });

    it('stays dismissed while the live tab is still on the same entity', () => {
      const { result, rerender } = renderHook(
        ({ page }: { page: OktaPageContext }) => useEntityHandoff(options(page)),
        { initialProps: { page: PAGES.group.page } },
      );

      act(() => result.current.dismiss());
      // A fresh object for the same entity — a re-probe, not a navigation. The
      // record is keyed on the id, so it survives one.
      rerender({
        page: pageContext({
          pageType: 'group',
          groupInfo: { groupId: '00gFAKE0001', groupName: 'Payments Team' },
        }),
      });
      expect(result.current.offer).toBeNull();
    });
  });
});
