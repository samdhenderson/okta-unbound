/**
 * @module sidepanel/App
 * @description Root side-panel component: wires page context to the tabbed UI shell.
 *
 * Owns the active-tab selection (persisted to `chrome.storage.local` with legacy-tab
 * migration) and the highlighted rule id. Reads live Okta page context from the
 * panel's single `useOktaPageContext` engine (narrowed for the feature tabs by
 * `useGroupContext`) and renders the {@link ContextBar} masthead
 * (app wordmark + entity identity + connection), {@link TabNavigation}, the per-tab
 * content, the fixed {@link ActivityBar} (the unified scheduler + progress bar), the
 * ⌘K {@link CommandPalette}, and the modal layer every `Modal` overlay portals into
 * ({@link MODAL_LAYER_ID}), all inside the SchedulerProvider. Between the masthead
 * and the rail it also mounts the single session-expiry banner (ADR-0054): a 401
 * is a property of the connection, so it is stated once here rather than as a
 * failed-request error state on each of nine surfaces.
 *
 * The shell is also the **single owner of app-wide keyboard shortcuts**
 * ({@link useCommandPalette}) — see the tab-lifetime note below for why a `window`
 * listener may not live in a tab.
 *
 * ## Tab lifetime
 *
 * A tab **mounts on its first activation and stays mounted from then on**; the
 * inactive ones are hidden with the shared `.tab-content` rule rather than
 * unmounted. Unmounting used to destroy everything component-local — the Groups
 * tab's pushed detail view, its filters, selection, loaded window, scroll offset
 * and per-row expansion — so leaving a tab and coming back lost the user's place.
 * `React.lazy` is unaffected: a never-visited tab still costs no chunk.
 *
 * Nine live tabs mean nine sets of live effects, so **every tab is told whether
 * it is active** and gates its own background work on it (auto-loads, page-context
 * re-probes, debounced search, window listeners). No hidden tab may issue Okta API
 * traffic.
 *
 * The masthead is the exception, and deliberately so. `useOktaPageContext` below
 * is ungated by tab, because {@link ContextBar} renders above the rail on *every*
 * tab: gating its feed on one of them would leave it describing a page the browser
 * left minutes ago from the other eight — the ADR-0032 defect where the bar
 * misdescribes the live page. ADR-0018's rule is that no hidden **tab** issues
 * Okta traffic; the masthead is shell chrome, which is why the context engine has
 * always been always-on. ADR-0026's visibility gate still applies and lives inside
 * `useOktaTabContext` itself (`document.hidden` defers and resyncs), so a hidden
 * panel still probes nothing.
 *
 * ## One context engine (ADR-0058)
 *
 * There is exactly **one** `useOktaTabContext` instance in the panel, reached
 * through `useOktaPageContext`. `App` used to run two — a group-specific one
 * feeding every tab's `targetTabId`/`oktaOrigin`, and a page-classifying one
 * feeding the masthead — which meant a second `getOktaOrigin` plus a second entity
 * probe on every navigation, and two latches that could in principle disagree
 * about which tab was live. `useGroupContext` is now a selector over the single
 * engine's result.
 *
 * The pin moved with it. Suspending detection while pinned is no longer available:
 * the same engine now carries the connection health the pinned masthead must keep
 * reporting honestly. So the pin is applied here, where identity is *selected* —
 * `effective` and `deriveTabContext` already read the frozen snapshot in
 * preference to the live one — and "the live tab moved" is derived by comparing
 * live detection against the snapshot rather than inferred from a suppressed
 * engine's owed resync.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef, lazy } from 'react';
import ContextBar from './components/ContextBar';
import AlertMessage from './components/shared/AlertMessage';
import PageHeader from './components/shared/PageHeader';
import { MODAL_LAYER_ID } from './components/shared/Modal';
import TabNavigation from './components/TabNavigation';
import TabPanel from './components/TabPanel';
import CommandPalette from './components/CommandPalette';
import { useCommandPalette } from './hooks/useCommandPalette';
import { migrateLegacyTabId, type TabType } from './tabs';
import HomeTab from './components/HomeTab';
import type { ExportRequest } from './components/export';
import type { GroupDetailTab } from './components/groups/detail/GroupDetailView';
import { viewFor, type ListViewRequest, type ListViewTab } from './listViewRequest';
import ActivityBar from './components/ActivityBar';

// Code-split the non-default tabs so the initial side-panel load only ships the
// Home tab (the default tab). Each import lands in its own chunk, fetched on
// first activation of that tab; that tab's own Suspense boundary (inside
// `TabPanel`) shows the standard spinner during the one-time fetch, without
// disturbing the tabs already mounted beside it. ExportTab is a named export from
// its barrel, so it is re-shaped into a default export for React.lazy.
const RulesTab = lazy(() => import('./components/RulesTab'));
const UsersTab = lazy(() => import('./components/UsersTab'));
const GroupsTab = lazy(() => import('./components/GroupsTab'));
const AppsTab = lazy(() => import('./components/AppsTab'));
const AuthPoliciesTab = lazy(() => import('./components/AuthPoliciesTab'));
const ExportTab = lazy(() => import('./components/export').then((m) => ({ default: m.ExportTab })));
const ApiExplorerTab = lazy(() => import('./components/ApiExplorerTab'));
const AuditLogViewer = lazy(() => import('./components/AuditLogViewer'));
import { useGroupContext } from './hooks/useGroupContext';
import { useOktaPageContext } from './hooks/useOktaPageContext';
import { useSessionExpiry } from './hooks/useSessionExpiry';
import { SchedulerProvider } from './contexts/SchedulerContext';
import { NavigationProvider } from './contexts/NavigationContext';
import {
  deriveTabContext,
  revalidatePinnedContext,
  type PinnablePageType,
  type PinnedContext,
} from './pinContext';
import type { OktaPageContext } from './hooks/useOktaPageContext';

/** Storage key under which the last-active tab is persisted in `chrome.storage.local`. */
const SELECTED_TAB_KEY = 'okta_unbound_selected_tab';
/** Storage key under which the pinned context snapshot is persisted. */
const PINNED_CONTEXT_KEY = 'okta_unbound_pinned_context';

