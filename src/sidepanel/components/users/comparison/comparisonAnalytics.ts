/**
 * @module sidepanel/components/users/comparison/comparisonAnalytics
 * @description Pure helpers for the user comparison: Jaccard similarity, group/app bucketing, and similarity color.
 *
 * No React and no I/O — safe to unit-test in isolation and reused across the
 * comparison subcomponents and `useUserComparison`.
 */
import type { GroupMembership } from '../../../../shared/types';
import type { AppAssignmentScope } from '../../../../shared/schemas/okta';

/** An app assignment reduced to the fields the comparison UI needs. */
export interface AppEntry {
  id: string;
  label: string;
  /**
   * How Okta reports this assignment, when it reported one at all
   * ({@link AppAssignmentScope}).
   *
   * `'USER'` means the user **has a direct assignment** — NOT that no group path
   * also exists. Okta returns one scope per app-user and reports `'USER'` when a
   * user is both directly assigned and in an assigned group, so a UI reading this
   * may label it "Direct" but must never label it "Direct only" or imply the app
   * would be lost by removing the user from its groups.
   *
   * `undefined` = unknown, not "no direct assignment": the row arrived without a
   * usable embed (an older cached result, an unexpanded response, or a malformed
   * `_embedded`). Bucketing ignores it entirely — an app is never dropped or
   * re-bucketed over a missing scope.
   */
  scope?: AppAssignmentScope;
}

/** Identifier for the four comparison tabs. */
export type TabKey = 'overview' | 'groups' | 'apps' | 'attributes';

/**
 * A single row in a diff bucket (group or app): `id` + `label`, plus whatever
 * facet-specific context the row's own tab supplies.
 *
 * `id`/`label` are all a row *needs*; everything else is optional because
 * `ComparisonDiffTab` is shared by the Groups and Apps tabs, and neither may be
 * forced to invent the other's fields.
 */
export interface DiffItem {
  id: string;
  label: string;
  /**
   * **Groups tab only** — the membership this row was built from, carried whole
   * so the rendering layer can state *why* the user is in the group rather than
   * only *that* they are. `undefined` on app rows, which have no membership.
   *
   * Read `membership.attribution` through the shared vocabulary in
   * `shared/utils/membershipAnalysis` — `attributionNamesRules` before crediting
   * anything in `membership.rules` as the source, `isDeducedAttribution` before
   * giving a row the visual weight of an answer. Do not re-derive what an
   * attribution means here.
   */
  membership?: GroupMembership;
}

/**
 * One row of the parity list: a group or app, and which of the two users holds it.
 *
 * The union of both users' items rather than a slice of one side, because the row
 * *is* the comparison — it states who has the item and who does not, in place. The
 * three-bucket split answered the same question by putting rows in different
 * boxes, which meant reading a row required knowing which box you were in, and
 * gave the most screen space to `shared` (the one nobody acts on).
 *
 * `inContext` and `inCompared` are never both `false`: a row exists because at
 * least one user holds the item.
 */
export interface ParityRow {
  /** Group or app id. */
  readonly id: string;
  /** Display label. **Untrusted** — render escaped, never log. */
  readonly label: string;
  /** Whether the context user (the baseline) holds it. */
  readonly inContext: boolean;
  /** Whether the compared user holds it. */
  readonly inCompared: boolean;
  /**
   * **Groups only** — the membership behind the row, from whichever side holds
   * it. On a shared row this is one user's provenance, not a claim about both
   * (see {@link GroupBuckets}). `undefined` on app rows.
   */
  readonly membership?: GroupMembership;
}

/**
 * Order the parity list: differences first, then alphabetically within each part.
 *
 * Sorting rather than bucketing is what lets one list serve the whole tab. The
 * rows an admin can act on rise to the top on their own, so the filter becomes a
 * convenience rather than the only way to find them.
 */
const byDifferenceThenName = (a: ParityRow, b: ParityRow): number => {
  const differs = (row: ParityRow) => (row.inContext !== row.inCompared ? 0 : 1);
  return differs(a) - differs(b) || a.label.localeCompare(b.label);
};

/**
 * Project the group buckets into one parity list.
 *
 * Derived from {@link GroupBuckets} rather than replacing it: the Overview tab and
 * the cause worklist still consume the buckets, and re-deriving the split here
 * would risk the two disagreeing about what "shared" means (which includes
 * optimistically-copied groups).
 *
 * @param buckets - Output of {@link bucketGroups}.
 * @returns One row per group either user holds, differences first then A–Z.
 */
