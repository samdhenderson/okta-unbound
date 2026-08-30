/**
 * @module sidepanel/components/groups/clutterAnalysis
 * @description Local, read-only "directory clutter" triage over loaded groups.
 *
 * Fuses the signals already present on a {@link GroupSummary} — emptiness,
 * duplicate names, time since the membership last changed, missing metadata —
 * into a single per-group `reviewScore` plus human-readable reasons, and buckets groups into
 * the categories an admin triages on. Pure and I/O-free: it runs over the group
 * list the Groups tab has already loaded, so it costs no extra API calls. It
 * deliberately only claims what is reliably knowable locally (it does not infer
 * rule-orphan status, which needs the rules payload).
 *
 * @see {@link analyzeClutter}
 */

import type { GroupSummary } from '../../../shared/types';

/**
 * Days since a group's membership last changed at or beyond which it is treated
 * as stale for triage.
 *
 * One full year. The threshold is unchanged from when this measured the profile
 * clock, deliberately: the signal beneath it just changed, and moving both at
 * once would make it impossible to tell which one moved the numbers. A shorter
 * cutoff is probably right for membership — the old rationale for 365 was that a
 * 3- or 6-month cutoff "would flag ordinary, healthy groups", which is true of
 * profile edits (nobody renames a healthy group) and much weaker of membership
 * (a year without a joiner or a leaver is genuinely unusual for a live team).
 * Retuning it is filed separately.
 */
export const STALE_AGE_DAYS = 365;

/** Milliseconds in one day, for the {@link STALE_AGE_DAYS} comparison. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whether a group's **membership** has gone at least {@link STALE_AGE_DAYS}
 * without changing.
 *
 * Reads `lastMembershipUpdated`, falling back to `lastUpdated` only when Okta (or
 * a snapshot synced before that field was parsed) did not report it.
 *
 * The fallback is second, not first, because the two clocks answer different
 * questions and only one of them is the question triage asks. `lastUpdated` moves
 * when a group is renamed or its description edited; `lastMembershipUpdated` moves
 * when somebody joins or leaves. Scoring staleness off the profile clock produced
 * errors in both directions: a group with weekly membership churn whose
 * description nobody had touched in a year was flagged, and — the dangerous one —
 * a group whose roster had been frozen for three years but whose profile was
 * tidied last month was not. The org's most privileged groups are exactly the ones
 * under periodic review, so exactly the ones whose profile clock stays fresh while
 * the roster ossifies.
 *
 * It is also the only signal here that sees the maintainers nothing else does:
 * Workflows, SCIM, HR provisioning, direct API writes and IdP sync all bump it and
 * none of them leave a group rule behind (see `ruleOrphans`'
 * `INVISIBLE_MAINTAINERS`). A quiet membership clock is therefore evidence about
 * every write path, not just the visible ones.
 *
 * A group with neither date is NOT stale: absence of a date is missing data, not
 * evidence of age, and claiming otherwise would flag groups on something the API
 * never told us.
 *
 * @param group - The group to test.
 * @param now - Current epoch ms; injected so the predicate stays deterministic.
 * @returns `true` when the membership has been unchanged for at least a year.
 */
export function isStaleByAge(group: GroupSummary, now: number = Date.now()): boolean {
  const clock = group.lastMembershipUpdated ?? group.lastUpdated;
  if (!clock) return false;
  const time = clock.getTime();
  if (Number.isNaN(time)) return false;
  return now - time >= STALE_AGE_DAYS * MS_PER_DAY;
}

/**
 * The reason line for a stale group, naming the clock it was actually read from.
 *
 * Two strings rather than one because {@link isStaleByAge} has a fallback, and a
 * fallback verdict does not support the stronger claim. When
 * `lastMembershipUpdated` is missing all we know is that the *profile* has not
 * moved; saying "no membership change in over a year" there would assert
 * something Okta never told us — precisely the mistake that put the wrong clock
 * behind this signal in the first place.
 *
 * @param group - The group the reason describes.
 * @returns A reason line true of whichever date was available.
 */
function staleReason(group: GroupSummary): string {
  return group.lastMembershipUpdated
    ? 'No membership change in over a year'
    : 'Not updated in over a year';
}

/**
 * Relative weights fused into a group's `reviewScore`. Higher total = more worth
 * an admin's attention. Empty and duplicate-name are the strongest signals.
 */
export const CLUTTER_WEIGHTS = {
  empty: 40,
  duplicateName: 30,
  stale: 20,
  noDescription: 10,
} as const;

/** The individual clutter signals detected for one group. */
export interface GroupClutterSignals {
  /** Group has zero members. */
  empty: boolean;
  /** Group's normalized name is shared with at least one other group. */
  duplicateName: boolean;
  /**
   * Group's membership has not changed in at least {@link STALE_AGE_DAYS} days —
   * or, when Okta reported no membership date, its profile has not.
   */
  stale: boolean;
  /** Group has no description (metadata hygiene). */
  noDescription: boolean;
}