/** The entity a live page context is showing, when it is one a pin could hold. */
interface LiveIdentity {
  pageType: PinnablePageType;
  id: string;
  name: string;
}

/**
 * Reduce a live page context to the pinnable entity it describes.
 *
 * @param page - The engine's current detection.
 * @returns The group/user on screen, or `null` when the live tab is on anything
 *   else (an app, a policy, a plain admin page — or a page nothing is known about
 *   because the probe failed).
 */
function liveIdentityOf(page: OktaPageContext): LiveIdentity | null {
  if (page.connectionStatus !== 'connected') return null;
  if (page.pageType === 'group' && page.groupInfo) {
    return { pageType: 'group', id: page.groupInfo.groupId, name: page.groupInfo.groupName };
  }
  if (page.pageType === 'user' && page.userInfo) {
    return { pageType: 'user', id: page.userInfo.userId, name: page.userInfo.userName };
  }
  return null;
}

/** The id a pin is holding, whichever entity kind it holds. */
function pinnedEntityId(pinned: PinnedContext): string | undefined {
  return pinned.pageType === 'group' ? pinned.groupInfo?.groupId : pinned.userInfo?.userId;
}

/**
 * Has the live Okta tab left the pinned entity?
 *
 * Derived by comparing live detection against the snapshot, rather than read off
 * the engine's `resyncPending`. Under two engines the pinned one was suspended, so
 * "a navigation was observed while suppressed" was the only signal available; the
 * single engine never suspends, so the honest question is simply whether what it
 * currently sees is still what the pin froze (ADR-0058). Answered only from a
 * probe that landed — a dead content script means the live page is unknown, which
 * is not the same statement as "it moved".
 *
 * @param pinned - The active pin, or `null` when following the live tab.
 * @param live - The live pinnable entity, from {@link liveIdentityOf}.
 * @returns `true` only while pinned and the live tab is demonstrably elsewhere.
 */
