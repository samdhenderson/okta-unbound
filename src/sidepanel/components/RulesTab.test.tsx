/**
 * CHARACTERIZATION TESTS for RulesTab.
 *
 * These pin the behavior of RulesTab **as it exists today**, ahead of its §7
 * decomposition, and serve as the pass/fail oracle for that refactor. They drive
 * the real component (and its real hooks) while stubbing the separately-owned
 * `RuleCard` and `RuleImpactModal` so the assertions target RulesTab's
 * orchestration — the load/cache path, the activate flow, the deactivate flow
 * gated behind the impact modal, the preview flow, and the search/filter/empty
 * states — rather than child internals.
 *
 * The rule **detail rung** is deliberately not stubbed. Its strip is where the lifecycle
 * verbs live now, and which tier a verb sits in — and what it takes to fire it — is
 * exactly the orchestration these tests exist to pin.
 *
 * Message passing is chrome-based (not fetch), so MSW does not apply; we mock the
 * chrome messaging surface plus the storage-backed cache/tab-state/audit modules.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RulesTab from './RulesTab';
import { ProgressProvider } from '../contexts/ProgressContext';
import type { FormattedRule } from '../../shared/types';

// ---------------------------------------------------------------------------
// Child test doubles — observe the handler contracts RulesTab brokers.
// ---------------------------------------------------------------------------
const captured = vi.hoisted(() => ({ impact: {} as Record<string, unknown> }));

/*
  The card stub brokers one callback where it brokered four. The write verbs are not
  RuleCard's to offer any more — they are the rule rung's `ActionBar`, which this suite
  drives for real, because "which verb is where, and what gates it" is now part of the
  orchestration under test rather than a child's internals.
*/
vi.mock('./RuleCard', () => ({
  default: (props: {
    rule: FormattedRule;
    onOpenRule?: (rule: FormattedRule) => void;
    isHighlighted?: boolean;
  }) => (
    <div
      data-testid={`rule-${props.rule.id}`}
      data-highlighted={String(Boolean(props.isHighlighted))}
    >
      <span>{props.rule.name}</span>
      <button onClick={() => props.onOpenRule?.(props.rule)}>open {props.rule.id}</button>
    </div>
  ),
}));

vi.mock('./RuleImpactModal', () => ({
  default: (
    props: Record<string, unknown> & { isOpen: boolean; onConfirmDeactivate?: () => void },
  ) => {
    captured.impact = props;
    if (!props.isOpen) return null;
    return (
      <div data-testid="impact-modal" data-mode={String(props.mode)}>
        <span>{String(props.ruleName)}</span>
        <button onClick={() => props.onConfirmDeactivate?.()}>confirm-deactivate</button>
      </div>
    );
  },
}));

