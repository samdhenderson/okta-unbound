/**
 * Tests for the group-member operations' paginated member fetch: zod validation
 * at the response boundary (ADR-0006) — malformed rows are dropped leniently by
 * `parseOktaList`, never thrown on.
 *
 * Fixtures use only fake placeholders (`00uFAKE…`, `00gFAKE…`, `example.com`)
 * per CLAUDE.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { createGroupMemberOperations } from './groupMembers';
import type { CoreApi } from './core';
import type { OktaUser } from './types';
import {
  makeFakeCore,
  sequentialRunOperation,
  type FakeCoreOverrides,
} from '@/test/factories/coreApi';

// The write paths log an undo entry through IndexedDB, which is not the subject
// of any assertion here.
vi.mock('../../../shared/undoManager', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }));

/** Build a fake CoreApi whose transport is fully mocked. */
// `FakeCoreOverrides`, not `Partial<CoreApi>`: the factory deliberately loosens
// the generic `runOperation` field so a fake executor can be passed at all.
const makeCore = (overrides: FakeCoreOverrides = {}): CoreApi => makeFakeCore(overrides);

/** A schema-valid group member row. */
const validMember = {
  id: '00uFAKE1',
  status: 'ACTIVE',
  profile: {
    login: 'ada@example.com',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Fake',
  },
};

describe('getAllGroupMembers boundary validation', () => {
  it('drops malformed member rows leniently instead of failing the fetch', async () => {
    // Missing the required `profile` — the lenient list parser drops it.
    const malformed = { id: '00uFAKE2', status: 'ACTIVE' };
    const makeApiRequest = vi.fn().mockResolvedValue({
      success: true,
      data: [validMember, malformed],
      headers: {},
    });
    const core = makeCore({ makeApiRequest });
    const { getAllGroupMembers } = createGroupMemberOperations(core);

    const members = await getAllGroupMembers('00gFAKE1');

    expect(makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/groups/00gFAKE1/users?limit=200&expand=group-rules',
    );
    expect(members.map((m) => m.id)).toEqual(['00uFAKE1']);
  });
});

/**
 * The member listing asks Okta for its own per-member rule attribution via the
 * private `expand=group-rules` parameter — the same one the admin console uses.
 * It rides along on a request the app already makes, so it costs nothing; the
 * only subtlety is that Okta does NOT echo it into its `rel="next"` link, so it
 * has to be re-applied on every later page or attribution would be exact for the
 * first 200 members and inferred for everyone after them.
 */
describe('getAllGroupMembers rule attribution', () => {
  /** Wrap a path in an Okta-style `rel="next"` Link header. */
  function nextLink(path: string): string {
    return `<https://example.okta.com${path}>; rel="next"`;
  }

  it('requests expand=group-rules and preserves the embed on the row', async () => {
    const embedded = { 'group-rules': [{ id: '0prFAKE1', name: 'Eng feeder' }] };
    const makeApiRequest = vi.fn().mockResolvedValue({
      success: true,
      data: [{ ...validMember, _embedded: embedded }],
      headers: {},
    });
    const { getAllGroupMembers } = createGroupMemberOperations(makeCore({ makeApiRequest }));

    const members = await getAllGroupMembers('00gFAKE1');

    expect(makeApiRequest).toHaveBeenCalledWith(
      '/api/v1/groups/00gFAKE1/users?limit=200&expand=group-rules',
    );
    expect(members[0]).toMatchObject({ _embedded: embedded });
  });

  it('re-applies the dropped expand on every page after the first', async () => {
    const page1 = '/api/v1/groups/00gFAKE1/users?limit=200&expand=group-rules';
    // Exactly what Okta hands back: the private expand is gone.
    const droppedNext = '/api/v1/groups/00gFAKE1/users?limit=200&after=cursor2';
    const makeApiRequest = vi.fn(async (url: string) => {
      const headers: Record<string, string> = url === page1 ? { link: nextLink(droppedNext) } : {};
      const data = url === page1 ? [validMember] : [{ ...validMember, id: '00uFAKE2' }];
      return { success: true, data, headers };
    });
    const { getAllGroupMembers } = createGroupMemberOperations(makeCore({ makeApiRequest }));

    const members = await getAllGroupMembers('00gFAKE1');

    expect(makeApiRequest).toHaveBeenNthCalledWith(2, `${droppedNext}&expand=group-rules`);
    expect(members.map((m) => m.id)).toEqual(['00uFAKE1', '00uFAKE2']);
  });
});

/**
 * Every membership write reports its group id so the assembly point
 * (`useOktaApi`) can drop that group's cached member list — and, by the
 * `registerDerived` cascade, its derived member-source breakdown.
 *
 * The callback lives on the primitive rather than at the call sites because
 * there are six of them and two (`groupBulkOps`, `groupCleanup`) sit inside this
 * same API layer, receiving `removeUserFromGroup` injected.
 */
