/**
 * @module sidepanel/cache/keys
 * @description The single place {@link module:sidepanel/cache/entityCache} key
 * literals are written.
 *
 * Keys were previously spelled inline at each call site — `['groupMembers', id]`
 * in three files, `['userMemberships', id]` in five. That is a silent-failure
 * shape: a writer and an invalidator that disagree by one character do not error,
 * they just address different entries, and the stale one is served forever.
 * `useUsersTabState` invalidating what `useUserMemberships` wrote is exactly that
 * pairing.
 *
 * ## Grammar
 *
 * `[domain, ...scope]`. The domain is a bare string; the scope identifies the
 * entity. Composite keys are what make prefix invalidation work — dropping
 * `['memberSource']` drops every group's breakdown.
 *
 * ## Scope by origin, never by tab id
 *
 * An **org-wide** read is scoped by `oktaOrigin`, not `targetTabId`. Two Chrome
 * tabs pointed at one org should share an entry; two orgs must never share one.
 * A tab-id scope gets both wrong — it splits the cache per tab, and it silently
 * serves the previous org's data when a single tab navigates between orgs.
 * {@link cacheKeys.apps} is the worked example.
 *
 * **Entity-scoped** reads key on the entity id alone. Okta ids are globally
 * unique, so they cannot collide across orgs.
 */
import type { EntityKey } from './entityCache';

/**
 * Default lifetime, matching `entityCache`'s own default.
 *
 * For data a user expects to reflect recent changes: memberships, assignments,
 * inventories.
 */
export const TTL_SHORT = 5 * 60 * 1000;

/**
 * Extended lifetime for expensive derived analyses.
 *
 * Reserved for results that cost many requests to rebuild and change only when
 * their inputs do — the member-source breakdown is the case this exists for.
 */
export const TTL_LONG = 30 * 60 * 1000;

/**
 * Every `entityCache` key in the panel.
 *
 * Add new keys here rather than inline. Grouped as one object so a reader sees
 * the whole key space at once and so a new domain cannot silently duplicate an
 * existing one.
 */
export const cacheKeys = {
  /**
   * One org's application inventory.
   *
   * Scoped by origin (see the module note). `null`/`undefined` collapses to a
   * single `'unknown'` bucket, reachable only before the origin has resolved.
   *
   * @param oktaOrigin - The connected org's origin, e.g. `https://example.okta.com`.
   */
  apps: (oktaOrigin?: string | null): EntityKey => ['apps', oktaOrigin ?? 'unknown'],

  /**
   * A group's full member list.
   *
   * Shared by `GroupOverview`, `useGroupMembersCache` and `useGroupSource`, so
   * members loaded in one are already present in the others.
   *
   * @param groupId - The Okta group id.
   */
  groupMembers: (groupId: string): EntityKey => ['groupMembers', groupId],

  /**
   * A group's direct-vs-rule member breakdown — derived from
   * {@link cacheKeys.groupMembers} and far more expensive to rebuild.
   *
   * @param groupId - The Okta group id.
   */
  memberSource: (groupId: string): EntityKey => ['memberSource', groupId],

  /**
   * A user's resolved group memberships.
   *
   * Written by `useUserMemberships` and invalidated by `useUsersTabState` after a
   * membership write — the two must address the identical key.
   *
   * @param userId - The Okta user id.
   */
  userMemberships: (userId: string): EntityKey => ['userMemberships', userId],

  /**
   * One application's detail record (status, sign-on mode, metadata).
   *
   * @param appId - The Okta application id.
   */
  appDetail: (appId: string): EntityKey => ['appDetail', appId],

  /**
   * One application's user/group assignment totals.
   *
   * A separate key from {@link cacheKeys.appDetail} because it is filled by a
   * different, potentially many-request walk.
   *
   * @param appId - The Okta application id.
   */
  appAssignmentCounts: (appId: string): EntityKey => ['appAssignmentCounts', appId],

  /**
   * The policy list for one policy type.
   *
   * @param policyType - The Okta policy type, e.g. `ACCESS_POLICY`.
   */
  policies: (policyType: string): EntityKey => ['policies', policyType],
} as const;
