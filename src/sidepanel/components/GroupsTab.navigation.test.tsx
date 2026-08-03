/**
 * Push/pop sub-navigation tests for GroupsTab (WP6).
 *
 * These pin the contract the Group Detail view depends on: the browse list is
 * **hidden, never unmounted**, the detail view renders as its sibling, focus moves
 * in and comes back to the row that opened it, and the cross-tab deep-link still
 * lands on a row rather than being swallowed by an open detail view.
 *
 * Message passing is chrome-based (not fetch), so MSW does not apply — the chrome
 * messaging surface is mocked exactly as `GroupsTab.test.tsx` does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import GroupsTab from './GroupsTab';
import { ProgressProvider } from '../contexts/ProgressContext';

const render = (ui: ReactElement) =>
  rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ProgressProvider>{children}</ProgressProvider>
    ),
  });

// ---------------------------------------------------------------------------
// chrome mocks
// ---------------------------------------------------------------------------
const runtimeSendMessage = vi.fn();
const storageGet = vi.fn();
const storageSet = vi.fn();

const GROUPS_CACHE_KEY = 'okta_unbound_groups_cache';

globalThis.chrome = {
  runtime: {
    sendMessage: runtimeSendMessage,
    getURL: (p: string) => p,
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabs: { sendMessage: vi.fn() },
  storage: { local: { get: storageGet, set: storageSet, remove: vi.fn() } },
} as any;

/** A serialized GroupSummary, i.e. what lives in chrome.storage.local. */
function cachedGroup(over: Record<string, any> = {}) {
  return {
    id: 'g1',
    name: 'Engineering',
    description: 'Eng team',
    type: 'OKTA_GROUP',
    memberCount: 10,
    lastUpdated: '2024-01-01T00:00:00.000Z',
    created: '2020-01-01T00:00:00.000Z',
    hasRules: false,
    ruleCount: 0,
    selected: false,
    ...over,
  };
}

/**
 * Serves the groups cache to the callback-style read and everything else (the
 * promise-style `RulesCache` read) to the promise form, so both callers work.
 */
function seedCache(groups: Record<string, any>[]) {
  const payload = { [GROUPS_CACHE_KEY]: JSON.stringify({ groups, timestamp: Date.now() }) };
  storageGet.mockImplementation((keys: any, cb?: (r: any) => void) => {
    const wantsGroups = Array.isArray(keys) ? keys.includes(GROUPS_CACHE_KEY) : false;
    const result = wantsGroups ? payload : {};
    if (typeof cb === 'function') return cb(result);
    return Promise.resolve(result);
  });
}

function renderCached(groups: Record<string, any>[], props: Record<string, any> = {}) {
  seedCache(groups);
  return render(<GroupsTab targetTabId={1} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  storageGet.mockImplementation((_keys: any, cb?: (r: any) => void) =>
    typeof cb === 'function' ? cb({}) : Promise.resolve({}),
  );
  runtimeSendMessage.mockImplementation(async (msg: any) => {
    if (/^\/api\/v1\/groups\/rules/.test(msg.endpoint)) return { success: true, data: [] };
    return { success: true, data: [] };
  });
});

// The row's expand affordance is an IconButton labelled "Expand"; scope the click
// to the row so a multi-group fixture stays unambiguous.
async function expandRow(uev: ReturnType<typeof userEvent.setup>, name: string) {
  const row = screen.getByLabelText(`Select ${name}`).closest('[data-group-id]') as HTMLElement;
  await uev.click(within(row).getByRole('button', { name: 'Expand' }));
}

async function drillInto(uev: ReturnType<typeof userEvent.setup>, name: string) {
  await expandRow(uev, name);
  const row = screen.getByLabelText(`Select ${name}`).closest('[data-group-id]') as HTMLElement;
  const trigger = within(row).getByRole('button', { name: 'View group details' });
  await uev.click(trigger);
  return trigger;
}