export const groupParityRows = (buckets: GroupBuckets): ParityRow[] =>
  [
    ...buckets.onlyCompared.map((m) => parityRowOf(m, false, true)),
    ...buckets.shared.map((m) => parityRowOf(m, true, true)),
    ...buckets.onlyContext.map((m) => parityRowOf(m, true, false)),
  ].sort(byDifferenceThenName);

/** One membership as a parity row. */
const parityRowOf = (
  membership: GroupMembership,
  inContext: boolean,
  inCompared: boolean,
): ParityRow => ({
  id: membership.group.id,
  label: membership.group.profile.name,
  inContext,
  inCompared,
  membership,
});

/**
 * Project the app buckets into one parity list.
 *
 * @param buckets - Output of {@link bucketApps}.
 * @returns One row per app either user is assigned, differences first then A–Z.
 */
export const appParityRows = (buckets: AppBuckets): ParityRow[] =>
  [
    ...buckets.onlyCompared.map((a) => appRowOf(a, false, true)),
    ...buckets.shared.map((a) => appRowOf(a, true, true)),
    ...buckets.onlyContext.map((a) => appRowOf(a, true, false)),
  ].sort(byDifferenceThenName);

/** One app entry as a parity row. */
const appRowOf = (app: AppEntry, inContext: boolean, inCompared: boolean): ParityRow => ({
  id: app.id,
  label: app.label,
  inContext,
  inCompared,
});

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

/**
 * Group memberships split into onlyCompared / shared / onlyContext buckets.
 *
 * The buckets hold whole {@link GroupMembership}s, not bare `OktaGroup`s:
 * bucketing answers *what* differs, and the membership is the only thing that
 * carries *why* (`membershipType`, the attributed `rules`, and the `attribution`
 * that says how far those rules may be trusted). Reducing to the group here
 * would discard that before any consumer could see it.
 *
 * Which side's membership a bucket holds matters for `shared`: it is the
 * **compared** user's membership (the compared-side pass runs first), except for
 * a context-only group optimistically copied onto the compared user, which is
 * pushed from the context side. A shared row's provenance is therefore one
 * user's, not a claim about both.
 */
export interface GroupBuckets {
  /** Memberships the compared user has that the context user does not. */
  onlyCompared: GroupMembership[];
  /** Memberships both users share (including optimistically added ones). */
  shared: GroupMembership[];
  /** Memberships the context user has that the compared user does not. */
  onlyContext: GroupMembership[];
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

  // Push the membership, never `m.group`: the group answers "which one", the
  // membership additionally answers "granted how".
  const onlyCompared: GroupMembership[] = [];
  const shared: GroupMembership[] = [];
  for (const m of comparedGroups) {
    if (contextGroupIds.has(m.group.id) || addedToContextIds.has(m.group.id)) {
      shared.push(m);
    } else {
      onlyCompared.push(m);
    }
  }

  // Context-side pass: groups already on both users were counted as shared above
  // (skip them here to avoid a double-count); a context-only group optimistically
  // added to the compared user becomes shared, everything else stays onlyContext.
  const onlyContext: GroupMembership[] = [];
  for (const m of contextGroups) {
    if (comparedGroupIds.has(m.group.id)) continue;
    if (addedToComparedIds.has(m.group.id)) shared.push(m);
    else onlyContext.push(m);
  }

  return { onlyCompared, shared, onlyContext };
};

/**
 * Project one bucketed membership into the {@link DiffItem} row model that
 * `ComparisonDiffTab` renders.
 *
 * The whole membership rides along on {@link DiffItem.membership} rather than
 * being flattened into extra scalar fields: the row needs `id` and `label` to
 * render *today*, and everything a provenance line needs — the attributed
 * `rules`, the `attribution` gating how they may be read, and the group's own
 * `type` and description — stays reachable without this function having to
 * decide in advance which of them matter.
 *
 * Pure and React-free, so the Groups tab's projection is unit-testable on its
 * own rather than only through a rendered view.
 *
 * @param membership - A membership from any {@link GroupBuckets} bucket.
 * @returns The diff row for it, carrying the membership whole.
 */
export const groupDiffItem = (membership: GroupMembership): DiffItem => ({
  id: membership.group.id,
  label: membership.group.profile.name,
  membership,
});

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
 * Bucketing is by `id` alone: {@link AppEntry.scope} is carried through untouched
 * (the same entry objects come out) and never affects which bucket an app lands
 * in. One consequence of the `comparedApps`-only `shared` derivation above: a
 * shared entry's `scope` is the **compared** user's scope — the context user may
 * hold the same app by a different path.
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
