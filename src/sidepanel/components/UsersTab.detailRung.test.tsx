/**
 * CHARACTERIZATION TESTS for the Users tab's **detail rung**, as it exists today.
 *
 * The rung is about to be rebuilt into three tabbed panes (Groups / Apps /
 * Profile) with the lifecycle-actions card folded into a tiered `ActionBar`. That
 * moves a lot of DOM. Under ADR-0022(3) a replaced unit has its suite **retargeted
 * assertion by assertion**, never deleted wholesale — which only works if the
 * assertions exist and are legible first. That is what this file is: the current
 * contract, written down so the next wave can prove it survived.
 *
 * **Wave 1 retargets these; it does not delete them.** Each block below says what
 * it protects. Where a query depends on something the rework is explicitly
 * replacing (a tab named "All", a card headed "Lifecycle Actions"), the dependency
 * is isolated in a single helper at the top of the block, so retargeting means
 * editing the helper rather than every assertion under it. Anything that pins
 * behavior nobody is endorsing carries its own `CHARACTERIZATION:` note.
 *
 * Harness: the same one `UsersTab.test.tsx` and `UsersTab.navigation.test.tsx`
 * use. There is no MSW here and there is nothing for it to intercept — the side
 * panel never calls `fetch`; requests go side panel → background scheduler →
 * content script. Stubbing `chrome.runtime.sendMessage` with a regex→responder
 * route table keeps the whole real `useOktaApi` → scheduler stack live and makes
 * scheduler traffic countable, which is the only way to state ADR-0031's
 * one-call-per-row rule as an assertion.
 *
 * Every query is scoped to `within(screen.getByTestId('user-detail-view'))`:
 * jsdom loads no stylesheet, so a subtree hidden by a Tailwind class still answers
 * `screen.getByRole`, and this tab keeps three regions mounted at once.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersTab from './UsersTab';
import { membershipSourceLine, sourceLineLabel } from '../../shared/membership/sourceLine';
import type { GroupMembership, OktaGroup, OktaUser } from '../../shared/types';

// ---------------------------------------------------------------------------
// Hook / module test doubles
// ---------------------------------------------------------------------------
const userContext = vi.hoisted(() => ({
  current: { userInfo: null, isLoading: false, oktaOrigin: null } as {
    userInfo: { userId: string; userName: string; userStatus?: string } | null;
    isLoading: boolean;
    oktaOrigin: string | null;
  },
}));

vi.mock('../hooks/useUserContext', () => ({
  useUserContext: () => userContext.current,
}));

// RulesCache is chrome.storage-backed; stub it so the org rule inventory the
// classifier reads is exactly what a test declares.
const rulesCacheGet = vi.hoisted(() => vi.fn());
const rulesCacheSet = vi.hoisted(() => vi.fn());
vi.mock('../../shared/rulesCache', () => ({
  RulesCache: { get: rulesCacheGet, set: rulesCacheSet },
}));

// addUserToGroup logs an undo action on success; not under test here.
vi.mock('../../shared/undoManager', () => ({
  logAction: vi.fn(),
  logBulkRemoveAction: vi.fn(),
  logBulkAddAction: vi.fn(),
}));

// ---------------------------------------------------------------------------
// chrome mocks — last matching route wins, so a test can override a default
// ---------------------------------------------------------------------------
const runtimeSendMessage = vi.fn();

globalThis.chrome = {
  runtime: {
    sendMessage: runtimeSendMessage,
    getURL: (p: string) => p,
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabs: { sendMessage: vi.fn().mockResolvedValue({ success: false }) },
  storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
} as any;

type Route = [RegExp, (msg: any) => any];
let routes: Route[] = [];
function route(pattern: RegExp, respond: (msg: any) => any) {
  routes.push([pattern, respond]);
}

const schedulerEndpoints = (): string[] =>
  runtimeSendMessage.mock.calls.map((c) => c[0].endpoint).filter(Boolean);

/** The per-membership proof read (ADR-0031) — one request per press, never more. */
const proofCalls = () =>
  schedulerEndpoints().filter((e) =>
    /^\/api\/v1\/groups\/[^/]+\/users\/[^/]+\/group-rules$/.test(e),
  );