/** A flagged group with its signals, fused score, and human-readable reasons. */
export interface GroupClutterEntry {
  group: GroupSummary;
  signals: GroupClutterSignals;
  /** Fused 0–100 confidence that the group is worth reviewing. */
  reviewScore: number;
  /** Human-readable explanations for each active signal. */
  reasons: string[];
}

/** A set of groups whose names collide after normalization. */
export interface DuplicateNameCluster {
  /** The normalized (trimmed, lower-cased, whitespace-collapsed) name. */
  normalizedName: string;
  /** Ids of the groups sharing that normalized name. */
  groupIds: string[];
}

/** The org-level triage report. */
export interface ClutterReport {
  /** Total groups analyzed. */
  totalGroups: number;
  /** Flagged groups (at least one signal), sorted by `reviewScore` descending. */
  entries: GroupClutterEntry[];
  /** Group ids per triage category (for one-click selection). */
  categories: {
    empty: string[];
    duplicateName: string[];
    stale: string[];
  };
  /** Union of all flagged group ids. */
  flaggedIds: string[];
  /** Duplicate-name clusters (2+ groups sharing a normalized name). */
  duplicateNameClusters: DuplicateNameCluster[];
}

/** Normalize a group name for duplicate detection (case/whitespace-insensitive). */
export function normalizeGroupName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Analyze a loaded group list for directory clutter.
 *
 * @param groups - The groups the Groups tab has already loaded (with member
 * counts applied).
 * @param now - Current epoch ms, forwarded to {@link isStaleByAge}; injected so
 * the report stays deterministic under test.
 * @returns A {@link ClutterReport} with per-group entries, category buckets, and
 * duplicate-name clusters. Runs entirely in-memory.
 */
export function analyzeClutter(groups: GroupSummary[], now: number = Date.now()): ClutterReport {
  // Build normalized-name -> group ids to detect duplicates.
  const byNormalizedName = new Map<string, string[]>();
  for (const g of groups) {
    const key = normalizeGroupName(g.name);
    if (!key) continue;
    const bucket = byNormalizedName.get(key);
    if (bucket) bucket.push(g.id);
    else byNormalizedName.set(key, [g.id]);
  }

  const duplicateNameClusters: DuplicateNameCluster[] = [];
  const duplicateIds = new Set<string>();
  for (const [normalizedName, groupIds] of byNormalizedName) {
    if (groupIds.length > 1) {
      duplicateNameClusters.push({ normalizedName, groupIds });
      for (const id of groupIds) duplicateIds.add(id);
    }
  }

  const entries: GroupClutterEntry[] = [];
  const categories = {
    empty: [] as string[],
    duplicateName: [] as string[],
    stale: [] as string[],
  };

  for (const group of groups) {
    const empty = group.memberCount === 0;
    const duplicateName = duplicateIds.has(group.id);
    // Staleness is asked only of groups Okta admins actually maintain.
    //
    // `BUILT_IN` (Everyone) gains a member every time anyone joins the org, so
    // its membership clock is always fresh and the predicate would never fire —
    // excluding it costs nothing and states the intent. `APP_GROUP` is the one
    // that matters: it is mastered by the app that sources it, so a quiet roster
    // means the upstream directory is quiet, not that anybody here neglected it.
    // Listing a synced-but-idle AD group beside genuinely abandoned Okta groups
    // would put a finding with no available action at the top of a list sorted by
    // consequence. `findCleanupCandidates` already draws this line; this draws the
    // same one.
    const maintainedHere = group.type !== 'BUILT_IN' && group.type !== 'APP_GROUP';
    const stale = maintainedHere && isStaleByAge(group, now);
    const noDescription = !group.description || group.description.trim() === '';

    if (empty) categories.empty.push(group.id);
    if (duplicateName) categories.duplicateName.push(group.id);
    if (stale) categories.stale.push(group.id);

    // A group is only flagged on a substantive signal; a missing description
    // alone is hygiene noise, not a review candidate.
    if (!empty && !duplicateName && !stale) continue;

    const reasons: string[] = [];
    if (empty) reasons.push('No members');
    if (duplicateName) reasons.push('Duplicate name');
    if (stale) reasons.push(staleReason(group));
    if (noDescription) reasons.push('No description');

    const reviewScore = Math.min(
      100,
      (empty ? CLUTTER_WEIGHTS.empty : 0) +
        (duplicateName ? CLUTTER_WEIGHTS.duplicateName : 0) +
        (stale ? CLUTTER_WEIGHTS.stale : 0) +
        (noDescription ? CLUTTER_WEIGHTS.noDescription : 0),
    );

    entries.push({
      group,
      signals: { empty, duplicateName, stale, noDescription },
      reviewScore,
      reasons,
    });
  }

  entries.sort((a, b) => b.reviewScore - a.reviewScore);

  const flaggedIds = entries.map((e) => e.group.id);

  return {
    totalGroups: groups.length,
    entries,
    categories,
    flaggedIds,
    duplicateNameClusters,
  };
}
