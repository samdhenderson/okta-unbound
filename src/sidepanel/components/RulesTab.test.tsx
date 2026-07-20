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

function fetchResponse(rules: FormattedRule[]) {
  return {
    success: true,
    rules,
    stats: {
      total: rules.length,
      active: rules.filter((r) => r.status === 'ACTIVE').length,
      inactive: rules.filter((r) => r.status === 'INACTIVE').length,
      conflicts: 0,
    },
    conflicts: [],
  };
}

function renderTab(props: Partial<React.ComponentProps<typeof RulesTab>> = {}) {
  return render(
    <ProgressProvider>
      <RulesTab targetTabId={1} {...props} />
    </ProgressProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  rulesCacheGet.mockResolvedValue(null);
  loadTabState.mockResolvedValue(null);
  // Default: a rules fetch returns two rules; /users/me + lifecycle calls succeed.
  tabsSendMessage.mockImplementation(async (_tabId: number, msg: { action: string }) => {
    switch (msg.action) {
      case 'fetchGroupRules':
        return fetchResponse([rule(), rule({ id: 'r2', name: 'Sales Rule', status: 'INACTIVE' })]);
      case 'makeApiRequest':
        return { success: true, data: { profile: { email: 'admin@corp.com' } } };
      case 'activateRule':
      case 'deactivateRule':
        return { success: true };
      default:
        return { success: true };
    }
  });
  // Scheduler path (captureRuleImpact) resolves empty so the modal settles.
  runtimeSendMessage.mockResolvedValue({ success: true, data: [], headers: {} });
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
    expect(tabsSendMessage).toHaveBeenCalledWith(1, { action: 'fetchGroupRules' });
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
    expect(tabsSendMessage).not.toHaveBeenCalledWith(1, { action: 'fetchGroupRules' });
  });

  it('activates a rule immediately (no confirmation gate)', async () => {
    renderTab();
    await userEvent.click(screen.getAllByRole('button', { name: 'Load Rules' })[0]);
    await waitFor(() => expect(screen.getByTestId('rule-r2')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'activate r2' }));
    await waitFor(() =>
      expect(tabsSendMessage).toHaveBeenCalledWith(1, { action: 'activateRule', ruleId: 'r2' }),
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
    expect(tabsSendMessage).not.toHaveBeenCalledWith(1, { action: 'deactivateRule', ruleId: 'r1' });

    // Confirming commits the deactivation.
    await userEvent.click(screen.getByRole('button', { name: 'confirm-deactivate' }));
    await waitFor(() =>
      expect(tabsSendMessage).toHaveBeenCalledWith(1, { action: 'deactivateRule', ruleId: 'r1' }),
    );
  });

  it('opens the impact modal in preview mode (read-only)', async () => {
    renderTab();
    await userEvent.click(screen.getAllByRole('button', { name: 'Load Rules' })[0]);
    await waitFor(() => expect(screen.getByTestId('rule-r1')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'preview r1' }));
    const modal = await screen.findByTestId('impact-modal');
    expect(modal).toHaveAttribute('data-mode', 'preview');
    expect(tabsSendMessage).not.toHaveBeenCalledWith(1, { action: 'deactivateRule', ruleId: 'r1' });
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
    tabsSendMessage.mockImplementation(async (_t: number, msg: { action: string }) =>
      msg.action === 'fetchGroupRules'
        ? { success: false, error: 'Okta said no' }
        : { success: true },
    );
    renderTab();
    await userEvent.click(screen.getAllByRole('button', { name: 'Load Rules' })[0]);
    await waitFor(() => expect(screen.getByText('Okta said no')).toBeInTheDocument());
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