describe('membership-change reporting', () => {
  const user: OktaUser = {
    id: '00uFAKE1',
    status: 'ACTIVE',
    profile: {
      login: 'ada@example.com',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Fake',
    },
  };

  it('reports the group after a successful add', async () => {
    const onMembershipChanged = vi.fn();
    const core = makeCore({ makeApiRequest: vi.fn().mockResolvedValue({ success: true }) });
    const { addUserToGroup } = createGroupMemberOperations(core, onMembershipChanged);

    await addUserToGroup('00gFAKE1', 'Sales', user);

    expect(onMembershipChanged).toHaveBeenCalledWith('00gFAKE1');
  });

  it('reports the group after a successful removal', async () => {
    const onMembershipChanged = vi.fn();
    const core = makeCore({ makeApiRequest: vi.fn().mockResolvedValue({ success: true }) });
    const { removeUserFromGroup } = createGroupMemberOperations(core, onMembershipChanged);

    await removeUserFromGroup('00gFAKE1', 'Sales', user);

    expect(onMembershipChanged).toHaveBeenCalledWith('00gFAKE1');
  });

  /**
   * `skipUndoLog` suppresses the per-user *audit* entry a bulk caller aggregates
   * at the end. It says nothing about whether membership moved, so the cache must
   * still be dropped — this is the path `groupCleanup` and `useGroupMerge` take.
   */
  it('reports the group even when the undo entry is suppressed', async () => {
    const onMembershipChanged = vi.fn();
    const core = makeCore({ makeApiRequest: vi.fn().mockResolvedValue({ success: true }) });
    const { removeUserFromGroup } = createGroupMemberOperations(core, onMembershipChanged);

    await removeUserFromGroup('00gFAKE1', 'Sales', user, true);

    expect(onMembershipChanged).toHaveBeenCalledWith('00gFAKE1');
  });

  it('reports nothing when the write failed', async () => {
    const onMembershipChanged = vi.fn();
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: false, error: 'denied' }),
    });
    const { addUserToGroup, removeUserFromGroup } = createGroupMemberOperations(
      core,
      onMembershipChanged,
    );

    await addUserToGroup('00gFAKE1', 'Sales', user);
    await removeUserFromGroup('00gFAKE2', 'Eng', user);

    expect(onMembershipChanged).not.toHaveBeenCalled();
  });

  it('reports each group the multi-group removal actually cleared', async () => {
    const onMembershipChanged = vi.fn();
    const core = makeCore({
      makeApiRequest: vi.fn().mockResolvedValue({ success: true }),
      // The inert default would never invoke the per-group task, so the callback
      // could not fire and the test would pass for the wrong reason.
      runOperation: sequentialRunOperation(),
    });
    const { removeUserFromGroups } = createGroupMemberOperations(core, onMembershipChanged);

    await removeUserFromGroups('00uFAKE1', ['00gFAKE1', '00gFAKE2']);

    expect(onMembershipChanged.mock.calls.map(([id]) => id)).toEqual(['00gFAKE1', '00gFAKE2']);
  });

  it('is optional — the operations work without a listener', async () => {
    const core = makeCore({ makeApiRequest: vi.fn().mockResolvedValue({ success: true }) });
    const { addUserToGroup } = createGroupMemberOperations(core);

    await expect(addUserToGroup('00gFAKE1', 'Sales', user)).resolves.toMatchObject({
      success: true,
    });
  });
});

/**
 * The per-membership proof read (ADR-0031): one documented call that answers
 * "which rules manage *this* user's membership of *this* group", for a surface
 * whose only other option is a heuristic.
 *
 * What matters here is the same thing that matters in the embed reader: **three**
 * states. A `200` with an empty list is Okta asserting a manual add; a failure,
 * or a body that is not a rule list, is Okta saying nothing. A test that let the
 * second become the first would be signing off on a manufactured fact.
 */
describe('getMembershipRuleProof', () => {
  const proofOf = (result: unknown, transport = vi.fn().mockResolvedValue(result)) => ({
    transport,
    proof: createGroupMemberOperations(makeCore({ makeApiRequest: transport }))
      .getMembershipRuleProof,
  });

  it('asks the documented per-membership endpoint, once, with no pagination', async () => {
    const { transport, proof } = proofOf({ success: true, data: [] });

    await proof('00gFAKE1', '00uFAKE1');

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith('/api/v1/groups/00gFAKE1/users/00uFAKE1/group-rules');
  });

  it('reports the rules Okta names', async () => {
    const { proof } = proofOf({
      success: true,
      data: [{ id: '0prFAKE1', name: 'Eng feeder' }],
    });

    await expect(proof('00gFAKE1', '00uFAKE1')).resolves.toEqual({
      state: 'rules',
      rules: [{ id: '0prFAKE1', name: 'Eng feeder' }],
    });
  });

  it('reports an empty list as an authoritative manual add, not as no answer', async () => {
    const { proof } = proofOf({ success: true, data: [] });

    await expect(proof('00gFAKE1', '00uFAKE1')).resolves.toEqual({ state: 'no-rules' });
  });

  it('unwraps the list when Okta nests it under the key it uses elsewhere', async () => {
    const { proof } = proofOf({
      success: true,
      data: { 'group-rules': [{ id: '0prFAKE1', name: 'Eng feeder' }] },
    });

    await expect(proof('00gFAKE1', '00uFAKE1')).resolves.toMatchObject({ state: 'rules' });
  });

  it('reports a failed request as unknown rather than as a manual add', async () => {
    const { proof } = proofOf({ success: false, status: 403, error: 'denied' });

    await expect(proof('00gFAKE1', '00uFAKE1')).resolves.toEqual({ state: 'unknown' });
  });

  it.each([
    ['a null body', null],
    ['a string body', 'nope'],
    ['an object that is not the rule list', { total: 2 }],
    ['a list of unusable entries', [null, { id: 42 }]],
  ])('degrades %s to unknown, never to "no rule"', async (_label, data) => {
    const { proof } = proofOf({ success: true, data });

    await expect(proof('00gFAKE1', '00uFAKE1')).resolves.toEqual({ state: 'unknown' });
  });
});
