import type { GroupSummary, GroupType } from '../../../shared/types';

/**
 * Raw Okta group as returned by the API — a superset of the typed {@link OktaGroup}
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
  created?: string;
}

/**
 * Map a raw Okta group (from `getAllGroups`) to a {@link GroupSummary}.
 *
 * Does NOT compute `staleness` — the loader applies `api.calculateStaleness` in a
 * separate pass so the mapper stays pure. For `APP_GROUP`s, `source.id` takes
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
    created: group.created ? new Date(group.created) : undefined,
    hasRules: false,
    ruleCount: 0,
    selected: false,
    sourceAppId,
    sourceAppName,
  };
}

/**
 * Map a raw Okta group from the live-search content-script response.
 *
 * Deliberately NARROWER than {@link toGroupSummary}: it omits `sourceAppId`/
 * `sourceAppName` (and staleness is never applied to live results). Not
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
    created: group.created ? new Date(group.created) : undefined,
    hasRules: false,
    ruleCount: 0,
    selected: false,
  };
}