/** Lifecycle writes, e.g. `/api/v1/users/00uFAKEada000001/lifecycle/suspend`. */
const lifecycleCalls = () => schedulerEndpoints().filter((e) => e.includes('/lifecycle/'));

// ---------------------------------------------------------------------------
// fixtures — obviously fake ids only
// ---------------------------------------------------------------------------
const ADA_ID = '00uFAKEada000001';

const ada = (over: Record<string, any> = {}): Record<string, any> => {
  const { profile, ...rest } = over;
  return {
    id: ADA_ID,
    status: 'ACTIVE',
    created: '2020-01-01T00:00:00.000Z',
    lastLogin: '2024-01-01T00:00:00.000Z',
    ...rest,
    profile: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      login: 'ada@example.com',
      department: 'Engineering',
      ...(profile ?? {}),
    },
  };
};

/** Fed by an ACTIVE rule whose condition this user provably satisfies. */
const gRuleFed: OktaGroup = {
  id: '00gFAKEgroup0001',
  type: 'OKTA_GROUP',
  profile: { name: 'Engineering Staff', description: 'Eng team' },
};
/** No rule targets it — a manual add. */
const gDirect: OktaGroup = {
  id: '00gFAKEgroup0002',
  type: 'OKTA_GROUP',
  profile: { name: 'Ops Handbook' },
};
/** App-mastered: the application manages its own members, no group rule involved. */
const gAppMastered: OktaGroup = {
  id: '00gFAKEgroup0003',
  type: 'APP_GROUP',
  profile: { name: 'Salesforce Users' },
};

const RULE = {
  id: '0prFAKErule00001',
  name: 'Engineering auto-assign',
  status: 'ACTIVE' as const,
  groupIds: [gRuleFed.id],
  conditions: {
    expression: { value: 'user.department == "Engineering"', type: 'urn:okta:expression:1.0' },
  },
};

/**
 * A membership shaped exactly as the real pipeline produces it, so the expected
 * prose can be **derived** from `membershipSourceLine` rather than hard-coded.
 * The wording is about to move surfaces; where it is worded is not this file's
 * business, only that the same sentence still reaches the reader.
 */
const classified = (group: OktaGroup, over: Partial<GroupMembership> = {}): GroupMembership => ({
  group,
  membershipType: 'DIRECT',
  rules: [],
  attribution: 'exact',
  ...over,
});

// ---------------------------------------------------------------------------
// harness helpers
// ---------------------------------------------------------------------------

/** Everything on the detail rung. Scoping is mandatory — see the file header. */
const detail = () => within(screen.getByTestId('user-detail-view'));

/**
 * Load the detected user through the banner (the tab never auto-fetches) and
 * settle on their detail rung.
 */
async function loadDetectedUser(uev: ReturnType<typeof userEvent.setup>) {
  await uev.click(screen.getByRole('button', { name: 'Load' }));
  await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace' });
}

/**
 * The membership row for one group: the nearest ancestor of that group's heading
 * still containing exactly one group heading.
 *
 * Deliberately structural rather than class-based (ADR-0023 bans asserting on
 * Tailwind classes, and querying by them is the same coupling in reverse). It
 * holds for any layout that nests one group heading per row, which is what makes
 * it survivable across the rework.
 */
function rowFor(groupName: string): HTMLElement {
  const scope = screen.getByTestId('user-detail-view');
  const headings = () => within(scope).getAllByRole('heading', { level: 4 });
  expect(headings().length).toBeGreaterThan(1); // otherwise the walk cannot terminate
  let el: HTMLElement = within(scope).getByRole('heading', { level: 4, name: groupName });
  while (
    el.parentElement &&
    el.parentElement !== scope &&
    within(el.parentElement).getAllByRole('heading', { level: 4 }).length === 1
  ) {
    el = el.parentElement;
  }
  return el;
}

/**
 * The caption + detail one row shows for how the membership was granted, read
 * back as the single sentence `sourceLineLabel` composes.
 */
