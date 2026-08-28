/**
 * Tests for useOrgEntityIndex — Home's one read of the org snapshot.
 *
 * The subject is the **negative** answer. A hit needs no defending: a row that
 * is present was returned by Okta. A miss is the dangerous one, because an
 * interrupted walk leaves real rows behind and an id that is merely *not
 * fetched yet* looks exactly like one that does not exist. Reporting the second
 * when it is the first is ADR-0040 §7's partial-served-as-complete defect, so
 * every case below is about which of `miss` and `unknown` comes back.
 *
 * `useOrgSnapshot` is mocked: its own reads, broadcasts and sync ladder have
 * their own subject, and driving IndexedDB here would test that module twice
 * instead of testing this one.
 *
 * All ids are fake, per the repo's no-secrets rule.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { UseOrgSnapshotResult } from '../cache/useOrgSnapshot';

const useOrgSnapshot = vi.fn();
vi.mock('../cache/useOrgSnapshot', () => ({
  useOrgSnapshot: (...args: unknown[]) => useOrgSnapshot(...args),
}));

const { useOrgEntityIndex } = await import('./useOrgEntityIndex');

const GROUP_ID = '00gFAKE0000000000001';
const RULE_ID = '0prFAKE0000000000001';
const APP_ID = '0oaFAKE0000000000001';
const USER_ID = '00uFAKE0000000000001';
const ABSENT_ID = '00gFAKE0000000000009';

const ORIGIN = 'https://example.okta.com';

/** A snapshot handle carrying the rows and completeness a case needs. */
function snapshot<T>(rows: T[], complete: boolean): UseOrgSnapshotResult<T> {
  return {
    rows,
    records: rows.map((entity, i) => ({ origin: ORIGIN, id: String(i), entity, syncedAt: 0 })),
    isReading: false,
    complete,
    lastFullWalkAt: complete ? 1 : null,
    isSyncing: false,
    error: null,
    sync: vi.fn(async () => null),
  } as unknown as UseOrgSnapshotResult<T>;
}

/**
 * Stage one snapshot per collection. Defaults are populated and complete, so a
 * case states only the axis it is about.
 */
function stage({
  groupsComplete = true,
  rulesComplete = true,
  appsComplete = true,
}: {
  groupsComplete?: boolean;
  rulesComplete?: boolean;
  appsComplete?: boolean;
} = {}) {
  const byCollection: Record<string, unknown> = {
    groups: snapshot(
      [{ id: GROUP_ID, type: 'OKTA_GROUP', profile: { name: 'Engineering' } }],
      groupsComplete,
    ),
    rules: snapshot(
      [{ id: RULE_ID, name: 'Eng — All ICs', status: 'INACTIVE', type: 'group_rule' }],
      rulesComplete,
    ),
    apps: snapshot([{ id: APP_ID, name: 'datadog', label: 'Datadog' }], appsComplete),
  };
  useOrgSnapshot.mockImplementation((collection: string) => byCollection[collection]);
  return renderHook(() => useOrgEntityIndex({ oktaOrigin: ORIGIN, targetTabId: 1, enabled: true }))
    .result;
}

describe('useOrgEntityIndex', () => {
  beforeEach(() => useOrgSnapshot.mockReset());

  describe('hits', () => {
    it('resolves a group to its profile name', () => {
      expect(stage().current.lookup('group', GROUP_ID)).toEqual({
        status: 'hit',
        entity: { kind: 'group', id: GROUP_ID, name: 'Engineering' },
      });
    });

    it('carries a rule’s status, the one fact it can state for free', () => {
      expect(stage().current.lookup('rule', RULE_ID)).toEqual({
        status: 'hit',
        entity: { kind: 'rule', id: RULE_ID, name: 'Eng — All ICs', secondary: 'Paused' },
      });
    });

    it('prefers an app’s human label over its API name', () => {
      const found = stage().current.lookup('app', APP_ID);
      expect(found).toMatchObject({ status: 'hit', entity: { name: 'Datadog' } });
    });

    it('tolerates a pasted id with surrounding whitespace', () => {
      expect(stage().current.lookup('group', `  ${GROUP_ID} `)).toMatchObject({ status: 'hit' });
    });

    it('answers from an incomplete collection too — a present row is a real row', () => {
      // The completeness gate guards absences, not presences. A row that is
      // there was returned by Okta whether or not the walk that fetched it
      // finished, so withholding it would spend a request to learn nothing.
      expect(stage({ groupsComplete: false }).current.lookup('group', GROUP_ID)).toMatchObject({
        status: 'hit',
      });
    });
  });

  describe('the completeness gate', () => {
    it('reports a supported absence when the last walk finished', () => {
      expect(stage().current.lookup('group', ABSENT_ID)).toEqual({ status: 'miss' });
    });

    it('reports unknown when it did not, rather than an absence it cannot support', () => {
      expect(stage({ groupsComplete: false }).current.lookup('group', ABSENT_ID)).toEqual({
        status: 'unknown',
      });
    });

    it('gates each collection independently', () => {
      // One interrupted walk must not make the other two untrustworthy, and a
      // single `complete` flag for all three would do exactly that.
      const result = stage({ rulesComplete: false });
      expect(result.current.isAuthoritative('group')).toBe(true);
      expect(result.current.isAuthoritative('app')).toBe(true);
      expect(result.current.isAuthoritative('rule')).toBe(false);
      expect(result.current.lookup('group', ABSENT_ID)).toEqual({ status: 'miss' });
      expect(result.current.lookup('rule', '0prFAKE0000000000009')).toEqual({ status: 'unknown' });
    });
  });

  describe('users', () => {
    it('never answers for a user, however complete the other collections are', () => {
      // ADR-0040 §5 keeps the largest and most personal collection in the org
      // out of local storage. So the index cannot confirm OR deny a user id,
      // and says so rather than returning a miss the caller would trust.
      expect(stage().current.lookup('user', USER_ID)).toEqual({ status: 'unknown' });
    });
  });

  it('reads each collection exactly once, and passes the enabled gate through', () => {
    // Two consumers each mounting their own `useOrgSnapshot` for the same
    // collection would open two IndexedDB reads and register two broadcast
    // listeners to answer one question; the whole point of this hook is that
    // Home mounts them once.
    stage();
    const collections = useOrgSnapshot.mock.calls.map((call) => call[0]);
    expect([...new Set(collections)].sort()).toEqual(['apps', 'groups', 'rules']);
    for (const call of useOrgSnapshot.mock.calls) {
      expect(call[1]).toBe(ORIGIN);
      expect(call[3]).toEqual({ enabled: true });
    }
  });
});