function hasLiveContextMoved(pinned: PinnedContext | null, live: LiveIdentity | null): boolean {
  if (!pinned) return false;
  if (live === null) return false;
  return live.pageType !== pinned.pageType || live.id !== pinnedEntityId(pinned);
}

/**
 * Root application shell for the Okta Unbound side panel.
 *
 * Restores the saved tab on mount (migrating retired tab ids such as
 * `dashboard`/`operations`/`undo` to their current equivalents), routes tab
 * changes, and supports cross-tab navigation to a specific rule via
 * `handleNavigateToRule`.
 */
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [groupNav, setGroupNav] = useState<{ id: string; pane?: GroupDetailTab } | null>(null);
  // A one-shot request to open a specific user in the Users tab (e.g. from the
  // a jump into a user); cleared by the tab once consumed.
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // One-shot requests to open a specific app or policy on its own tab (from the
  // ⌘K palette's entity search); cleared by the tab once consumed.
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  // A one-shot request to open the Export tab pre-scoped (e.g. from the group
  // a detail rung's export action); cleared by the tab once consumed.
  const [exportRequest, setExportRequest] = useState<ExportRequest | null>(null);
  const [listViewRequest, setListViewRequest] = useState<ListViewRequest | null>(null);
  // The pinned snapshot (null = following the live tab). Persisted across reopen.
  const [pinned, setPinned] = useState<PinnedContext | null>(null);
  const isPinned = pinned !== null;
  // Tabs that have been activated at least once, and are therefore mounted. Kept
  // as state (not a ref) so first activation triggers the render that mounts the
  // tab; every path that sets `activeTab` funnels through the effect below, so
  // deep links and the persisted-tab restore mount their target too.
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<TabType>>(
    () => new Set<TabType>(['home']),
  );
  useEffect(() => {
    setMountedTabs((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);

  // The one element that actually scrolls (see the JSX below). Handed to every
  // `TabPanel` so each can bank and restore its own offset on it.
  const scrollRootRef = useRef<HTMLDivElement>(null);

  // The ⌘K jump-to palette. The shortcut listener lives here, in the shell, and
  // nowhere else: every tab is mounted at once (ADR-0018), so the same `window`
  // listener registered inside a tab would be registered up to eight times and
  // fire once per mounted tab.
  const jumpPalette = useCommandPalette();

  // The panel's one page-context engine (ADR-0058): one tab lookup, one
  // `getOktaOrigin`, one entity probe and one connection latch per navigation,
  // feeding both the ContextBar masthead and every feature tab. Always on — see
  // the module header for why it is neither tab-gated nor pin-gated.
  const page = useOktaPageContext();
  // The same engine, narrowed to "the group on screen" for tab targeting and
  // connection health. A pure selector, not a second probe.
  const { groupInfo, connectionStatus, targetTabId, error, isLoading, oktaOrigin } =
    useGroupContext(page);

  // Restore a persisted pin on mount. The snapshot's `targetTabId` is a per-session
  // Chrome id, so it is revalidated before use: it may be re-targeted at a live Okta
  // tab, or the pin dropped entirely when the browser has no Okta tab open.
  useEffect(() => {
    chrome.storage.local.get([PINNED_CONTEXT_KEY], (result) => {
      const saved = result[PINNED_CONTEXT_KEY] as PinnedContext | undefined;
      if (!saved) return;
      void revalidatePinnedContext(saved).then((revalidated) => {
        if (!revalidated) {
          chrome.storage.local.remove(PINNED_CONTEXT_KEY);
          return;
        }
        setPinned(revalidated);
        if (revalidated.targetTabId !== saved.targetTabId) {
          chrome.storage.local.set({ [PINNED_CONTEXT_KEY]: revalidated });
        }
      });
    });
  }, []);

  // The identity shown in the bar: the pinned snapshot, or live detection.
  const isLivePinnable = page.pageType === 'group' || page.pageType === 'user';
  const effective = pinned
    ? {
        pageType: pinned.pageType,
        groupInfo: pinned.groupInfo,
        userInfo: pinned.userInfo,
        targetTabId: pinned.targetTabId as number | null,
        oktaOrigin: pinned.oktaOrigin,
        // Identity stays frozen, but connection health must not: a pinned panel
        // reporting a permanent green "connected" hid genuinely dead sessions.
        // These come from the always-on engine, which keeps probing while pinned —
        // which is precisely why the pin can no longer be expressed as
        // `enabled: false` on it (ADR-0058).
        connectionStatus,
        error,
        isLoading: false,
      }
    : {
        pageType: page.pageType,
        groupInfo: page.groupInfo,
        userInfo: page.userInfo,
        targetTabId: page.targetTabId,
        oktaOrigin: page.oktaOrigin,
        connectionStatus: page.connectionStatus,
        error: page.error,
        isLoading: page.isLoading,
      };

  // The context the feature tabs operate on. When pinned it follows the frozen
  // snapshot (so "View Rules"/exports target the pinned entity, not whatever the
  // live tab drifted to); otherwise it follows the live always-on tab context.
  const tabContext = deriveTabContext(pinned, { targetTabId, groupInfo, oktaOrigin });

  const entityName =
    effective.pageType === 'group'
      ? (effective.groupInfo?.groupName ?? undefined)
      : effective.pageType === 'user'
        ? (effective.userInfo?.userName ?? undefined)
        : effective.pageType === 'app'
          ? (page.appInfo?.appName ?? undefined)
          : effective.pageType === 'policy'
            ? (page.policyInfo?.policyName ?? undefined)
            : undefined;

  // While pinned, what the live tab has drifted to — the masthead's "live tab
  // moved to X / Unpin & switch" hint. The engine keeps detecting while pinned, so
  // the hint can now name the entity instead of only announcing that something
  // changed.
  const liveIdentity = liveIdentityOf(page);
  const liveContextChanged = hasLiveContextMoved(pinned, liveIdentity);

  const handleTogglePin = () => {
    if (pinned) {
      setPinned(null);
      chrome.storage.local.remove(PINNED_CONTEXT_KEY);
      return;
    }
    if (isLivePinnable && page.targetTabId != null) {
      const snapshot: PinnedContext = {
        pageType: page.pageType as 'group' | 'user',
        groupInfo: page.groupInfo,
        userInfo: page.userInfo,
        targetTabId: page.targetTabId,
        oktaOrigin: page.oktaOrigin,
      };
      setPinned(snapshot);
      chrome.storage.local.set({ [PINNED_CONTEXT_KEY]: snapshot });
    }
  };

  // Re-probe the context engine. There is one, so there is one thing to nudge:
  // the recovery affordances used to reach only the masthead's engine, leaving a
  // latched `error` on the always-on one with no manual exit and the bar stuck on
  // "Disconnected" forever. Fired and voided — the hook owns its own error
  // handling and never rejects.
  const refetchPageContext = page.refetch;
  const handleRefreshAll = useCallback(() => {
    void refetchPageContext();
  }, [refetchPageContext]);

  // Reconnect: reload the Okta tab so a fresh content script is injected, then
  // re-detect. Used when the connection is genuinely down (e.g. the script was
  // orphaned by an extension reload). Needs no extra permission — reloading a
  // host we already have permission for is allowed. The onUpdated('complete')
  // listeners re-probe once the page reloads; refetch nudges it along.
  const handleReconnect = () => {
    if (targetTabId != null) {
      chrome.tabs.reload(targetTabId, {}, () => {
        void chrome.runtime.lastError; // tab may be gone; ignore
        handleRefreshAll();
      });
    } else {
      handleRefreshAll();
    }
  };

  // Load saved tab preference on mount with legacy migration
  useEffect(() => {
    chrome.storage.local.get([SELECTED_TAB_KEY], (result) => {
      if (result[SELECTED_TAB_KEY]) {
        const savedTab = result[SELECTED_TAB_KEY] as string;
        const migratedTab = migrateLegacyTabId(savedTab);

        setActiveTab(migratedTab);
        if (migratedTab !== savedTab) {
          chrome.storage.local.set({ [SELECTED_TAB_KEY]: migratedTab });
        }
      }
    });
  }, []);

  const handleTabChange = (tab: TabType, selectedRuleId?: string) => {
    setActiveTab(tab);
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: tab });

    if (tab === 'rules' && selectedRuleId) {
      setSelectedRuleId(selectedRuleId);
    }
  };

  // The five cross-entity jumps. Wrapped in `useCallback` (they close over
  // nothing but stable setters) so the `navigationHandlers` object below keeps a
  // stable identity — `NavigationProvider` memoizes on it, and every `EntityLink`
  // in the tree consumes that memo.
  const handleNavigateToRule = useCallback((ruleId: string) => {
    setSelectedRuleId(ruleId);
    setActiveTab('rules');
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: 'rules' });
  }, []);

  // `pane` opens the group *at* a detail rung (Home's MFA launcher asks for
  // `'insights'`); every other caller omits it and lands on the row as before.
  const handleNavigateToGroup = useCallback((groupId: string, pane?: GroupDetailTab) => {
    setGroupNav({ id: groupId, pane });
    setActiveTab('groups');
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: 'groups' });
  }, []);

  const handleNavigateToUser = useCallback((userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('users');
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: 'users' });
  }, []);

  const handleNavigateToApp = useCallback((appId: string) => {
    setSelectedAppId(appId);
    setActiveTab('apps');
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: 'apps' });
  }, []);

  const handleNavigateToPolicy = useCallback((policyId: string) => {
    setSelectedPolicyId(policyId);
    setActiveTab('policies');
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: 'policies' });
  }, []);

  /**
   * What `EntityLink` can reach. Every `EntityType` now has a handler.
   *
   * `app` and `policy` were deliberately absent until the ⌘K palette started
   * searching them: a searchable kind with no destination is a row that only
   * refuses, which is worse than no row (ADR-0039). Both tabs are flat filtered
   * lists rather than detail rungs, so "navigating" to one means arriving with
   * the list filtered to it — a real destination, not a fabricated detail page.
   * Every app chip and policy chip in the tree upgrades from plain text to a
   * live control as a consequence, which is the point rather than a side effect.
   */
  const navigationHandlers = useMemo(
    () => ({
      rule: handleNavigateToRule,
      group: handleNavigateToGroup,
      user: handleNavigateToUser,
      app: handleNavigateToApp,
      policy: handleNavigateToPolicy,
    }),
    [
      handleNavigateToRule,
      handleNavigateToGroup,
      handleNavigateToUser,
      handleNavigateToApp,
      handleNavigateToPolicy,
    ],
  );

  // Open the Export tab pre-scoped to a descriptor + context entity (deep-linked
  // from an entity's page-level export action).
  const handleNavigateToExport = (request: ExportRequest) => {
    setExportRequest(request);
    setActiveTab('export');
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: 'export' });
  };

  const handleExportGroup = (groupId: string, groupName: string) =>
    handleNavigateToExport({
      descriptorId: 'group-memberships',
      contextId: groupId,
      contextLabel: groupName,
    });

  /**
   * The Rules rung's *Export rules* verb.
   *
   * No context id: the Group Rules descriptor is whole-org and carries
   * `filter: { kind: 'none' }`, so it fetches its own rows rather than exporting whatever
   * the Rules tab happens to have loaded. That is why the strip never disables the verb.
   */
  const handleExportRules = () => handleNavigateToExport({ descriptorId: 'group-rules' });

  /**
   * Open a list tab with one filter already applied — how the Home card's
   * sub-counts ("31 empty", "4 paused") turn into the list they describe.
   *
   * Stable, because `HomeTab` holds it across renders. The tab clears the
   * request through its own `onListViewConsumed`, so nothing here persists.
   */
  const handleOpenListView = useCallback((request: ListViewRequest) => {
    setListViewRequest(request);
    setActiveTab(request.tab);
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: request.tab });
  }, []);

  const clearListViewRequest = useCallback(() => setListViewRequest(null), []);

  /**
   * Open a list tab unfiltered — the org card's headline counts. Deliberately
   * clears any pending request: pressing "214 groups" asks for the whole list,
   * and arriving on a filter left over from a sub-count press would be the
   * opposite of what was asked for.
   */
  const handleOpenTab = useCallback((tab: ListViewTab) => {
    setListViewRequest(null);
    setActiveTab(tab);
    chrome.storage.local.set({ [SELECTED_TAB_KEY]: tab });
  }, []);

  /**
   * Render one tab panel: nothing until the tab has been activated once, then a
   * permanently mounted {@link TabPanel} — visibility, its own Suspense boundary,
   * and its own slice of the shared root scroller's offset all live in there.
   *
   * @param tab - The tab this panel hosts.
   * @param content - Builds the tab's element, given whether it is currently active.
   */
  const renderTabPanel = (tab: TabType, content: (isActive: boolean) => React.ReactNode) => {
    if (!mountedTabs.has(tab)) return null;
    const isActive = tab === activeTab;
    return (
      <TabPanel isActive={isActive} scrollRef={scrollRootRef}>
        {content(isActive)}
      </TabPanel>
    );
  };

  return (
    <SchedulerProvider>
      {/* Publishes the cross-entity jumps above to the whole tree, so an
          `EntityLink` at any depth can navigate without a prop chain (ADR-0030). */}
      <NavigationProvider handlers={navigationHandlers}>
        {/* The shell does not scroll. It is a full-height flex column holding the
          top chrome and, below it, the one scroller (ADR-0032 §"the chrome is not
          in the scroller"). The scrollbar therefore starts where the content does
          instead of running the full panel height beside `ContextBar` and the tab
          rail — the classic-scrollbar channel a Chrome side panel gets is ~15px,
          and reserving it across bands that never scroll took that width off every
          band for nothing. */}
        <div className="flex flex-col h-screen overflow-hidden bg-canvas">
          <ContextBar
            pageType={effective.pageType}
            entityName={entityName}
            connectionStatus={connectionStatus}
            isLoading={isLoading}
            error={error}
            isPinned={isPinned}
            canPin={isLivePinnable}
            liveContextChanged={liveContextChanged}
            liveEntityName={liveIdentity?.name}
            onTogglePin={handleTogglePin}
            onRefresh={handleRefreshAll}
            onReconnect={handleReconnect}
          />

          {/* One statement, once, for a fact that belongs to the connection
              rather than to any one surface (ADR-0054 §3). It sits beside
              `ContextBar` because that is where the connection is already
              described — a per-surface error state would multiply one expired
              session into nine, which is the defect `D-007b` names. */}
          <SessionExpiryNotice targetTabId={tabContext.targetTabId ?? null} />

          {/* The rail's trailing ⌘K button is the only visible route to the two
              rail-hidden sections (ADR-0063), so it opens the same palette state
              the chord toggles — `open`, not a second `useCommandPalette()`. */}
          <TabNavigation
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onOpenCommandPalette={jumpPalette.open}
          />

          {/* `flex-1 min-h-0` + `overflow-y-auto` make *this* div the scroller, not
            the document and not the shell — every root-scrolling tab shares it,
            which is why each `TabPanel` needs the ref to preserve its own offset
            across a tab switch. `min-h-0` because a flex item's default
            `min-height: auto` would let it grow past the shell rather than scroll.

            `overflow-anchor: none` because scroll anchoring and the sticky stack are
            incompatible here (ADR-0032). A pinned `PageHeader` deliberately collapses its
            identity region, losing ~72px *above* the viewport; Chrome's scroll anchoring
            reads that as content shifting under the user and compensates by pulling
            `scrollTop` back — far enough, on a small scroll, to un-pin the header, which
            re-expands the region, which restores the height, which re-pins it. The panel
            visibly grew and shrank in a loop for anyone scrolling slowly. Anchoring exists
            to absorb *unintended* reflow above the fold; every height change in this
            scroller is intentional and driven by scroll position, so there is nothing here
            for it to usefully protect. */}
          <div
            ref={scrollRootRef}
            data-testid="app-scroll-root"
            className="flex flex-col flex-1 min-h-0 overflow-y-auto [overflow-anchor:none] pb-14"
          >
            {/* Each tab mounts on first activation and is hidden — never unmounted —
              thereafter, so its local state survives leaving the tab. */}
            {renderTabPanel('home', (isActive) => (
              <HomeTab
                isActive={isActive}
                targetTabId={tabContext.targetTabId ?? null}
                oktaOrigin={tabContext.oktaOrigin ?? undefined}
                onOpenListView={handleOpenListView}
                onOpenTab={handleOpenTab}
                onScanGroupMfa={(id) => handleNavigateToGroup(id, 'insights')}
              />
            ))}
            {renderTabPanel('rules', (isActive) => (
              <RulesTab
                isActive={isActive}
                targetTabId={tabContext.targetTabId ?? undefined}
                currentGroupId={tabContext.currentGroupId}
                oktaOrigin={tabContext.oktaOrigin ?? undefined}
                selectedRuleId={selectedRuleId}
                onRuleSelected={() => setSelectedRuleId(null)}
                onNavigateToGroup={handleNavigateToGroup}
                onExportRules={handleExportRules}
                scrollRootRef={scrollRootRef}
                listView={viewFor(listViewRequest, 'rules')}
                onListViewConsumed={clearListViewRequest}
              />
            ))}
            {renderTabPanel('users', (isActive) => (
              <UsersTab
                isActive={isActive}
                targetTabId={tabContext.targetTabId ?? undefined}
                currentGroupId={tabContext.currentGroupId}
                selectedUserId={selectedUserId}
                onUserSelected={() => setSelectedUserId(null)}
              />
            ))}
            {renderTabPanel('groups', (isActive) => (
              <GroupsTab
                isActive={isActive}
                // The rung's list scrolls this, not a box of its own, so the
                // offset that has to survive a push into a group's detail view
                // lives here (ADR-0051 §5).
                scrollRootRef={scrollRootRef}
                targetTabId={tabContext.targetTabId ?? null}
                oktaOrigin={tabContext.oktaOrigin ?? undefined}
                onNavigateToRule={handleNavigateToRule}
                selectedGroupId={groupNav?.id ?? null}
                selectedGroupPane={groupNav?.pane}
                onGroupSelected={() => setGroupNav(null)}
                // The descriptor-driven Export Engine route (ADR-0030). Without
                // it the drilled-in group's "Export members" greys itself out.
                onExportGroup={handleExportGroup}
                listView={viewFor(listViewRequest, 'groups')}
                onListViewConsumed={clearListViewRequest}
              />
            ))}
            {renderTabPanel('apps', (isActive) => (
              <AppsTab
                isActive={isActive}
                targetTabId={tabContext.targetTabId ?? null}
                oktaOrigin={tabContext.oktaOrigin ?? undefined}
                listView={viewFor(listViewRequest, 'apps')}
                onListViewConsumed={clearListViewRequest}
                selectedAppId={selectedAppId}
                onAppSelected={() => setSelectedAppId(null)}
              />
            ))}
            {renderTabPanel('policies', (isActive) => (
              <AuthPoliciesTab
                isActive={isActive}
                targetTabId={tabContext.targetTabId ?? undefined}
                oktaOrigin={tabContext.oktaOrigin ?? undefined}
                selectedPolicyId={selectedPolicyId}
                onPolicySelected={() => setSelectedPolicyId(null)}
              />
            ))}
            {renderTabPanel('export', (isActive) => (
              <ExportTab
                isActive={isActive}
                targetTabId={tabContext.targetTabId ?? undefined}
                oktaOrigin={tabContext.oktaOrigin ?? undefined}
                exportRequest={exportRequest}
                onExportRequestConsumed={() => setExportRequest(null)}
              />
            ))}
            {renderTabPanel('explorer', () => (
              <ApiExplorerTab
                targetTabId={tabContext.targetTabId ?? null}
                oktaOrigin={tabContext.oktaOrigin ?? undefined}
              />
            ))}
            {renderTabPanel('history', (isActive) => (
              <div
                className="tab-content active"
                style={{ fontFamily: 'var(--font-primary)', padding: 0 }}
              >
                <PageHeader title="Audit Log" subtitle="View history of actions performed" />
                <div className="max-w-7xl mx-auto px-6 py-6">
                  <AuditLogViewer
                    isActive={isActive}
                    targetTabId={tabContext.targetTabId ?? null}
                  />
                </div>
              </div>
            ))}

            <ActivityBar />
          </div>
        </div>

        {/* Rendered outside the scroll root: it is a viewport-fixed overlay, not
          part of any tab's scrollable content. Selecting a result goes through
          the same `handleTabChange` the icon rail calls. */}
        <CommandPalette
          isOpen={jumpPalette.isOpen}
          onClose={jumpPalette.close}
          activeTab={activeTab}
          onSelect={handleTabChange}
          targetTabId={tabContext.targetTabId ?? null}
          oktaOrigin={tabContext.oktaOrigin}
        />

        {/* The modal layer: every `Modal` overlay in the panel portals in here.
          It is deliberately the **last** node in the shell, after the scroll root
          — the `ActivityBar` is a `fixed bottom-0 z-50` band inside that root and
          shares the top of the z-index ladder with `Modal`, so at equal z-index
          the later node wins and the bar can no longer paint over an open modal's
          footer actions (D-009). The node itself has no box: the overlay it hosts
          is `fixed`. See `components/shared/Modal.tsx` for the full ladder. */}
        <div id={MODAL_LAYER_ID} />
      </NavigationProvider>
    </SchedulerProvider>
  );
};

/**
 * The masthead banner for an expired Okta session (ADR-0054, `D-007b`).
 *
 * Rendered inside `SchedulerProvider` — which is why it is a component rather
 * than a branch in `App`, whose own body sits above the provider. It states the
 * cause and the remedy in the ADR-0002 vocabulary (`danger`, never `error`), and
 * it carries no control of its own: recovery is evidence-driven, so signing back
 * in and using the panel is the remedy, and the scheduler unpublishes the tab —
 * unmounting this banner — the moment a request for it succeeds.
 *
 * @param props.targetTabId - The Okta tab the panel is driving, or `null`.
 */
const SessionExpiryNotice: React.FC<{ targetTabId: number | null }> = ({ targetTabId }) => {
  const expired = useSessionExpiry(targetTabId);
  if (!expired) return null;

  return (
    <div className="px-(--sp-gutter) pt-(--sp-card)">
      <AlertMessage
        message={{
          type: 'danger',
          text: 'Your Okta session has expired. Sign in again in the Okta tab — the panel has stopped sending requests and picks up again on its own once Okta answers.',
        }}
      />
    </div>
  );
};

export default App;
