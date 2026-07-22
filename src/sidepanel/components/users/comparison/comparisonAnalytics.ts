/**
 * @module sidepanel/components/users/comparison/comparisonAnalytics
 * @description Pure helpers for the user comparison: Jaccard similarity, group/app bucketing, and similarity color.
 *
 * No React and no I/O — safe to unit-test in isolation and reused across the
 * comparison subcomponents and `useUserComparison`.
 */
import type { OktaGroup, GroupMembership } from '../../../../shared/types';

/** An app assignment reduced to the fields the comparison UI needs. */
export interface AppEntry {
  id: string;
  label: string;
}

/** Identifier for the three comparison tabs. */
export type TabKey = 'overview' | 'groups' | 'apps';

/** A single row in a diff bucket (group or app), reduced to id + label. */
export interface DiffItem {
  id: string;
  label: string;
}

/**
 * Jaccard overlap as a whole-percent (0–100).
 *
 * CHARACTERIZED CONTRACT: an empty union scores 0, not 100 — two users with
 * identical groups and zero apps each score 50% overall, not 100%. Do not
 * "fix" the empty-union case; it is relied on by the hero Match %.
 *
 * @param sharedCount - Size of the intersection (items both users have).
 * @param unionCount - Size of the union (distinct items across both users).
 * @returns The overlap rounded to a whole percent, or 0 when the union is empty.
 */
export const jaccard = (sharedCount: number, unionCount: number): number =>
  unionCount === 0 ? 0 : Math.round((sharedCount / unionCount) * 100);

/** Group memberships split into onlyCompared / shared / onlyContext buckets. */
export interface GroupBuckets {
  /** Groups the compared user has that the context user does not. */
  onlyCompared: OktaGroup[];
  /** Groups both users share (including optimistically added ones). */
  shared: OktaGroup[];
  /** Groups the context user has that the compared user does not. */
  onlyContext: OktaGroup[];
}

/**
 * Split the two users' group memberships into onlyCompared / shared / onlyContext.
 *
 * Optimistic re-bucketing runs in BOTH directions this session, before the
 * parent's refresh lands: `addedToContextIds` (groups just copied onto the
 * context user, moved out of onlyCompared into shared) and `addedToComparedIds`
 * (groups just copied onto the compared user, moved out of onlyContext into
 * shared).
 *
 * @param contextGroups - The context user's memberships (baseline).
 * @param comparedGroups - The compared user's memberships.
 * @param addedToContextIds - Group ids optimistically added to the context user this session; treated as shared.
 * @param addedToComparedIds - Group ids optimistically added to the compared user this session; treated as shared.
 * @returns The three-way {@link GroupBuckets} split.
 */
export const bucketGroups = (
  contextGroups: GroupMembership[],
  comparedGroups: GroupMembership[],
  addedToContextIds: Set<string>,
  addedToComparedIds: Set<string> = new Set(),
): GroupBuckets => {
  const contextGroupIds = new Set(contextGroups.map((m) => m.group.id));
  const comparedGroupIds = new Set(comparedGroups.map((m) => m.group.id));

  const onlyCompared: OktaGroup[] = [];
  const shared: OktaGroup[] = [];
  for (const m of comparedGroups) {
    if (contextGroupIds.has(m.group.id) || addedToContextIds.has(m.group.id)) {
      shared.push(m.group);
    } else {
      onlyCompared.push(m.group);
    }
  }

  // Context-side pass: groups already on both users were counted as shared above
  // (skip them here to avoid a double-count); a context-only group optimistically
  // added to the compared user becomes shared, everything else stays onlyContext.
  const onlyContext: OktaGroup[] = [];
  for (const m of contextGroups) {
    if (comparedGroupIds.has(m.group.id)) continue;
    if (addedToComparedIds.has(m.group.id)) shared.push(m.group);
    else onlyContext.push(m.group);
  }

  return { onlyCompared, shared, onlyContext };
};

/** App assignments split into onlyCompared / shared / onlyContext buckets. */
export interface AppBuckets {
  /** Apps the compared user has that the context user does not. */
  onlyCompared: AppEntry[];
  /** Apps both users share. */
  shared: AppEntry[];
  /** Apps the context user has that the compared user does not. */
  onlyContext: AppEntry[];
}

/**
 * Split the two users' app assignments into onlyCompared / shared / onlyContext.
 * NOTE: not symmetric with {@link bucketGroups} — there are no added ids, and
 * `shared` is derived from `comparedApps` only.
 *
 * @param contextApps - The context user's app assignments (baseline).
 * @param comparedApps - The compared user's app assignments.
 * @returns The three-way {@link AppBuckets} split.
 */
export const bucketApps = (contextApps: AppEntry[], comparedApps: AppEntry[]): AppBuckets => {
  const contextAppIds = new Set(contextApps.map((a) => a.id));
  const comparedAppIds = new Set(comparedApps.map((a) => a.id));

  const onlyCompared = comparedApps.filter((a) => !contextAppIds.has(a.id));
  const shared = comparedApps.filter((a) => contextAppIds.has(a.id));
  const onlyContext = contextApps.filter((a) => !comparedAppIds.has(a.id));

  return { onlyCompared, shared, onlyContext };
};

/**
 * Map a similarity percentage to an Odyssey token color (never raw hex): success
 * ≥75, primary ≥40, warning ≥15, else neutral.
 *
 * @param pct - Similarity as a whole percent (0–100).
 * @returns A `var(--color-…)` CSS custom-property reference.
 */
export const similarityColor = (pct: number): string => {
  if (pct >= 75) return 'var(--color-success-text)';
  if (pct >= 40) return 'var(--color-primary-text)';
  if (pct >= 15) return 'var(--color-warning-text)';
  return 'var(--color-neutral-700)';
};
