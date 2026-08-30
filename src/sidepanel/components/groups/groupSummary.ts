/**
 * @module sidepanel/components/groups/groupSummary
 * @description Pure mappers from raw Okta group responses to the app's `GroupSummary`.
 *
 * {@link toGroupSummary} handles full `/api/v1/groups` payloads (incl. app-group
 * source); {@link liveSearchToGroupSummary} is a narrower variant for live-search hits.
 * Neither attributes group rules — the loader applies that separately.
 */
import type { GroupSummary, GroupType } from '../../../shared/types';

/**
 * Raw Okta group as returned by the API — a superset of the typed `OktaGroup`
 * (which only models id/type/profile). The extra fields (`_embedded` stats, the
 * `_links.apps` href, `source`, and the ISO date strings) are present at runtime on
 * the `/api/v1/groups` responses but not in the narrow shared type, which is why the
 * mappers used to take `any`. This structural type replaces those `any`s.
 */
export interface RawOktaGroup {
  id: string;
  type: GroupType;
  profile?: { name?: string; description?: string };
  _embedded?: { stats?: { usersCount?: number } };
  _links?: { apps?: { href?: string } };
  source?: { id: string; name?: string };
  lastUpdated?: string;
  /**
   * Okta's `lastMembershipUpdated` — when the roster last changed, as opposed to
   * `lastUpdated`, which moves on profile edits. Present on the `/api/v1/groups`
   * LIST response (not only the single-group GET), so it rides the walks this app
   * already makes at no extra request. See {@link GroupSummary.lastMembershipUpdated}.
   */
  lastMembershipUpdated?: string;
  created?: string;
}

/**
 * Map a raw Okta group (from `getAllGroups`) to a {@link GroupSummary}.
 *
 * Does NOT attribute group rules — `hasRules`/`ruleCount`/`usedInRuleCount` are
 * left at their defaults and the loader applies `annotateGroupsWithRuleCounts` in
 * a separate pass so the mapper stays pure. For `APP_GROUP`s, `source.id` takes
 * precedence over the id parsed out of the `_links.apps` href, and a `source.name`
 * is only surfaced when it differs from the id.
 */
export function toGroupSummary(group: RawOktaGroup): GroupSummary {
  const memberCount = group._embedded?.stats?.usersCount ?? 0;

  let sourceAppId: string | undefined;
  let sourceAppName: string | undefined;

  if (group.type === 'APP_GROUP') {
    if (group._links?.apps?.href) {
      const appIdMatch = group._links.apps.href.match(/\/apps\/([^/]+)/);
      if (appIdMatch) sourceAppId = appIdMatch[1];
    }
    if (group.source) {
      sourceAppId = group.source.id;
      if (group.source.name && group.source.name !== group.source.id) {
        sourceAppName = group.source.name;
      }
    }
  }

  return {
    id: group.id,
    name: group.profile?.name || group.id,
    description: group.profile?.description,
    type: group.type,
    memberCount,
    lastUpdated: group.lastUpdated ? new Date(group.lastUpdated) : undefined,
    lastMembershipUpdated: group.lastMembershipUpdated
      ? new Date(group.lastMembershipUpdated)
      : undefined,
    created: group.created ? new Date(group.created) : undefined,
    hasRules: false,
    ruleCount: 0,
    usedInRuleCount: 0,
    selected: false,
    sourceAppId,
    sourceAppName,
  };
}

/**
 * Map a raw Okta group from the live-search content-script response.
 *
 * Deliberately NARROWER than {@link toGroupSummary}: it omits `sourceAppId`/
 * `sourceAppName` (and rule attribution is never applied to live results). Not
 * interchangeable with `toGroupSummary`; see the §7 decomposition map.
 */
export function liveSearchToGroupSummary(group: RawOktaGroup): GroupSummary {
  return {
    id: group.id,
    name: group.profile?.name || group.id,
    description: group.profile?.description,
    type: group.type,
    memberCount: group._embedded?.stats?.usersCount ?? 0,
    lastUpdated: group.lastUpdated ? new Date(group.lastUpdated) : undefined,
    lastMembershipUpdated: group.lastMembershipUpdated
      ? new Date(group.lastMembershipUpdated)
      : undefined,
    created: group.created ? new Date(group.created) : undefined,
    hasRules: false,
    ruleCount: 0,
    usedInRuleCount: 0,
    selected: false,
  };
}
