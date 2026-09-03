/**
 * @module sidepanel/cache/rungInvalidation
 * @description What a detail rung's refresh drops, written down once.
 *
 * ADR-0069 §2 gives the app-level refresh two halves on a detail rung: **that
 * entity's cache keys, dropped**, plus a re-run of the loads the rung performs
 * on open. The re-run belongs to the rung's hooks. The drop belongs here,
 * because it is the half that is easy to get wrong in the expensive direction:
 * `invalidate` takes a prefix, so one segment too few turns "re-read this group"
 * into "re-walk the org", and nothing about that failure is visible at the call
 * site.
 *
 * Stating the set as a function rather than as three `invalidate` calls inside a
 * component gives it somewhere to be tested — including the negative, that
 * every *other* entity's entries survive.
 *
 * Every key comes from {@link module:sidepanel/cache/keys}' factories; no
 * literal is written here.
 */
import { invalidate } from './entityCache';
import { cacheKeys } from './keys';

/**
 * Drop every cache entry the group detail rung reads, and nothing else.
 *
 * Three families, one of which arrives by cascade:
 *
 * - `groupMembers/{id}` — the roster, which `registerDerived` already cascades
 *   to `memberSource/{id}`, so the breakdown cannot outlive the list it
 *   summarises.
 * - `mfaScan/{id}` — the opt-in enrollment scan, keyed to a roster that has just
 *   been dropped. Left standing it would describe members who may no longer be
 *   in the group, which is a wrong answer rather than a stale one.
 *
 * Deliberately **not** dropped: the org-wide rule inventory
 * ({@link RULE_INVENTORY_KEY}) and the app inventory. Both are org-scoped, both
 * cost a full walk, and neither is a fact about *this* group — a per-group
 * refresh that re-walked them would spend the org's rate-limit budget for one
 * entity's press (ADR-0059). The rung's rules axes re-run against them instead.
 *
 * @param groupId - The Okta group id the rung is showing.
 */
export function invalidateGroupDetail(groupId: string): void {
  invalidate(cacheKeys.groupMembers(groupId));
  invalidate(cacheKeys.mfaScan(groupId));
}
