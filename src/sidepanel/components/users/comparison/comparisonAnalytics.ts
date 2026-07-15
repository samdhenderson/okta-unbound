import type { OktaGroup, GroupMembership } from '../../../../shared/types';

/** An app assignment reduced to the fields the comparison UI needs. */
export interface AppEntry {
  id: string;
  label: string;
}

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
 */
export const jaccard = (sharedCount: number, unionCount: number): number =>
  unionCount === 0 ? 0 : Math.round((sharedCount / unionCount) * 100);

export interface GroupBuckets {
  onlyCompared: OktaGroup[];
  shared: OktaGroup[];
  onlyContext: OktaGroup[];
}

/**
 * Split the two users' group memberships into onlyCompared / shared / onlyContext.
 * `addedGroupIds` (groups optimistically copied onto the context user this session)
 * count as shared before the parent's contextGroups refresh lands.
 */
export const bucketGroups = (
  contextGroups: GroupMembership[],
  comparedGroups: GroupMembership[],
  addedGroupIds: Set<string>,
): GroupBuckets => {
  const contextGroupIds = new Set(contextGroups.map((m) => m.group.id));
  const comparedGroupIds = new Set(comparedGroups.map((m) => m.group.id));

  const onlyCompared: OktaGroup[] = [];
  const shared: OktaGroup[] = [];
  for (const m of comparedGroups) {
    if (contextGroupIds.has(m.group.id) || addedGroupIds.has(m.group.id)) {
      shared.push(m.group);
    } else {
      onlyCompared.push(m.group);
    }
  }

  const onlyContext = contextGroups
    .filter((m) => !comparedGroupIds.has(m.group.id))
    .map((m) => m.group);

  return { onlyCompared, shared, onlyContext };
};

export interface AppBuckets {
  onlyCompared: AppEntry[];
  shared: AppEntry[];
  onlyContext: AppEntry[];
}

/**
 * Split the two users' app assignments into onlyCompared / shared / onlyContext.
 * NOTE: not symmetric with {@link bucketGroups} — there are no added ids, and
 * `shared` is derived from `comparedApps` only.
 */
export const bucketApps = (contextApps: AppEntry[], comparedApps: AppEntry[]): AppBuckets => {
  const contextAppIds = new Set(contextApps.map((a) => a.id));
  const comparedAppIds = new Set(comparedApps.map((a) => a.id));

  const onlyCompared = comparedApps.filter((a) => !contextAppIds.has(a.id));
  const shared = comparedApps.filter((a) => contextAppIds.has(a.id));
  const onlyContext = contextApps.filter((a) => !comparedAppIds.has(a.id));

  return { onlyCompared, shared, onlyContext };
};

/** Token color for a similarity percentage — never raw hex. */
export const similarityColor = (pct: number): string => {
  if (pct >= 75) return 'var(--color-success-text)';
  if (pct >= 40) return 'var(--color-primary-text)';
  if (pct >= 15) return 'var(--color-warning-text)';
  return 'var(--color-neutral-700)';
};