// Storage-backed modules — kept hermetic and controllable per test.
const rulesCacheGet = vi.fn();
vi.mock('../../shared/rulesCache', () => ({
  RulesCache: {
    get: (...args: unknown[]) => rulesCacheGet(...args),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

const loadTabState = vi.fn();
vi.mock('../../shared/tabState/tabStateManager', () => ({
  TabStateManager: {
    loadTabState: (...args: unknown[]) => loadTabState(...args),
    markTabVisited: vi.fn(),
    updateScrollPosition: vi.fn(),
  },
  saveRulesTabState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../shared/undoManager', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../shared/storage/auditStore', () => ({
  auditStore: { logOperation: vi.fn().mockResolvedValue(undefined) },
}));

// ---------------------------------------------------------------------------
// chrome mocks
// ---------------------------------------------------------------------------
const tabsSendMessage = vi.fn();
const runtimeSendMessage = vi.fn();

globalThis.chrome = {
  runtime: {
    sendMessage: runtimeSendMessage,
    getURL: (p: string) => p,
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabs: { sendMessage: tabsSendMessage },
  storage: {
    local: {
      get: vi.fn((_k: unknown, cb?: (r: unknown) => void) => {
        if (cb) cb({});
        return Promise.resolve({});
      }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
    },
  },
} as any;

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------
function rule(over: Partial<FormattedRule> = {}): FormattedRule {
  return {
    id: 'r1',
    name: 'Engineering Rule',
    status: 'ACTIVE',
    condition: 'department == "Eng"',
    conditionExpression: 'user.department=="Eng"',
    groupIds: ['g1'],
    groupNames: ['Engineering'],
    userAttributes: ['department'],
    created: '2020-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    affectsCurrentGroup: false,
    conflicts: [],
    ...over,
  };
}

const stats = { total: 2, active: 1, inactive: 1, conflicts: 0 };

/**
 * A RAW Okta group rule (the shape the scheduler read now returns). §8:
 * `fetchGroupRulesRequest` runs in-panel and formats these, so the oracle mocks the
 * raw `/api/v1/groups/rules` response and lets the real helper produce the
 * FormattedRule the (stubbed) RuleCard receives.
 */
function rawRule(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'Engineering Rule',
    status: 'ACTIVE',
    conditions: { expression: { value: 'user.department=="Eng"' } },
    actions: { assignUserToGroups: { groupIds: ['g1'] } },
    created: '2020-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    ...over,
  };
}

/** The two default raw fixtures: one ACTIVE, one INACTIVE, sharing a condition. */
const DEFAULT_RAW_RULES = [
  rawRule(),
  rawRule({ id: 'r2', name: 'Sales Rule', status: 'INACTIVE' }),
];

/** §8: scheduler GETs for the rules read (`/api/v1/groups/rules?limit=200`). */
const rulesFetchCalls = () =>
  runtimeSendMessage.mock.calls.filter((c) =>
    /^\/api\/v1\/groups\/rules/.test(String(c[0]?.endpoint)),
  );

function renderTab(props: Partial<React.ComponentProps<typeof RulesTab>> = {}) {
  return render(
    <ProgressProvider>
      <RulesTab targetTabId={1} {...props} />
    </ProgressProvider>,
  );
}

// ---------------------------------------------------------------------------
// Reaching the controls the ADR-0051 strip put behind a disclosure.
//
// The filter chips and the three analysis panels used to be always-on cards and
// an always-on toolbar; they are now behind the rules strip's **More** tier and
// its `Filters` toggle. These helpers are the extra press each assertion needs —
// no assertion below was relaxed to accommodate the move, only preceded.
// ---------------------------------------------------------------------------

/** Open the strip's **More** tier, if it is not already open. */
async function openMoreTier(): Promise<void> {
  const more = screen.queryByRole('button', { name: 'More' });
  if (more && more.getAttribute('aria-expanded') !== 'true') await userEvent.click(more);
}

/** Open one of the strip's analysis panels (Stats / Duplicates / This group). */
async function openPanel(label: RegExp): Promise<void> {
  await openMoreTier();
  await userEvent.click(screen.getByRole('button', { name: label }));
}

/** Disclose the filter panel that holds the chips and the sort selector. */
async function openFilters(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
}

/**
 * Load the rules and push one rule's detail rung — where every write verb now lives.
 *
 * While the rung is up the list rung carries `hidden`, so its own strip leaves the
 * accessible tree and a role query for **More** resolves to the rung's strip
 * unambiguously. `getByTestId` still reaches the hidden cards, which is what the
 * search/filter assertions rely on.
 */
/**
 * Wait for the rung's own on-open fetch to land.
 *
 * RETARGET (ADR-0069 §6, ADR-0022). Every assertion below used to be preceded by
 * a press of the empty state's *Load Rules* button, because the tab fetched
 * nothing until asked. It now fetches when it is opened — one org-level call,
 * served from `RulesCache` on a repeat — so the press is gone and the wait
 * replaces it. Nothing that was asserted after the press stopped being asserted;
 * only the way the list gets populated changed, and the two tests that pinned
 * *how many* requests that costs still pin exactly one.
 */
async function rulesLoaded(): Promise<void> {
  await waitFor(() => expect(screen.queryByText('No Rules Loaded')).not.toBeInTheDocument());
}

async function openRuleRung(ruleId: string): Promise<void> {
  await rulesLoaded();
  await waitFor(() => expect(screen.getByTestId(`rule-${ruleId}`)).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: `open ${ruleId}` }));
  await screen.findByTestId('rule-action-bar');
}

/**
 * Raw `/api/v1/groups/rules` response, reassignable per test (e.g. a failure).
 * Reset in `beforeEach` to the two default fixtures.
 */
let rulesFetchResponse: () => { success: boolean; data?: unknown[]; error?: string };

beforeEach(() => {
  vi.clearAllMocks();
  rulesCacheGet.mockResolvedValue(null);
  loadTabState.mockResolvedValue(null);
  rulesFetchResponse = () => ({ success: true, data: DEFAULT_RAW_RULES });

  // §8: the rules read now routes through the scheduler. useRulesData calls
  // fetchGroupRulesRequest, which fetches raw rules from /api/v1/groups/rules and
  // resolves each target group's name from /api/v1/groups/{id}. The scheduler path
  // also carries captureRuleImpact, the /users/me lookup, and activate/deactivate
  // mutations — all resolve success/empty so they settle.
  runtimeSendMessage.mockImplementation(async (msg: { action?: string; endpoint?: string }) => {
    if (msg.action !== 'scheduleApiRequest') return { success: false };
    if (/^\/api\/v1\/groups\/rules/.test(String(msg.endpoint))) return rulesFetchResponse();
    return { success: true, data: [], headers: {} };
  });

  // RulesTab makes no direct chrome.tabs.sendMessage reads after §8; stub defensively.
  tabsSendMessage.mockResolvedValue({ success: true });
});

describe('RulesTab characterization', () => {
  /*
    RETARGETED (ADR-0069 §6). This pinned that the rung showed an empty state
    until someone pressed Load — the manual gate. The gate is gone: the tab
    fetches on open. What the empty state is *for* survives and is what is pinned
    now — a rung with no connected Okta tab has nothing to fetch, and must say so
    with its own load prompt rather than being a blank panel. That prompt is also
    the recovery path for a fetch that failed.
  */
  /*
    ADR-0018 is the trap in ADR-0069 §6, and it is worth its own case. Tabs stay
    mounted, so a fetch written as a plain mount effect fires for this tab while
    the reader is on Groups, and then fires *nothing* on the actual switch. Both
    halves are asserted: silence while hidden, and the fetch on arrival.
  */
  it('issues no request while the tab is hidden, and fetches on arrival', async () => {
    const { rerender } = render(
      <ProgressProvider>
        <RulesTab targetTabId={1} isActive={false} />
      </ProgressProvider>,
    );

    await waitFor(() => expect(loadTabState).toHaveBeenCalled());
    expect(rulesFetchCalls()).toHaveLength(0);

    rerender(
      <ProgressProvider>
        <RulesTab targetTabId={1} isActive />
      </ProgressProvider>,
    );

    await rulesLoaded();
    expect(rulesFetchCalls()).toHaveLength(1);
  });

  it('shows the empty state, with its own load prompt, when no Okta tab is connected', () => {
    renderTab({ targetTabId: undefined });
    expect(screen.getByText('No Rules Loaded')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Load Rules' }).length).toBeGreaterThan(0);
    expect(rulesFetchCalls()).toHaveLength(0);
  });

  it('loads rules via the content script and renders stats + cards', async () => {
    renderTab();
    await rulesLoaded();

    await waitFor(() => expect(screen.getByTestId('rule-r1')).toBeInTheDocument());
    // §8: the rules read now routes through the scheduler.
    expect(rulesFetchCalls()).toHaveLength(1);
    expect(runtimeSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'scheduleApiRequest',
        endpoint: '/api/v1/groups/rules?limit=200',
      }),
    );
    expect(screen.getByText('Engineering Rule')).toBeInTheDocument();
    expect(screen.getByText('Sales Rule')).toBeInTheDocument();

    // Stat tiles render their values — one press further in than they used to be,
    // now that the grid is an analysis panel rather than a permanent card.
    await openPanel(/^Stats/);
    expect(
      within(screen.getByText('Total Rules').closest('div')!).getByText('2'),
    ).toBeInTheDocument();
    expect(within(screen.getByText('Active').closest('div')!).getByText('1')).toBeInTheDocument();
  });

  it('serves rules from the RulesCache without a content-script fetch', async () => {
    rulesCacheGet.mockResolvedValue({
      rules: [rule({ name: 'Cached Rule' })],
      stats,
      conflicts: [],
      timestamp: Date.now(),
    });
    renderTab();
    await rulesLoaded();

    await waitFor(() => expect(screen.getByText('Cached Rule')).toBeInTheDocument());
    // §8: a cache hit must not issue the scheduler rules read.
    expect(rulesFetchCalls()).toHaveLength(0);
  });

  /*
    RETARGETED, and it pins a deliberate **behaviour change**. This test was called
    `activates a rule immediately (no confirmation gate)` and it characterized exactly
    that: a click on the card fired `activateRule` with nothing in between.

    That was wrong, and D-052 is why. Okta's rule engine only ever adds, so activating a
    rule writes memberships into every target group and pausing it again removes none of
    them. There is no second press that undoes the first, which is ADR-0039's definition
    of a verb that needs a confirm. So the verb moved behind **More**, gained a `Modal`
    that states the consequence in plain language, and the endpoint fires only on confirm.

    The old assertion survives whole — same endpoint, same method, same scheduler path.
    What is new is everything asserted *before* it: that the press alone writes nothing.
  */
  it('gates activation behind a confirm that states what cannot be undone', async () => {
    renderTab();
    await openRuleRung('r2');

    const activateEndpoint = '/api/v1/groups/rules/r2/lifecycle/activate';
    await openMoreTier();
    await userEvent.click(screen.getByRole('button', { name: 'Activate rule' }));

    // The dialog is up and nothing has been written yet.
    expect(await screen.findByRole('dialog')).toHaveTextContent(/only ever adds members/);
    expect(runtimeSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: activateEndpoint }),
    );

    // §8: the mutation routes through the scheduler (POST to the lifecycle endpoint)
    // rather than a direct `activateRule` content-script message.
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Activate' }),
    );
    await waitFor(() =>
      expect(runtimeSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'scheduleApiRequest',
          endpoint: activateEndpoint,
          method: 'POST',
        }),
      ),
    );
  });

  /* The other half of the gate: dismissing it writes nothing. */
  it('writes nothing when the activation confirm is cancelled', async () => {
    renderTab();
    await openRuleRung('r2');

    await openMoreTier();
    await userEvent.click(screen.getByRole('button', { name: 'Activate rule' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(runtimeSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/v1/groups/rules/r2/lifecycle/activate' }),
    );
  });

  /*
    RETARGETED only in where the verb is pressed: it left the card's action row for the
    rung's **More** tier, for the same D-052 reason as activation. Its gate is unchanged
    — `RuleImpactModal`, which names who is affected rather than describing it, which is
    why this verb gained no second dialog of its own.
  */
  it('gates deactivation behind the impact modal, committing only on confirm', async () => {
    renderTab();
    await openRuleRung('r1');

    // Clicking Deactivate opens the modal in 'deactivate' mode — no API call yet.
    await openMoreTier();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate rule' }));
    const modal = await screen.findByTestId('impact-modal');
    expect(modal).toHaveAttribute('data-mode', 'deactivate');
    const deactivateEndpoint = '/api/v1/groups/rules/r1/lifecycle/deactivate';
    expect(runtimeSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: deactivateEndpoint }),
    );

    // Confirming commits the deactivation (POST via the scheduler).
    await userEvent.click(screen.getByRole('button', { name: 'confirm-deactivate' }));
    await waitFor(() =>
      expect(runtimeSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'scheduleApiRequest',
          endpoint: deactivateEndpoint,
          method: 'POST',
        }),
      ),
    );
  });

  /*
    RETARGETED to the rung's strip. *Preview impact* stays in the **row** — it computes
    who would stop being attributed and writes nothing — and it is the rung's `primary`,
    the thing an admin opens a rule's page to do.
  */
  it('opens the impact modal in preview mode (read-only)', async () => {
    renderTab();
    await openRuleRung('r1');

    await userEvent.click(screen.getByRole('button', { name: 'Preview impact' }));
    const modal = await screen.findByTestId('impact-modal');
    expect(modal).toHaveAttribute('data-mode', 'preview');
    expect(runtimeSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/v1/groups/rules/r1/lifecycle/deactivate' }),
    );
  });

  it('filters the list by search query', async () => {
    renderTab();
    await rulesLoaded();
    await waitFor(() => expect(screen.getByTestId('rule-r1')).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText(/Search rules/i), 'Sales');
    await waitFor(() => expect(screen.queryByTestId('rule-r1')).not.toBeInTheDocument());
    expect(screen.getByTestId('rule-r2')).toBeInTheDocument();
  });

  it('filters the list to active rules only', async () => {
    renderTab();
    await rulesLoaded();
    await waitFor(() => expect(screen.getByTestId('rule-r2')).toBeInTheDocument());

    await openFilters();
    await userEvent.click(screen.getByRole('button', { name: 'Active Only' }));
    expect(screen.getByTestId('rule-r1')).toBeInTheDocument();
    expect(screen.queryByTestId('rule-r2')).not.toBeInTheDocument();
  });

  it('keeps a broken rule reachable — it is neither active nor hidden (D-085)', async () => {
    // An INVALID rule is one Okta can no longer evaluate. The chips were
    // `=== 'ACTIVE'` and `=== 'INACTIVE'`, so it fell through both and became the
    // one rule on the tab no filter could reach — the rule an admin most needs to
    // find. It is not active, so it belongs with the rules that are not running.
    rulesFetchResponse = () => ({
      success: true,
      data: [...DEFAULT_RAW_RULES, rawRule({ id: 'r3', name: 'Broken Rule', status: 'INVALID' })],
    });
    renderTab();
    await rulesLoaded();
    await waitFor(() => expect(screen.getByTestId('rule-r3')).toBeInTheDocument());

    await openFilters();
    await userEvent.click(screen.getByRole('button', { name: 'Active Only' }));
    expect(screen.queryByTestId('rule-r3')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Paused' }));
    expect(screen.getByTestId('rule-r3')).toBeInTheDocument();
    expect(screen.queryByTestId('rule-r1')).not.toBeInTheDocument();
  });

  it('surfaces a load failure in the error banner', async () => {
    // §8: the rules read fails at the scheduler; the helper returns it verbatim.
    rulesFetchResponse = () => ({ success: false, error: 'Okta said no' });
    renderTab();
    // No `rulesLoaded()` wait: the on-open fetch is what fails here, so the
    // empty state stays put and the error banner is the thing to wait for.
    await waitFor(() => expect(screen.getByText('Okta said no')).toBeInTheDocument());
    // And the rung is not a dead end — its own load prompt is still offered.
    expect(screen.getAllByRole('button', { name: 'Load Rules' }).length).toBeGreaterThan(0);
  });

  /*
    RETARGETED — a deep link **opens the rule's rung** now instead of scrolling the list
    to its card and flashing it for two seconds.

    Scroll-and-flash was the best a list could do: it put you next to a collapsed row and
    left you to expand it. The assertion that the tab fetches on its own is unchanged;
    what it fetches *for* has moved from "highlight the target" to "have the target to
    push". The rung's presence is asserted through its strip, whose `aria-label` names the
    rule — a stronger claim than the old `data-highlighted` flag, which only said the
    card had been told it was the target.
  */
  it('auto-loads rules when deep-linked to a rule with nothing loaded yet', async () => {
    // Arrive with a cross-tab deep-link (selectedRuleId) but no rules loaded and
    // no persisted state — the tab must fetch on its own, then open the target.
    renderTab({ selectedRuleId: 'r2' });

    await waitFor(() => expect(screen.getByTestId('rule-action-bar')).toBeInTheDocument());
    // Exactly one cache-first rules read. It is now the rung's own on-open load
    // rather than a deep-link-specific effect; the deep-link effect was removed
    // because under the identical readiness condition it only ever fired a
    // second, concurrent copy of this same request.
    expect(rulesFetchCalls()).toHaveLength(1);
    expect(screen.getByLabelText('Actions for Sales Rule')).toBeInTheDocument();
  });

  /*
    RETARGETED, and the behaviour it guarded is now structural. The old test pinned that
    a restored "active only" filter — which would hide the INACTIVE deep-link target —
    gets cleared, because a filtered-out card cannot be scrolled to. The rung does not
    care what the list is filtered to, so the tab no longer clears anything; the
    *property* the test protects, "a persisted filter cannot swallow a deep link", is
    asserted the same way and now holds without the workaround.
  */
  it('opens a deep-linked rule that the persisted filter would have hidden', async () => {
    loadTabState.mockResolvedValue({
      cachedRules: [rule(), rule({ id: 'r2', name: 'Sales Rule', status: 'INACTIVE' })],
      cachedStats: stats,
      lastFetchTime: new Date('2024-01-01').toISOString(),
      activeFilter: 'active',
    });

    renderTab({ selectedRuleId: 'r2' });

    // r2's rung opens despite the restored "active" filter...
    await waitFor(() =>
      expect(screen.getByLabelText('Actions for Sales Rule')).toBeInTheDocument(),
    );
    // ...and no network fetch was needed — the rules came from persisted state.
    expect(rulesFetchCalls()).toHaveLength(0);
  });

  /*
    RETARGETED with the deep-link path it shares: *View* asked the list to highlight a
    card, and now asks the tab to open that rule's rung. The route into it is unchanged —
    the panel sets the same focused-rule id the cross-tab link does — so this keeps
    covering the wire between the panel and the tab, and now proves it lands somewhere
    that answers the question the panel raised.
  */
  it('the duplicates panel "View" link opens the rule\'s rung', async () => {
    // The two default fixtures share a condition, so they cluster in the banner.
    renderTab();
    await rulesLoaded();
    await waitFor(() => expect(screen.getByTestId('rule-r1')).toBeInTheDocument());
    expect(screen.queryByTestId('rule-action-bar')).not.toBeInTheDocument();

    // Open the panel from the strip, then the cluster, then click View on the first
    // rule. The panel's own outer collapsible is gone — the strip's `Duplicates (N)`
    // verb is what holds it closed now (ADR-0061).
    await openPanel(/^Duplicates/);
    await userEvent.click(screen.getByRole('button', { name: /rules → .* target group/ }));
    // The rule name appears in both the stubbed card and the banner row; pick the
    // banner row (inside an <li>) and click its View link.
    const bannerRow = screen
      .getAllByText('Engineering Rule')
      .map((el) => el.closest('li'))
      .find((li) => li !== null);
    expect(bannerRow).toBeTruthy();
    if (bannerRow) {
      await userEvent.click(within(bannerRow).getByRole('button', { name: 'View' }));
    }

    expect(await screen.findByLabelText('Actions for Engineering Rule')).toBeInTheDocument();
  });
});

