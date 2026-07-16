/**
 * @module sidepanel/components/groups/clutterAnalysis
 * @description Local, read-only "directory clutter" triage over loaded groups.
 *
 * Fuses the signals already present on a {@link GroupSummary} — emptiness,
 * duplicate names, staleness, missing metadata — into a single per-group
 * `reviewScore` plus human-readable reasons, and buckets groups into the
 * categories an admin triages on. Pure and I/O-free: it runs over the group list
 * the Groups tab has already loaded, so it costs no extra API calls. It
 * deliberately only claims what is reliably knowable locally (it does not infer
 * rule-orphan status, which needs the rules payload).
 *
 * @see {@link analyzeClutter}
 */

import type { GroupSummary } from '../../../shared/types';

/** Staleness score at or above which a group is treated as stale for triage. */
export const STALE_SCORE_THRESHOLD = 60;

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
  /** Group's staleness score is at or above {@link STALE_SCORE_THRESHOLD}. */
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
 * counts and staleness applied).
 * @returns A {@link ClutterReport} with per-group entries, category buckets, and
 * duplicate-name clusters. Runs entirely in-memory.
 */
export function analyzeClutter(groups: GroupSummary[]): ClutterReport {
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
    const stale = (group.staleness?.score ?? 0) >= STALE_SCORE_THRESHOLD;
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
    if (stale) reasons.push('Stale (no recent activity)');
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
