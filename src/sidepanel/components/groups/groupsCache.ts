import type { GroupSummary } from '../../../shared/types';

export const GROUPS_CACHE_KEY = 'okta_unbound_groups_cache';
export const CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day

/** The serialized cache payload written to `chrome.storage.local`. */
interface SerializedGroupsCache {
  groups: SerializedGroup[];
  timestamp: number;
}

/**
 * A GroupSummary after JSON round-tripping: its `Date` fields come back as ISO
 * strings. Kept as an index type so unknown fields survive untouched.
 */
type SerializedGroup = { lastUpdated?: string; created?: string; [key: string]: unknown };

/**
 * Revive a cached group's ISO date strings back into `Date`s.
 *
 * Only `lastUpdated` and `created` are revived — `lastMembershipUpdated` and any
 * nested dates stay strings after a cache load. That asymmetry is existing
 * behavior; preserve it.
 */
export function reviveGroupDates(g: SerializedGroup): GroupSummary {
  return {
    ...g,
    lastUpdated: g.lastUpdated ? new Date(g.lastUpdated) : undefined,
    created: g.created ? new Date(g.created) : undefined,
  } as GroupSummary;
}

/**
 * Parse the raw cache string into a fresh group list, or `null` if the entry has
 * aged past {@link CACHE_DURATION}. Malformed JSON throws (the caller catches and
 * logs, leaving the mode `live`). `now` is injected so the function stays pure.
 */
export function parseGroupsCache(raw: string, now: number): GroupSummary[] | null {
  const cached = JSON.parse(raw) as SerializedGroupsCache;
  const age = now - cached.timestamp;
  if (age >= CACHE_DURATION) return null;
  return cached.groups.map(reviveGroupDates);
}

/** Serialize a group list for `chrome.storage.local` with a `now` timestamp. */
export function serializeGroupsCache(groups: GroupSummary[], now: number): string {
  return JSON.stringify({ groups, timestamp: now });
}