/**
 * The "Current Group" chip.
 *
 * The relation is derived at filter time from each rule's own `groupIds`, never
 * from the `affectsCurrentGroup` flag carried on the rule. That flag is only
 * trustworthy on a fresh, group-scoped fetch: the org-wide RulesCache is
 * deliberately formatted without a current group (see `groupDiscovery.ts`), and
 * persisted TabState freezes whatever flag was current when it was written. Both
 * paths are exercised below.
 */
describe('RulesTab current-group filter', () => {
  it('scopes to the current group for rules served from the org-wide cache', async () => {
    // The repro: the cache is warm (a group view populated it), so every rule it
    // serves carries a falsy affectsCurrentGroup — including r1, which DOES feed
    // the current group g1.
    rulesCacheGet.mockResolvedValue({
      rules: [
        rule({
          id: 'r1',
          name: 'Feeds Current Group',
          groupIds: ['g1'],
          affectsCurrentGroup: false,
        }),
        rule({
          id: 'r2',
          name: 'Feeds Another Group',
          groupIds: ['g2'],
          affectsCurrentGroup: false,
        }),
      ],
      stats,
      conflicts: [],
      timestamp: Date.now(),
    });

    renderTab({ currentGroupId: 'g1' });
    await rulesLoaded();
    await waitFor(() => expect(screen.getByTestId('rule-r1')).toBeInTheDocument());

    await openFilters();
    await userEvent.click(screen.getByRole('button', { name: 'Current Group' }));

    expect(screen.getByTestId('rule-r1')).toBeInTheDocument();
    expect(screen.queryByTestId('rule-r2')).not.toBeInTheDocument();
  });

  it('excludes a rule that does not target the current group, even if flagged', async () => {
    // r2 carries a stale `affectsCurrentGroup: true` (e.g. persisted while a
    // different group was current). Membership is decided by groupIds, not the flag.
    rulesCacheGet.mockResolvedValue({
      rules: [
        rule({ id: 'r1', name: 'Feeds Current Group', groupIds: ['g0', 'g1'] }),
        rule({
          id: 'r2',
          name: 'Stale Flag Rule',
          groupIds: ['g2'],
          affectsCurrentGroup: true,
        }),
      ],
      stats,
      conflicts: [],
      timestamp: Date.now(),
    });

    renderTab({ currentGroupId: 'g1' });
    await rulesLoaded();
    await waitFor(() => expect(screen.getByTestId('rule-r2')).toBeInTheDocument());

    await openFilters();
    await userEvent.click(screen.getByRole('button', { name: 'Current Group' }));

    expect(screen.getByTestId('rule-r1')).toBeInTheDocument();
    expect(screen.queryByTestId('rule-r2')).not.toBeInTheDocument();
  });

  it('yields an empty list when the restored filter has no current group', async () => {
    // A persisted 'current-group' filter can outlive the group that set it: the
    // chip itself is hidden without a currentGroupId, so the restored filter must
    // simply match nothing rather than throw or fall back to showing everything.
    loadTabState.mockResolvedValue({
      cachedRules: [
        rule({ id: 'r1', groupIds: ['g1'], affectsCurrentGroup: true }),
        rule({ id: 'r2', name: 'Sales Rule', groupIds: ['g2'] }),
      ],
      cachedStats: stats,
      lastFetchTime: new Date('2024-01-01').toISOString(),
      activeFilter: 'current-group',
    });

    renderTab();

    await waitFor(() => expect(screen.getByText('No Matching Rules')).toBeInTheDocument());
    expect(screen.queryByTestId('rule-r1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rule-r2')).not.toBeInTheDocument();
    // No group detected → no chip to toggle it back off. Asserted with the filter panel
    // **open**: closed, it is not rendered at all, so the absence would hold whether or
    // not the chip is conditional and would prove nothing.
    await openFilters();
    expect(screen.getByRole('button', { name: 'All Rules' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Current Group' })).not.toBeInTheDocument();
  });
});
