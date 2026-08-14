/**
 * The member-source breakdown is *derived* from a group's member list, so it must
 * never outlive it. This suite pins that relationship end to end through the real
 * `registerDerived('memberSource', 'groupMembers')` wiring rather than a
 * test-local registration — the generic cascade already has coverage in
 * `entityCache.test.ts`; what matters here is that this module's own registration
 * is actually in force.
 *
 * Why it matters on screen: the Group Detail view renders the manual-vs-rule
 * meter directly above the membership controls. A breakdown that survived a
 * membership write would assert a pre-mutation split for the rest of its
 * 30-minute TTL, and stale authority reads exactly like fresh authority.
 *
 * Fixtures use only fake placeholders (`00gFAKE…`) per CLAUDE.md.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readMemberSource, writeMemberSource } from './memberSourceCache';
import { invalidate, resetEntityCache } from './entityCache';
import { cacheKeys } from './keys';
import type { MemberSourceBreakdown } from '../../shared/membership/groupSource';

/** A minimal, invariant-respecting breakdown (`direct + ruleBased === total`). */
const breakdown: MemberSourceBreakdown = {
  total: 10,
  direct: 4,
  ruleBased: 6,
  unattributed: 0,
  byRule: [],
};

describe('memberSourceCache derivation', () => {
  beforeEach(() => {
    resetEntityCache();
  });

  it('serves a written breakdown back', () => {
    writeMemberSource('00gFAKE1', breakdown);

    expect(readMemberSource('00gFAKE1')).toEqual(breakdown);
  });

  /**
   * The whole point of the registration: a caller that drops the member list does
   * not have to know a breakdown exists, or name its key.
   */
  it('drops the breakdown when its source member list is invalidated', () => {
    writeMemberSource('00gFAKE1', breakdown);

    invalidate(cacheKeys.groupMembers('00gFAKE1'));

    expect(readMemberSource('00gFAKE1')).toBeNull();
  });

  /** The cascade rewrites only the leading segment, so it stays scoped to one group. */
  it('leaves another group’s breakdown alone', () => {
    writeMemberSource('00gFAKE1', breakdown);
    writeMemberSource('00gFAKE2', breakdown);

    invalidate(cacheKeys.groupMembers('00gFAKE1'));

    expect(readMemberSource('00gFAKE1')).toBeNull();
    expect(readMemberSource('00gFAKE2')).toEqual(breakdown);
  });

  /**
   * The cascade fires on the *requested* key, not only on what happened to be
   * cached — a breakdown can outlive the member list it came from (different
   * TTLs), and invalidating pre-emptively after a write is the normal path.
   */
  it('drops the breakdown even when the member list itself was never cached', () => {
    writeMemberSource('00gFAKE1', breakdown);

    invalidate(cacheKeys.groupMembers('00gFAKE1'));

    expect(readMemberSource('00gFAKE1')).toBeNull();
  });
});