describe('GroupsTab sub-navigation', () => {
  it('pushes a detail view and swaps the single header in place', async () => {
    const uev = userEvent.setup();
    renderCached([cachedGroup()]);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Groups');

    await drillInto(uev, 'Engineering');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Engineering');
    expect(screen.getByTestId('group-detail-view')).toBeInTheDocument();
    // Still exactly one PageHeader — its contents swapped, it did not remount.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('renders a breadcrumb trail back to the list', async () => {
    const uev = userEvent.setup();
    renderCached([cachedGroup()]);
    await drillInto(uev, 'Engineering');

    const trail = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(trail.getByRole('button', { name: 'Groups' })).toBeInTheDocument();
    expect(trail.getByText('Engineering')).toHaveAttribute('aria-current', 'page');

    await uev.click(trail.getByRole('button', { name: 'Groups' }));
    expect(screen.queryByTestId('group-detail-view')).not.toBeInTheDocument();
  });

  it('hides the list without unmounting it, so its state survives', async () => {
    const uev = userEvent.setup();
    renderCached([cachedGroup()]);

    // Accumulate list state: select the row and expand it.
    await uev.click(screen.getByLabelText('Select Engineering'));
    await drillInto(uev, 'Engineering');

    // The row is still mounted (checked + expanded) behind the hidden wrapper.
    const checkbox = screen.getByLabelText('Select Engineering');
    expect(checkbox).toBeChecked();
    expect(checkbox.closest('div.hidden')).not.toBeNull();

    await uev.click(screen.getByRole('button', { name: 'Back to groups' }));

    expect(screen.getByLabelText('Select Engineering')).toBeChecked();
    expect(screen.getByRole('button', { name: 'View group details' })).toBeInTheDocument();
    expect(screen.getByLabelText('Select Engineering').closest('div.hidden')).toBeNull();
  });

  it('keeps the filter query and its result set across a push/pop round trip', async () => {
    const uev = userEvent.setup();
    renderCached([cachedGroup(), cachedGroup({ id: 'g2', name: 'Design' })]);

    const search = screen.getByPlaceholderText('Search by name, description, ID — or /regex/');
    await uev.type(search, 'Engin');
    expect(screen.queryByLabelText('Select Design')).not.toBeInTheDocument();

    await drillInto(uev, 'Engineering');
    await uev.click(screen.getByRole('button', { name: 'Back to groups' }));

    expect(screen.getByPlaceholderText('Search by name, description, ID — or /regex/')).toHaveValue(
      'Engin',
    );
    expect(screen.queryByLabelText('Select Design')).not.toBeInTheDocument();
  });

  it('moves focus into the pushed view and restores it to the row that opened it', async () => {
    const uev = userEvent.setup();
    renderCached([cachedGroup()]);

    const trigger = await drillInto(uev, 'Engineering');

    const detail = screen.getByTestId('group-detail-view');
    expect(detail.parentElement?.contains(document.activeElement)).toBe(true);

    await uev.click(screen.getByRole('button', { name: 'Back to groups' }));
    expect(document.activeElement).toBe(trigger);
  });

  it('restores the list scroll offset that display:none destroyed', async () => {
    const uev = userEvent.setup();
    const { container } = renderCached([cachedGroup()]);

    // jsdom has no layout, so give the scroll box a real, writable scrollTop.
    const scrollBox = container.querySelector('.scrollable-list') as HTMLElement;
    Object.defineProperty(scrollBox, 'scrollTop', { value: 0, writable: true });
    scrollBox.scrollTop = 240;

    await drillInto(uev, 'Engineering');
    scrollBox.scrollTop = 0; // what hiding the box does

    await uev.click(screen.getByRole('button', { name: 'Back to groups' }));
    expect(scrollBox.scrollTop).toBe(240);
  });

  it('pops back to the list when a cross-tab deep-link arrives', async () => {
    const uev = userEvent.setup();
    seedCache([cachedGroup()]);
    const onGroupSelected = vi.fn();
    const { rerender } = render(<GroupsTab targetTabId={1} onGroupSelected={onGroupSelected} />);

    await drillInto(uev, 'Engineering');
    expect(screen.getByTestId('group-detail-view')).toBeInTheDocument();

    // RTL re-applies the render wrapper on rerender, so passing ProgressProvider
    // again would nest it — changing the element type tree, remounting GroupsTab
    // and losing the loaded list to an async cache rehydrate.
    rerender(<GroupsTab targetTabId={1} selectedGroupId="g1" onGroupSelected={onGroupSelected} />);

    expect(screen.queryByTestId('group-detail-view')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Select Engineering').closest('div.hidden')).toBeNull();
  });

  it('shows the group id, dates and push state in the detail view', async () => {
    const uev = userEvent.setup();
    renderCached([
      cachedGroup({
        pushMappings: [
          {
            mappingId: 'm1',
            sourceUserGroupId: 'g1',
            targetGroupName: 'Engineering (Slack)',
            priority: 2,
            appId: 'app1',
            appName: 'Slack',
          },
        ],
      }),
    ]);

    await drillInto(uev, 'Engineering');

    // Scoped to the detail view on purpose: the browse list is hidden rather than
    // unmounted, so its expanded row still carries a group id and a Copy ID button.
    // An unscoped query would match both and is itself proof the list stayed mounted.
    const detail = within(screen.getByTestId('group-detail-view'));

    expect(detail.getByText('g1')).toBeInTheDocument();
    expect(detail.getByRole('button', { name: 'Copy ID' })).toBeInTheDocument();
    expect(detail.getByText('Slack')).toBeInTheDocument();
    expect(detail.getByText('Target group: Engineering (Slack)')).toBeInTheDocument();
    // Okta returns no activation status for an app-group assignment — priority only.
    expect(detail.getByText('Priority 2')).toBeInTheDocument();
    expect(detail.queryByText('ACTIVE')).not.toBeInTheDocument();
  });
});