function sourceSentence(caption: string): string {
  const captionEl = detail().getByText(caption);
  return (captionEl.parentElement?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

beforeEach(() => {
  vi.clearAllMocks();
  routes = [];
  userContext.current = {
    userInfo: { userId: ADA_ID, userName: 'Ada Lovelace', userStatus: 'ACTIVE' },
    isLoading: false,
    oktaOrigin: null,
  };

  route(/^\/api\/v1\/users\?/, () => ({ success: true, data: [] }));
  route(new RegExp(`^/api/v1/users/${ADA_ID}$`), () => ({ success: true, data: ada() }));
  route(new RegExp(`^/api/v1/users/${ADA_ID}/groups`), () => ({ success: true, data: [] }));
  route(/^\/api\/v1\/groups\/rules/, () => ({ success: true, data: [] }));
  route(/^\/api\/v1\/apps/, () => ({ success: true, data: [], headers: {} }));

  rulesCacheGet.mockResolvedValue({ rules: [RULE] });
  rulesCacheSet.mockResolvedValue(undefined);

  runtimeSendMessage.mockImplementation(async (msg: any) => {
    if (msg.action !== 'scheduleApiRequest') return { success: false };
    for (let i = routes.length - 1; i >= 0; i--) {
      const [pattern, respond] = routes[i];
      if (pattern.test(msg.endpoint)) return respond(msg);
    }
    return { success: false, error: `unrouted endpoint: ${msg.endpoint}` };
  });
});

// ===========================================================================
// 1. Every membership states its source, in the shared wording.
//
//    Wave 1 moves these rows into a Groups pane. RETARGET, do not delete: the
//    contract is that each classification still reaches the reader as the
//    sentence `membershipSourceLine` composes for it — which is why the expected
//    strings here are derived from that function rather than typed out. Three of
//    the four cases (UNKNOWN, app-mastered, rule-managed-but-unattributed) once
//    rendered as blank space on this surface, so "it says something" is the
//    load-bearing half of the assertion.
// ===========================================================================
describe('detail rung: memberships render with their source line', () => {
  it('words a rule-attributed, a direct and an app-mastered membership as `membershipSourceLine` does', async () => {
    const uev = userEvent.setup();
    route(new RegExp(`^/api/v1/users/${ADA_ID}/groups`), () => ({
      success: true,
      data: [gRuleFed, gDirect, gAppMastered],
    }));

    render(<UsersTab targetTabId={1} />);
    await loadDetectedUser(uev);
    await detail().findByRole('heading', { level: 4, name: 'Engineering Staff' });

    // The classifier's own answers, as the pipeline produces them: a rule whose
    // condition provably matches (`exact`, rules named), an untargeted group
    // (DIRECT), and an APP_GROUP (RULE_BASED with no rule to name).
    const ruleFed = membershipSourceLine(
      classified(gRuleFed, { membershipType: 'RULE_BASED', rules: [RULE] }),
    );
    const direct = membershipSourceLine(classified(gDirect));
    const appMastered = membershipSourceLine(
      classified(gAppMastered, { membershipType: 'RULE_BASED' }),
    );

    expect(sourceSentence(ruleFed.caption)).toBe(sourceLineLabel(ruleFed));
    expect(sourceSentence(direct.caption)).toBe(sourceLineLabel(direct));
    expect(sourceSentence(appMastered.caption)).toBe(sourceLineLabel(appMastered));

    // Each sentence belongs to its own row, not to whichever row rendered first.
    expect(within(rowFor('Engineering Staff')).getByText(ruleFed.caption)).toBeInTheDocument();
    expect(within(rowFor('Ops Handbook')).getByText(direct.caption)).toBeInTheDocument();
    expect(within(rowFor('Salesforce Users')).getByText(appMastered.caption)).toBeInTheDocument();
  });

  it('says an UNKNOWN membership was never classified rather than showing nothing', async () => {
    const uev = userEvent.setup();
    // The only way to reach UNKNOWN from this surface: the rule inventory could
    // not be obtained, so nothing may be concluded about any group (ADR-0020).
    rulesCacheGet.mockResolvedValue(null);
    route(/^\/api\/v1\/groups\/rules/, () => ({ success: false, error: 'rules unavailable' }));
    route(new RegExp(`^/api/v1/users/${ADA_ID}/groups`), () => ({
      success: true,
      data: [gRuleFed],
    }));

    render(<UsersTab targetTabId={1} />);
    await loadDetectedUser(uev);
    await detail().findByRole('heading', { level: 4, name: 'Engineering Staff' });

    const unknown = membershipSourceLine(
      classified(gRuleFed, { membershipType: 'UNKNOWN', attribution: 'ambiguous' }),
    );
    expect(sourceSentence(unknown.caption)).toBe(sourceLineLabel(unknown));
    // CHARACTERIZATION: a failed rules fetch degrades the answer but is never
    // reported as a load failure — no banner carries the underlying error, and
    // nothing on the rung claims the user was added by hand.
    expect(screen.queryByText('rules unavailable')).not.toBeInTheDocument();
    expect(detail().queryByText('Added directly')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 2. Lifecycle gating is driven by the user's Okta status.
//
//    Wave 1 folds these buttons into a tiered ActionBar. RETARGET, do not
//    delete: which verbs a status offers, and that every verb confirms before it
//    acts, are the contract — where the buttons sit is not.
// ===========================================================================
describe('detail rung: lifecycle verbs are gated by status', () => {
  /** The full vocabulary; a status is characterized by which subset it offers. */
  const ALL_VERBS = ['Suspend User', 'Unsuspend User', 'Reset Password'] as const;

  /** Which verbs the rung currently offers, in vocabulary order. */
  const offeredVerbs = () =>
    ALL_VERBS.filter((name) => detail().queryByRole('button', { name }) !== null);

  async function renderWithStatus(
    uev: ReturnType<typeof userEvent.setup>,
    status: OktaUser['status'],
  ) {
    userContext.current = {
      userInfo: { userId: ADA_ID, userName: 'Ada Lovelace', userStatus: status },
      isLoading: false,
      oktaOrigin: null,
    };
    route(new RegExp(`^/api/v1/users/${ADA_ID}$`), () => ({
      success: true,
      data: ada({ status }),
    }));
    render(<UsersTab targetTabId={1} />);
    await loadDetectedUser(uev);
  }

  it('offers suspend and reset-password — and not unsuspend — for an ACTIVE user', async () => {
    const uev = userEvent.setup();
    await renderWithStatus(uev, 'ACTIVE');

    expect(offeredVerbs()).toEqual(['Suspend User', 'Reset Password']);
  });

  it('offers unsuspend only for a SUSPENDED user', async () => {
    const uev = userEvent.setup();
    await renderWithStatus(uev, 'SUSPENDED');

    // CHARACTERIZATION: reset-password is withheld from a suspended user, who
    // cannot sign in to use it. Nobody has endorsed that as a rule — it is what
    // the status gate does today, and the rework must not change it silently.
    expect(offeredVerbs()).toEqual(['Unsuspend User']);
  });

  it('offers nothing for a DEPROVISIONED user, and says so instead of rendering an empty card', async () => {
    const uev = userEvent.setup();
    await renderWithStatus(uev, 'DEPROVISIONED');

    expect(offeredVerbs()).toEqual([]);
    expect(
      detail().getByText('No lifecycle actions are available for deprovisioned users.'),
    ).toBeInTheDocument();
  });

  it.each([
    {
      status: 'ACTIVE' as const,
      verb: 'Suspend User',
      dialogTitle: 'Suspend User',
      confirm: 'Suspend',
      endpoint: `/api/v1/users/${ADA_ID}/lifecycle/suspend`,
    },
    {
      status: 'ACTIVE' as const,
      verb: 'Reset Password',
      dialogTitle: 'Reset Password',
      confirm: 'Send Reset Email',
      endpoint: `/api/v1/users/${ADA_ID}/lifecycle/reset_password?sendEmail=true`,
    },
    {
      status: 'SUSPENDED' as const,
      verb: 'Unsuspend User',
      dialogTitle: 'Unsuspend User',
      confirm: 'Unsuspend',
      endpoint: `/api/v1/users/${ADA_ID}/lifecycle/unsuspend`,
    },
  ])('confirms before acting: $verb', async ({ status, verb, dialogTitle, confirm, endpoint }) => {
    const uev = userEvent.setup();
    route(/\/lifecycle\//, () => ({ success: true }));
    await renderWithStatus(uev, status);

    await uev.click(detail().getByRole('button', { name: verb }));

    // Armed, not fired: a dialog stands between the verb and Okta.
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: dialogTitle })).toBeInTheDocument();
    expect(lifecycleCalls()).toEqual([]);

    await uev.click(within(dialog).getByRole('button', { name: confirm }));

    await waitFor(() => expect(lifecycleCalls()).toEqual([endpoint]));
  });

  it('cancelling the confirm dialog issues nothing at all', async () => {
    const uev = userEvent.setup();
    route(/\/lifecycle\//, () => ({ success: true }));
    await renderWithStatus(uev, 'ACTIVE');

    await uev.click(detail().getByRole('button', { name: 'Suspend User' }));
    await uev.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(lifecycleCalls()).toEqual([]);
    // Still offered — cancelling arms nothing and consumes nothing.
    expect(offeredVerbs()).toEqual(['Suspend User', 'Reset Password']);
  });
});

// ===========================================================================
// 3. "Prove it" is one call per row, per click (ADR-0031).
//
//    Wave 1 moves this into the Groups pane. RETARGET, do not delete: the whole
//    point of the affordance is its cost. A forty-group user is forty requests,
//    so it may never run on mount, never for a list, and never for a row nobody
//    pressed. Counting scheduler endpoints is the only way to say that.
// ===========================================================================
describe('detail rung: proving one membership costs exactly one request', () => {
  const proofEndpoint = (group: OktaGroup) =>
    `/api/v1/groups/${group.id}/users/${ADA_ID}/group-rules`;

  async function renderWithTwoGroups(uev: ReturnType<typeof userEvent.setup>) {
    route(new RegExp(`^/api/v1/users/${ADA_ID}/groups`), () => ({
      success: true,
      data: [gRuleFed, gDirect],
    }));
    render(<UsersTab targetTabId={1} />);
    await loadDetectedUser(uev);
    await detail().findByRole('heading', { level: 4, name: 'Engineering Staff' });
  }

  it('asks nothing on mount, then exactly once for the row that was pressed', async () => {
    const uev = userEvent.setup();
    route(/\/group-rules$/, () => ({ success: true, data: [] }));
    await renderWithTwoGroups(uev);

    // Two rows, two offers, and nothing spent until one is taken. The endpoint
    // count is asserted first, so an auto-proving regression fails as "it asked"
    // rather than as "the button vanished".
    expect(proofCalls()).toEqual([]);
    expect(detail().getAllByRole('button', { name: /Prove it/ })).toHaveLength(2);

    await uev.click(within(rowFor('Engineering Staff')).getByRole('button', { name: /Prove it/ }));

    // One row, one request — the other row is untouched.
    await waitFor(() => expect(proofCalls()).toEqual([proofEndpoint(gRuleFed)]));

    await uev.click(within(rowFor('Ops Handbook')).getByRole('button', { name: /Prove it/ }));

    await waitFor(() =>
      expect(proofCalls()).toEqual([proofEndpoint(gRuleFed), proofEndpoint(gDirect)]),
    );
  });

  it("replaces that one row's deduction with Okta's answer, and leaves every other row hedged", async () => {
    const uev = userEvent.setup();
    route(/\/group-rules$/, () => ({
      success: true,
      data: [{ id: RULE.id, name: RULE.name }],
    }));
    await renderWithTwoGroups(uev);

    const deduced = membershipSourceLine(
      classified(gRuleFed, { membershipType: 'RULE_BASED', rules: [RULE] }),
    );
    const proven = membershipSourceLine(
      classified(gRuleFed, {
        membershipType: 'RULE_BASED',
        rules: [RULE],
        provenance: { source: 'okta', rules: [{ id: RULE.id, name: RULE.name }] },
      }),
    );
    const otherRow = membershipSourceLine(classified(gDirect));

    await uev.click(within(rowFor('Engineering Staff')).getByRole('button', { name: /Prove it/ }));

    expect(await detail().findByText(sourceLineLabel(proven))).toBeInTheDocument();
    // CHARACTERIZATION: Okta's answer is added *beside* the deduction, never over
    // it — the row keeps saying what the classifier worked out, then what Okta
    // says. The rework must not collapse the two into one line.
    expect(sourceSentence(deduced.caption)).toBe(sourceLineLabel(deduced));
    expect(sourceSentence(otherRow.caption)).toBe(sourceLineLabel(otherRow));
    expect(
      within(rowFor('Ops Handbook')).getByRole('button', { name: /Prove it/ }),
    ).toBeInTheDocument();
  });

  it('reports a failed proof as no answer rather than as an answer', async () => {
    const uev = userEvent.setup();
    route(/\/group-rules$/, () => ({ success: false, error: 'nope' }));
    await renderWithTwoGroups(uev);

    await uev.click(within(rowFor('Engineering Staff')).getByRole('button', { name: /Prove it/ }));

    expect(
      await detail().findByText(/Okta did not answer for this membership/),
    ).toBeInTheDocument();
    // One request, and the failure never becomes "Okta confirms: added directly".
    expect(proofCalls()).toEqual([proofEndpoint(gRuleFed)]);
    expect(detail().queryByText(/^Okta confirms/)).not.toBeInTheDocument();
    expect(screen.queryByText('nope')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 4. The user's profile attributes are reachable from the rung.
//
//    Wave 1 replaces the tab strip with a Profile pane, so the assertions here
//    are about the *capability* — a named attribute and its value are findable,
//    and a filter narrows the surface to it — never about a tab called "All".
//    RETARGET the one helper below; the assertions under it should stand
//    unchanged.
// ===========================================================================
describe('detail rung: profile attributes are reachable and filterable', () => {
  /**
   * The ONE place this block knows how today's rung exposes the full attribute
   * list: a profile tab named "All". Wave 1 replaces this navigation, not the
   * expectations that follow it.
   */
  async function openAttributeSurface(uev: ReturnType<typeof userEvent.setup>) {
    await uev.click(detail().getByRole('tab', { name: 'All' }));
    return detail().getByPlaceholderText(/Filter all attributes/);
  }

  async function renderWithProfile(uev: ReturnType<typeof userEvent.setup>) {
    route(new RegExp(`^/api/v1/users/${ADA_ID}$`), () => ({
      success: true,
      data: ada({ profile: { title: 'Countess of Lovelace' } }),
    }));
    render(<UsersTab targetTabId={1} />);
    await loadDetectedUser(uev);
  }

  it('exposes a named attribute and its value', async () => {
    const uev = userEvent.setup();
    await renderWithProfile(uev);
    await openAttributeSurface(uev);

    expect(detail().getByText('title')).toBeInTheDocument();
    expect(detail().getByText('Countess of Lovelace')).toBeInTheDocument();
    expect(detail().getByText('login')).toBeInTheDocument();
  });

  it('narrows the attribute list to a subset when filtered', async () => {
    const uev = userEvent.setup();
    await renderWithProfile(uev);
    const filter = await openAttributeSurface(uev);

    await uev.type(filter, 'countess');

    // Matched on the value, not just the label — the filter reads both.
    expect(detail().getByText('title')).toBeInTheDocument();
    expect(detail().getByText('Countess of Lovelace')).toBeInTheDocument();
    expect(detail().queryByText('login')).not.toBeInTheDocument();

    await uev.clear(filter);
    await uev.type(filter, 'no-such-attribute');

    expect(detail().getByText('No matching attributes')).toBeInTheDocument();
    expect(detail().queryByText('title')).not.toBeInTheDocument();
  });
});
