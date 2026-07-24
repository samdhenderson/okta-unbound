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

vi.mock('./RuleCard', () => ({
  default: (props: {
    rule: FormattedRule;
    onActivate?: (id: string) => void;
    onDeactivate?: (id: string) => void;
    onPreviewImpact?: (rule: FormattedRule) => void;
    isHighlighted?: boolean;
  }) => (
    <div
      data-testid={`rule-${props.rule.id}`}
      data-highlighted={String(Boolean(props.isHighlighted))}
    >
      <span>{props.rule.name}</span>
      <button onClick={() => props.onActivate?.(props.rule.id)}>activate {props.rule.id}</button>
      <button onClick={() => props.onDeactivate?.(props.rule.id)}>
        deactivate {props.rule.id}
      </button>
      <button onClick={() => props.onPreviewImpact?.(props.rule)}>preview {props.rule.id}</button>
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
  it('shows the empty state until rules are loaded', () => {
    renderTab();
    expect(screen.getByText('No Rules Loaded')).toBeInTheDocument();
  });

  it('loads rules via the content script and renders stats + cards', async () => {
    renderTab();
    await userEvent.click(screen.getAllByRole('button', { name: 'Load Rules' })[0]);

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

    // Stat tiles render their values.
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
    await userEvent.click(screen.getAllByRole('button', { name: 'Load Rules' })[0]);

    await waitFor(() => expect(screen.getByText('Cached Rule')).toBeInTheDocument());
    // §8: a cache hit must not issue the scheduler rules read.
    expect(rulesFetchCalls()).toHaveLength(0);
  });

  it('activates a rule immediately (no confirmation gate)', async () => {
    renderTab();
    await userEvent.click(screen.getAllByRole('button', { name: 'Load Rules' })[0]);
    await waitFor(() => expect(screen.getByTestId('rule-r2')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'activate r2' }));
    // §8: the mutation now routes through the scheduler (POST to the lifecycle
    // endpoint) rather than a direct `activateRule` content-script message.
    await waitFor(() =>
      expect(runtimeSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'scheduleApiRequest',
          endpoint: '/api/v1/groups/rules/r2/lifecycle/activate',
          method: 'POST',
        }),
      ),
    );
  });

  it('gates deactivation behind the impact modal, committing only on confirm', async () => {
    renderTab();
    await userEvent.click(screen.getAllByRole('button', { name: 'Load Rules' })[0]);
    await waitFor(() => expect(screen.getByTestId('rule-r1')).toBeInTheDocument());

    // Clicking Deactivate opens the modal in 'deactivate' mode — no API call yet.
    await userEvent.click(screen.getByRole('button', { name: 'deactivate r1' }));
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

  it('opens the impact modal in preview mode (read-only)', async () => {
    renderTab();
    await userEvent.click(screen.getAllByRole('button', { name: 'Load Rules' })[0]);
    await waitFor(() => expect(screen.getByTestId('rule-r1')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'preview r1' }));
    const modal = await screen.findByTestId('impact-modal');
    expect(modal).toHaveAttribute('data-mode', 'preview');
    expect(runtimeSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/v1/groups/rules/r1/lifecycle/deactivate' }),
    );
  });

  it('filters the list by search query', async () => {
    renderTab();
    await userEvent.click(screen.getAllByRole('button', { name: 'Load Rules' })[0]);
    await waitFor(() => expect(screen.getByTestId('rule-r1')).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText(/Search rules/i), 'Sales');
    await waitFor(() => expect(screen.queryByTestId('rule-r1')).not.toBeInTheDocument());
    expect(screen.getByTestId('rule-r2')).toBeInTheDocument();
  });

  it('filters the list to active rules only', async () => {
    renderTab();
    await userEvent.click(screen.getAllByRole('button', { name: 'Load Rules' })[0]);
    await waitFor(() => expect(screen.getByTestId('rule-r2')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Active Only' }));
    expect(screen.getByTestId('rule-r1')).toBeInTheDocument();
    expect(screen.queryByTestId('rule-r2')).not.toBeInTheDocument();
  });

  it('surfaces a load failure in the error banner', async () => {
    // §8: the rules read fails at the scheduler; the helper returns it verbatim.
    rulesFetchResponse = () => ({ success: false, error: 'Okta said no' });
    renderTab();
    await userEvent.click(screen.getAllByRole('button', { name: 'Load Rules' })[0]);
    await waitFor(() => expect(screen.getByText('Okta said no')).toBeInTheDocument());
  });

  it('auto-loads rules when deep-linked to a rule with nothing loaded yet', async () => {
    // Arrive with a cross-tab deep-link (selectedRuleId) but no rules loaded and
    // no persisted state — the tab must fetch on its own, then highlight the target.
    renderTab({ selectedRuleId: 'r2' });

    await waitFor(() => expect(screen.getByTestId('rule-r2')).toBeInTheDocument());
    // The deep-link triggered exactly one cache-first rules read (no manual click).
    expect(rulesFetchCalls()).toHaveLength(1);
    expect(screen.getByTestId('rule-r2')).toHaveAttribute('data-highlighted', 'true');
  });

  it('clears a persisted filter that would hide the deep-linked rule', async () => {
    // Persisted state restores an "active only" filter; the deep-link targets the
    // INACTIVE rule, which that filter would hide. The tab must relax the filter.
    loadTabState.mockResolvedValue({
      cachedRules: [rule(), rule({ id: 'r2', name: 'Sales Rule', status: 'INACTIVE' })],
      cachedStats: stats,
      lastFetchTime: new Date('2024-01-01').toISOString(),
      activeFilter: 'active',
    });

    renderTab({ selectedRuleId: 'r2' });

    // r2 becomes visible and highlighted despite the restored "active" filter...
    await waitFor(() => expect(screen.getByTestId('rule-r2')).toBeInTheDocument());
    expect(screen.getByTestId('rule-r2')).toHaveAttribute('data-highlighted', 'true');
    // ...and no network fetch was needed — the rules came from persisted state.
    expect(rulesFetchCalls()).toHaveLength(0);
  });

  it('the merge banner "View" link highlights the rule card in the list', async () => {
    // The two default fixtures share a condition, so they cluster in the banner.
    renderTab();
    await userEvent.click(screen.getAllByRole('button', { name: 'Load Rules' })[0]);
    await waitFor(() => expect(screen.getByTestId('rule-r1')).toBeInTheDocument());
    expect(screen.getByTestId('rule-r1')).toHaveAttribute('data-highlighted', 'false');

    // Open the collapsed banner, then the cluster, then click View on the first rule.
    await userEvent.click(screen.getByRole('button', { name: /duplicate-condition rules/ }));
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

    expect(screen.getByTestId('rule-r1')).toHaveAttribute('data-highlighted', 'true');
  });
});
