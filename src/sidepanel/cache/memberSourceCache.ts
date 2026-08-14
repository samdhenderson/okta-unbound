/**
 * @module sidepanel/cache/memberSourceCache
 * @description Session-scoped storage for computed member-source breakdowns.
 *
 * The manual-vs-rule split for a group is **expensive** — it reads every member
 * of the group (`ceil(N/200)` scheduled requests) and classifies each one — so it
 * is only ever computed on an explicit user action in the Group Detail view.
 * This module is where that result is banked, keyed by group id, so cheap
 * read-only consumers (notably each row's compact meter in the groups list) can
 * show it without paying for it again.
 *
 * The split is one-way by design:
 *
 * - {@link writeMemberSource} is called by the *one* place that computes a
 *   breakdown ({@link module:sidepanel/hooks/useGroupSource}).
 * - {@link readMemberSource} / {@link subscribeMemberSource} are pure reads. They
 *   have no access to the API, so a consumer of this module **cannot** trigger a
 *   fetch, which is what keeps the list from stampeding the scheduler.
 *
 * @see {@link module:sidepanel/hooks/useCachedMemberSource}
 */

import { peek, registerDerived, setEntry, subscribe, type EntityKey } from './entityCache';
import { cacheKeys, TTL_LONG } from './keys';
import type { MemberSourceBreakdown } from '../../shared/membership/groupSource';

/**
 * A breakdown is summarised from the group's member list, so it must not outlive
 * it. Declared here, beside the derived cache, so the relationship is stated where
 * the derivation is — not in whichever call site happens to invalidate first.
 *
 * Closes the half of `useGroupSource`'s former `KNOWN GAP` that this module owns:
 * any path invalidating `groupMembers` for a group also drops that group's
 * breakdown, instead of letting a pre-mutation split stay on screen for its
 * 30-minute TTL. The other half — the single-membership write paths that never
 * invalidated `groupMembers` at all — is now closed too: every write in
 * `useOktaApi/groupMembers` reports its group id, and `useOktaApi` invalidates
 * this key's source. Nothing here needs to name `memberSource` to benefit.
 */
registerDerived('memberSource', 'groupMembers');

/**
 * How long a computed breakdown stays presentable, in milliseconds.
 *
 * Longer than the cache's 5-minute default because the analysis is expensive and
 * a membership split does not churn minute to minute; short enough that a row
 * stops asserting a split that predates a bulk membership change.
 */
export const MEMBER_SOURCE_TTL = TTL_LONG;

/**
 * The entity-cache key a group's breakdown is stored under.
 *
 * @param groupId - The Okta group id.
 * @returns A composite key, so `invalidate(['memberSource'])` drops them all.
 */
export function memberSourceKey(groupId: string): EntityKey {
  return cacheKeys.memberSource(groupId);
}

/**
 * Read a group's already-computed member-source breakdown.
 *
 * @param groupId - The Okta group id.
 * @returns The breakdown, or `null` on a miss or once it has passed
 *   {@link MEMBER_SOURCE_TTL}. Never fetches.
 */
export function readMemberSource(groupId: string): MemberSourceBreakdown | null {
  return peek<MemberSourceBreakdown>(memberSourceKey(groupId));
}

/**
 * Bank a freshly computed breakdown for a group and notify every reader.
 *
 * @param groupId - The Okta group id the breakdown describes.
 * @param breakdown - The computed split.
 */
export function writeMemberSource(groupId: string, breakdown: MemberSourceBreakdown): void {
  setEntry(memberSourceKey(groupId), breakdown, { ttl: MEMBER_SOURCE_TTL });
}

/**
 * Subscribe to writes/invalidations of one group's breakdown.
 *
 * @param groupId - The Okta group id to watch.
 * @param callback - Invoked whenever that group's entry changes.
 * @returns An unsubscribe function.
 */
export function subscribeMemberSource(groupId: string, callback: () => void): () => void {
  return subscribe(memberSourceKey(groupId), callback);
}
