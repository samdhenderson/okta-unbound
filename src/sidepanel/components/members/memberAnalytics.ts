/**
 * @module sidepanel/components/members/memberAnalytics
 * @description Pure, memoizable helpers for the group Member Explorer: composition
 * breakdowns, MFA facet breakdowns, and member filtering. Kept free of React so the
 * heavy work over large groups (up to ~64k members) is easy to test and reason about.
 */

import type { OktaUser, MemberMfaResult } from '../../../shared/types';

/**
 * A member facet: the special 'mfa' or 'status' dimensions, or any profile
 * attribute key discovered on the members themselves. Kept as a broad string so
 * the composition report can surface arbitrary (including custom) Okta attributes.
 */
export type Dimension = string;

/** A profile-derived dimension: any attribute key, or the special 'status'. */
export type ProfileDimension = string;

/** Profile dimensions computed eagerly by {@link computeAllBreakdowns} (used for the status filter). */
export const PROFILE_DIMENSIONS: ProfileDimension[] = [
  'status',
  'department',
  'title',
  'manager',
  'city',
  'state',
  'countryCode',
];

/** Sort fields for the member list. */
export type SortField = 'name' | 'status' | 'factors';

/**
 * Friendlier display titles for well-known attribute keys. Any key not listed
 * here falls back to {@link humanizeAttributeKey}.
 */
export const DIMENSION_TITLES: Record<string, string> = {
  status: 'Status',
  department: 'Department',
  title: 'Title',
  manager: 'Manager',
  city: 'City',
  state: 'State / Region',
  countryCode: 'Country',
  zipCode: 'Zip / Postal code',
  costCenter: 'Cost center',
  userType: 'User type',
  employeeType: 'Employee type',
  division: 'Division',
  organization: 'Organization',
  locale: 'Locale',
  timezone: 'Timezone',
  preferredLanguage: 'Preferred language',
};

/**
 * Profile attributes whose value is an identity/PII field or intrinsically unique
 * per person (names, emails, phone numbers, IDs). Their "spread" carries no signal,
 * so they are never offered as a composition facet.
 */
/**
 * Dimension names the filter grammar has already claimed, and which profile
 * attribute discovery must therefore never materialise as a facet.
 *
 * `Dimension` is a bare `string`, so a discovered attribute and a built-in
 * dimension are indistinguishable once they are in a {@link MemberFilter}. An
 * org with a custom profile attribute literally named `source` would otherwise
 * produce a facet whose filters collide with the membership-source pills —
 * selecting one would silently filter by the other. `status` had the same hole
 * before `source` existed; it is closed here too rather than left as the next
 * person's surprise.
 *
 * Note `status` is *also* a legitimate dimension (`getMemberDimensionValue`
 * special-cases it to the account status). Reserving it removes only the
 * duplicate *profile* attribute of the same name, which is exactly the
 * ambiguous case — where one bare name means two things, the built-in wins.
 */
export const RESERVED_DIMENSIONS = new Set<string>(['mfa', 'status', 'source']);

/** The dimension a membership-source filter uses. */
export const SOURCE_DIMENSION = 'source';

export const EXCLUDED_ATTRIBUTES = new Set<string>([
  'login',
  'email',
  'secondEmail',
  'firstName',
  'lastName',
  'middleName',
  'displayName',
  'nickName',
  'name',
  'honorificPrefix',
  'honorificSuffix',
  'mobilePhone',
  'primaryPhone',
  'streetAddress',
  'postalAddress',
  'profileUrl',
  'employeeNumber',
  'managerId',
  'id',
]);

/** Leading order for common organizational attributes; the rest follow by fill rate. */
const PREFERRED_ATTRIBUTE_ORDER = [
  'department',
  'title',
  'manager',
  'division',
  'organization',
  'userType',
  'employeeType',
  'costCenter',
  'city',
  'state',
  'countryCode',
];

/**
 * Convert a camelCase / snake_case / kebab-case attribute key into a sentence-case label.
 * @param key - Raw profile attribute key.
 * @returns A human-readable label (falls back to the original key if empty).
 */
export function humanizeAttributeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Display title for any dimension: a curated name if known, else the humanized key.
 * @param dim - Dimension / attribute key.
 * @returns The display title for the dimension.
 */
export function dimensionTitle(dim: string): string {
  return DIMENSION_TITLES[dim] ?? humanizeAttributeKey(dim);
}

/** Sentinel filter value representing a missing/empty attribute. */
export const NONE_VALUE = '__none__';
/** Sentinel value for the aggregated "Other" tail row (not clickable). */
export const OTHER_VALUE = '__other__';

export interface BreakdownRow {
  value: string; // canonical value used for filtering (NONE_VALUE / OTHER_VALUE for sentinels)
  label: string; // display label
  count: number;
  pct: number; // 0-100 of total members
}

export interface MemberFilter {
  dimension: Dimension;
  value: string;
  label: string;
}

/**
 * Coerce an arbitrary profile value into a display/grouping string. Strings are
 * trimmed; numbers and booleans are stringified; everything else (objects, arrays,
 * null) is treated as missing ('').
 */
function coerceScalar(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  return '';
}

/**
 * Get a member's value for a profile dimension.
 * @param user - The member.
 * @param dim - The profile attribute key, or the special `'status'`.
 * @returns The coerced scalar value, or `''` when missing.
 */
export function getMemberDimensionValue(user: OktaUser, dim: ProfileDimension): string {
  if (dim === 'status') return user.status || '';
  return coerceScalar(user.profile?.[dim]);
}

/**
 * Convert a value->count map into sorted breakdown rows, keeping the top
 * `maxRows` values and aggregating the remainder into a single "Other" row.
 */
function mapToRows(counts: Map<string, number>, total: number, maxRows: number): BreakdownRow[] {
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const rows: BreakdownRow[] = [];

  const head = entries.slice(0, maxRows);
  const tail = entries.slice(maxRows);

  for (const [value, count] of head) {
    rows.push({
      value: value === '' ? NONE_VALUE : value,
      label: value === '' ? '(none)' : value,
      count,
      pct: total > 0 ? (count / total) * 100 : 0,
    });
  }

  if (tail.length > 0) {
    const otherCount = tail.reduce((sum, [, c]) => sum + c, 0);
    rows.push({
      value: OTHER_VALUE,
      label: `Other (${tail.length} ${tail.length === 1 ? 'value' : 'values'})`,
      count: otherCount,
      pct: total > 0 ? (otherCount / total) * 100 : 0,
    });
  }

  return rows;
}

/**
 * Compute the full breakdown for a single dimension (no "Other" aggregation by
 * default). Used to reveal the values hidden behind an aggregated "Other" row.
 * @param members - Members to tally.
 * @param dim - The dimension to break down.
 * @param maxRows - Named values to keep before collapsing the rest into "Other" (default: unlimited).
 * @returns Sorted breakdown rows for the dimension.
 */
export function computeDimensionBreakdown(
  members: OktaUser[],
  dim: ProfileDimension,
  maxRows = Number.POSITIVE_INFINITY,
): BreakdownRow[] {
  const counts = new Map<string, number>();
  for (const member of members) {
    const value = getMemberDimensionValue(member, dim);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return mapToRows(counts, members.length, maxRows);
}

/**
 * Compute breakdown rows for every {@link PROFILE_DIMENSIONS} dimension in a
 * single pass over members.
 * @param members - Members to tally.
 * @param maxRows - Named values kept per dimension before collapsing into "Other" (default: 8).
 * @returns A map from each profile dimension to its sorted breakdown rows.
 */
export function computeAllBreakdowns(
  members: OktaUser[],
  maxRows = 8,
): Record<ProfileDimension, BreakdownRow[]> {
  const maps: Record<ProfileDimension, Map<string, number>> = {
    status: new Map(),
    department: new Map(),
    title: new Map(),
    manager: new Map(),
    city: new Map(),
    state: new Map(),
    countryCode: new Map(),
  };

  for (const member of members) {
    for (const dim of PROFILE_DIMENSIONS) {
      const value = getMemberDimensionValue(member, dim);
      const map = maps[dim];
      map.set(value, (map.get(value) || 0) + 1);
    }
  }

  const total = members.length;
  const result = {} as Record<ProfileDimension, BreakdownRow[]>;
  for (const dim of PROFILE_DIMENSIONS) {
    result[dim] = mapToRows(maps[dim], total, maxRows);
  }
  return result;
}

/** A discovered profile attribute plus its value distribution. */
export interface AttributeSummary {
  key: string; // profile attribute key
  label: string; // display title
  distinct: number; // count of distinct non-empty values
  populated: number; // members with a non-empty value
  total: number; // total members
  fillRate: number; // 0-100, populated / total
  rows: BreakdownRow[]; // top values (+ "Other" / "(none)") for the summary bar
  /**
   * Values that differ from another value **only** in case or whitespace, found
   * over the attribute's *full* value map — see {@link nearDuplicateValues}.
   *
   * It is carried on the summary rather than derived from {@link
   * AttributeSummary.rows} because `rows` is already truncated by the time a card
   * sees it, and the tail is exactly where a mis-spelled duplicate hides:
   * `engineering` with three members sits behind `Engineering` with nine hundred.
   * Computing it during the discovery pass, where the whole map is in hand, costs
   * one extra walk of the distinct values and no extra walk of the roster.
   *
   * Optional because a hand-built summary (a story, a fixture) has no full map;
   * {@link attributeDriftValues} falls back to the named rows for those.
   */
  driftValues?: readonly string[];
}

export interface DiscoverOptions {
  /** Named values kept per attribute before the rest collapse into "Other". */
  maxRows?: number;
  /** Minimum populated count before the near-unique guard applies (protects small groups). */
  minPopulated?: number;
  /** distinct/populated at or above which an attribute is treated as an identifier and dropped. */
  uniqueRatio?: number;
}

/**
 * Discover every browseable profile attribute across the members and compute each
 * one's value distribution in a single pass. Identity/PII fields ({@link
 * EXCLUDED_ATTRIBUTES}) and attributes whose values are essentially unique per
 * person (e.g. employee IDs) are dropped so only fields with a meaningful spread
 * remain. Results are ordered with common organizational attributes first, then by
 * fill rate.
 * @param members - The full member set to scan.
 * @param options - Tuning knobs (see {@link DiscoverOptions}).
 * @returns One {@link AttributeSummary} per surfaced attribute, pre-ordered.
 */
export function discoverAttributeBreakdowns(
  members: OktaUser[],
  options: DiscoverOptions = {},
): AttributeSummary[] {
  const { maxRows = 6, minPopulated = 10, uniqueRatio = 0.9 } = options;
  const total = members.length;

  // One pass over every member's profile → value counts per discovered key.
  const counts = new Map<string, Map<string, number>>();
  for (const member of members) {
    const profile = member.profile;
    if (!profile) continue;
    for (const key in profile) {
      if (EXCLUDED_ATTRIBUTES.has(key) || RESERVED_DIMENSIONS.has(key)) continue;
      const value = coerceScalar(profile[key]);
      if (value === '') continue; // never materialize keys that are only ever empty
      let map = counts.get(key);
      if (!map) {
        map = new Map();
        counts.set(key, map);
      }
      map.set(value, (map.get(value) || 0) + 1);
    }
  }

  const summaries: AttributeSummary[] = [];
  for (const [key, map] of counts) {
    const distinct = map.size;
    let populated = 0;
    for (const c of map.values()) populated += c;

    // Skip identifier-like attributes: once we have enough data, nearly every
    // populated value being distinct means it's a per-person unique field.
    if (populated >= minPopulated && distinct >= populated * uniqueRatio) continue;

    // Fold in a "(none)" bucket so the summary reflects members missing the value.
    const withMissing = new Map(map);
    const missing = total - populated;
    if (missing > 0) withMissing.set('', missing);

    summaries.push({
      key,
      label: dimensionTitle(key),
      distinct,
      populated,
      total,
      fillRate: total > 0 ? (populated / total) * 100 : 0,
      rows: mapToRows(withMissing, total, maxRows),
      // Over the *full* value map, not the truncated rows above: a duplicate
      // spelling is most often in the tail the summary is about to fold away.
      driftValues: nearDuplicateValues(map.keys()),
    });
  }

  const preferredRank = (k: string) => {
    const i = PREFERRED_ATTRIBUTE_ORDER.indexOf(k);
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  summaries.sort((a, b) => {
    const ra = preferredRank(a.key);
    const rb = preferredRank(b.key);
    if (ra !== rb) return ra - rb;
    if (b.fillRate !== a.fillRate) return b.fillRate - a.fillRate;
    return a.label.localeCompare(b.label);
  });

  return summaries;
}

/**
 * Evaluate whether an MFA result matches a given mfa-dimension filter value.
 * Supported values: 'none', 'multiple', 'enrolled', 'has:<label>', 'missing:<label>'.
 * @param result - The member's scan result, or undefined if unscanned.
 * @param value - The mfa filter value to test against.
 * @returns True when the member satisfies the filter value.
 */
export function memberMatchesMfaValue(result: MemberMfaResult | undefined, value: string): boolean {
  if (value.startsWith('missing:')) {
    // "missing X" is true when the member does not have label X (including unscanned).
    return !(result?.factorLabels.includes(value.slice(8)) ?? false);
  }
  if (!result) return false;
  if (value === 'none') return result.factorCount === 0;
  if (value === 'enrolled') return result.enrolled;
  if (value === 'multiple') return result.factorCount >= 2;
  if (value.startsWith('has:')) return result.factorLabels.includes(value.slice(4));
  return false;
}

/**
 * Build MFA facet rows from scan results: "No factors", "Multiple factors", and
 * one "Has X" row per observed factor label.
 * @param members - Members to tally.
 * @param mfaResults - Per-member scan results, or null before a scan has run.
 * @returns Breakdown rows for the MFA facet (empty when `mfaResults` is null).
 */
export function computeMfaBreakdown(
  members: OktaUser[],
  mfaResults: Map<string, MemberMfaResult> | null,
): BreakdownRow[] {
  if (!mfaResults) return [];
  const total = members.length;

  let noneCount = 0;
  let multipleCount = 0;
  const labelCounts = new Map<string, number>();

  for (const member of members) {
    const result = mfaResults.get(member.id);
    if (!result) continue;
    if (result.factorCount === 0) noneCount++;
    if (result.factorCount >= 2) multipleCount++;
    for (const label of result.factorLabels) {
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    }
  }

  const rows: BreakdownRow[] = [];
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  rows.push({ value: 'none', label: 'No factors enrolled', count: noneCount, pct: pct(noneCount) });
  rows.push({
    value: 'multiple',
    label: 'Multiple factors (2+)',
    count: multipleCount,
    pct: pct(multipleCount),
  });

  Array.from(labelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([label, count]) => {
      rows.push({ value: `has:${label}`, label: `Has ${label}`, count, pct: pct(count) });
    });

  return rows;
}

/**
 * Collect the sorted set of factor labels observed across all scan results.
 * @param mfaResults - Per-member scan results, or null before a scan has run.
 * @returns Alphabetically sorted distinct factor labels (empty when null).
 */
export function getObservedFactorLabels(mfaResults: Map<string, MemberMfaResult> | null): string[] {
  if (!mfaResults) return [];
  const labels = new Set<string>();
  mfaResults.forEach((r) => r.factorLabels.forEach((l) => labels.add(l)));
  return Array.from(labels).sort();
}

/** Does a member match the free-text search query? (name / email / login) */
function matchesQuery(user: OktaUser, lowerQuery: string): boolean {
  if (!lowerQuery) return true;
  const p = user.profile;
  return (
    (p.firstName || '').toLowerCase().includes(lowerQuery) ||
    (p.lastName || '').toLowerCase().includes(lowerQuery) ||
    (p.email || '').toLowerCase().includes(lowerQuery) ||
    (p.login || '').toLowerCase().includes(lowerQuery)
  );
}

/**
 * Filter members by search query and active facet filters.
 * Semantics: OR within a dimension, AND across dimensions. (Per-factor MFA
 * constraints are the exception: each is an independent AND requirement.)
 * @param members - The full member set.
 * @param query - Free-text search over name/email/login (trimmed, case-insensitive).
 * @param filters - Active facet filters.
 * @param mfaResults - Per-member scan results, needed to evaluate mfa filters.
 * @param sourceBuckets - Member ids per membership-source bucket, from
 * `shared/membership/memberSourceIndex`. Needed only to evaluate
 * {@link SOURCE_DIMENSION} filters; omit on surfaces that do not offer them.
 * @returns The subset of members matching the query and all filter dimensions.
 */
export function filterMembers(
  members: OktaUser[],
  query: string,
  filters: MemberFilter[],
  mfaResults: Map<string, MemberMfaResult> | null,
  sourceBuckets?: ReadonlyMap<string, ReadonlySet<string>> | null,
): OktaUser[] {
  const lowerQuery = query.trim().toLowerCase();

  // Group selected values by dimension.
  const byDimension = new Map<Dimension, Set<string>>();
  for (const f of filters) {
    let set = byDimension.get(f.dimension);
    if (!set) {
      set = new Set();
      byDimension.set(f.dimension, set);
    }
    set.add(f.value);
  }

  if (lowerQuery === '' && byDimension.size === 0) return members;

  return members.filter((member) => {
    if (!matchesQuery(member, lowerQuery)) return false;

    for (const [dimension, values] of byDimension) {
      if (dimension === SOURCE_DIMENSION) {
        // Set membership, not a predicate: `otherRules` folds an arbitrary set
        // of rules together and a predicate would have to be told which ones.
        // OR within the dimension, like any other facet.
        //
        // With no index this matches **nothing**, deliberately. The state should
        // be unreachable — source pills only render once the analysis has run —
        // but the safe direction for an unevaluable constraint is to satisfy no
        // one rather than everyone. Matching everything would leave a pill
        // looking active while changing nothing, which is a false statement
        // about what the reader is looking at; an empty list is visibly wrong
        // and says so.
        if (!sourceBuckets) return false;
        const inAny = Array.from(values).some((value) => sourceBuckets.get(value)?.has(member.id));
        if (!inAny) return false;
      } else if (dimension === 'mfa') {
        // Each factor constraint is an independent requirement (AND), so
        // "Has SMS" + "Missing Okta Verify" means both must hold.
        const result = mfaResults?.get(member.id);
        const ok = Array.from(values).every((v) => memberMatchesMfaValue(result, v));
        if (!ok) return false;
      } else {
        const raw = getMemberDimensionValue(member, dimension as ProfileDimension);
        const canonical = raw === '' ? NONE_VALUE : raw;
        if (!values.has(canonical)) return false;
      }
    }
    return true;
  });
}

/**
 * Display name for a member.
 * @param user - The member.
 * @returns "First Last", falling back to the login, or `''` if neither is set.
 */
export function memberFullName(user: OktaUser): string {
  const name = `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim();
  return name || user.profile.login || '';
}

/**
 * Sort members by the given field, with a stable name tie-break.
 * @param members - Members to sort (not mutated).
 * @param sortBy - Field to sort by.
 * @param sortDesc - Reverse the order when true.
 * @param mfaResults - Per-member scan results, required for the `'factors'` field.
 * @returns A new, sorted array.
 */
export function sortMembers(
  members: OktaUser[],
  sortBy: SortField,
  sortDesc: boolean,
  mfaResults: Map<string, MemberMfaResult> | null,
): OktaUser[] {
  const sorted = [...members].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'name':
        cmp = memberFullName(a).localeCompare(memberFullName(b));
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      case 'factors': {
        const fa = mfaResults?.get(a.id)?.factorCount ?? -1;
        const fb = mfaResults?.get(b.id)?.factorCount ?? -1;
        cmp = fa - fb;
        break;
      }
    }
    // Stable, predictable tie-break by name.
    if (cmp === 0) cmp = memberFullName(a).localeCompare(memberFullName(b));
    return sortDesc ? -cmp : cmp;
  });
  return sorted;
}

/**
 * Share of the dominant value at or above which an attribute is treated as
 * having a house style worth diverging from.
 *
 * Below it there is no standard: an attribute split 40/35/25 across three
 * departments is a legitimate spread, and calling the 25% one an outlier would
 * be nonsense.
 */
export const OUTLIER_DOMINANT_SHARE = 60;

/**
 * Share at or below which a value is a candidate outlier, once a dominant value
 * exists.
 */
export const OUTLIER_MAX_SHARE = 10;

/**
 * The values in one attribute's distribution that look like drift rather than
 * spread: a handful of people whose value diverges from an otherwise dominant
 * house style — `Engineering` in 94 rows and `engineering` in 3.
 *
 * Deliberately conservative, because a false positive here accuses a correct
 * record of being wrong:
 *
 * - **A dominant value must exist** ({@link OUTLIER_DOMINANT_SHARE}). Without
 *   one there is no standard to diverge from, and a genuine three-way split
 *   would otherwise report its smallest arm as an error.
 * - **Blanks are never outliers.** An empty attribute is a different problem
 *   with a different fix, and the card already states the fill rate.
 * - **The `Other` bucket is never an outlier.** It is an aggregate of values the
 *   report did not name, so it cannot be one value that is wrong.
 * - **The dominant value itself is never an outlier**, even in the degenerate
 *   case where it is also below the small-share threshold.
 *
 * @param summary - One attribute's precomputed distribution.
 * @returns The canonical values that look like drift, in the order they appear
 * in the report. Empty when nothing qualifies — which is the common case.
 */
export function outlierValues(summary: AttributeSummary): string[] {
  const real = summary.rows.filter((row) => row.value !== NONE_VALUE && row.value !== OTHER_VALUE);
  if (real.length < 2) return [];

  // Shares are of *all* members, blanks included; the comparison here is against
  // the populated rows only, so a half-blank attribute is not disqualified from
  // having a house style among the people who do have a value.
  const populated = summary.populated;
  if (populated === 0) return [];

  const shareOf = (count: number): number => (count / populated) * 100;
  let dominant = real[0];
  for (const row of real) if (dominant && row.count > dominant.count) dominant = row;
  if (!dominant || shareOf(dominant.count) < OUTLIER_DOMINANT_SHARE) return [];

  return real
    .filter((row) => row !== dominant && shareOf(row.count) <= OUTLIER_MAX_SHARE)
    .map((row) => row.value);
}

/* -------------------------------------------------------------------------- *
 * Attribute ranking — which attribute is worth reading first
 * -------------------------------------------------------------------------- */

/**
 * Weight of the drift signal: two or more values that differ only in case or
 * whitespace.
 *
 * The heaviest of the three because it is the only one that names something
 * *wrong*. A hidden tail and a rule dependency are both facts about an
 * attribute; near-duplicates are one value spelled two ways, which silently
 * splits a rule's population.
 */
export const DRIFT_WEIGHT = 4;

/**
 * Weight of the hidden-tail signal: enough of the group sits in values the
 * summary declined to name that the named rows no longer describe the group.
 */
export const TAIL_WEIGHT = 2;

/**
 * Weight of the rule-coupling signal.
 *
 * Deliberately the lightest. Coupling says an attribute is load-bearing
 * *today*, which is why it breaks ties — but an attribute with drift outranks
 * one that merely feeds a rule, because the drift is what will break the rule.
 * This replaces the old rule-referenced-first partition, under which an
 * immaculate rule-fed attribute sorted above a mis-spelled one nobody had
 * written a rule against yet.
 */
export const RULE_WEIGHT = 1;

/**
 * Share of the whole roster (percent) at or above which the folded-away tail is
 * a signal rather than a footnote.
 *
 * Twenty percent is where "the named values describe this group" stops being
 * true: below it the named rows still account for four members in five.
 */
export const TAIL_SHARE_THRESHOLD = 20;

/**
 * Fold a raw attribute value to the form near-duplicate detection compares on:
 * trimmed, lower-cased, internal whitespace runs collapsed to a single space.
 *
 * Deliberately nothing else. Punctuation, abbreviation and spelling are **not**
 * normalized away — `Eng` and `Engineering` may well be the same team, but only
 * a human can say so, whereas `Engineering ` and `engineering` cannot be
 * anything but one value entered twice.
 *
 * @param raw - A value label exactly as Okta returned it.
 * @returns The comparison key. Never shown to a reader — the original spelling is.
 */
export function normalizeAttributeValue(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The values in a set that differ from another value **only** in case or
 * whitespace — `Engineering`, `engineering` and `ENGINEERING` in one group.
 *
 * A different, cheaper and more honest claim than {@link outlierValues}. That
 * function needs a dominant value at {@link OUTLIER_DOMINANT_SHARE} and can only
 * see the rows a summary named, so it cannot spot `engineering` sitting inside
 * the folded-away tail behind `Engineering` — exactly the case the Insights pane
 * exists to catch. This one makes no claim about which spelling is *right*, and
 * holds at any distribution shape.
 *
 * Blank values are skipped: a missing value is a fill-rate problem, not a
 * spelling one, and every blank would otherwise collide with every other blank.
 *
 * @param labels - Every distinct value label for one attribute.
 * @returns The colliding labels, grouped by collision, in first-seen order.
 * Empty when every value stands on its own — the common case.
 */
export function nearDuplicateValues(labels: Iterable<string>): string[] {
  const groups = new Map<string, string[]>();
  for (const label of labels) {
    const key = normalizeAttributeValue(label);
    if (key === '') continue;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, [label]);
      // The exact same spelling handed in twice is one value, not two — a caller
      // iterating rows rather than a map must not get a false positive.
    } else if (!group.includes(label)) {
      group.push(label);
    }
  }

  const collisions: string[] = [];
  for (const group of groups.values()) {
    if (group.length > 1) collisions.push(...group);
  }
  return collisions;
}

/** Which of the three ranking signals an {@link AttributeSignal} reports. */
export type AttributeSignalKind = 'drift' | 'tail' | 'rule';

/**
 * One reason an attribute ranks where it does, in a form a badge can render.
 *
 * The badge text is a **phrase, never a bare number**: a collapsed card still has
 * to show why it sorted where it did, and `3` on its own explains nothing.
 * Colour is never the only carrier — every signal reads as words first.
 */
export interface AttributeSignal {
  /** Which signal this is. Mapped to a badge variant at the call site. */
  kind: AttributeSignalKind;
  /** This signal's contribution to the attribute's score. */
  weight: number;
  /** Badge text — a self-contained phrase. */
  label: string;
  /** The longer sentence, for the badge's tooltip. */
  description: string;
}

/**
 * How many members sit in the values a summary folded into its aggregated
 * `Other` row.
 *
 * Read off the summary rather than recomputed, so it agrees with the bar the
 * card actually draws. Note that {@link discoverAttributeBreakdowns} ranks the
 * blank bucket alongside real values, so a mostly-blank attribute can fold
 * blanks into this count — which is the right answer for "how much of this group
 * the named rows do not describe".
 *
 * @param summary - One attribute's precomputed distribution.
 * @returns The tail's member count; `0` when nothing was folded away.
 */
export function attributeTailCount(summary: AttributeSummary): number {
  return summary.rows.find((row) => row.value === OTHER_VALUE)?.count ?? 0;
}

/**
 * An attribute's near-duplicate values, preferring the authoritative set
 * {@link discoverAttributeBreakdowns} computed over the **full** value map.
 *
 * Falls back to the named rows for a hand-built summary (a story, a fixture).
 * That is a weaker answer — it cannot see the tail — but never a wrong one:
 * everything it flags is still a genuine collision.
 *
 * @param summary - One attribute's precomputed distribution.
 * @returns The colliding value labels.
 */
export function attributeDriftValues(summary: AttributeSummary): string[] {
  if (summary.driftValues) return [...summary.driftValues];
  return nearDuplicateValues(
    summary.rows
      .filter((row) => row.value !== NONE_VALUE && row.value !== OTHER_VALUE)
      .map((row) => row.label),
  );
}

/**
 * Every ranking signal that holds for one attribute, in badge order:
 * drift → hidden tail → rule coupling.
 *
 * @param summary - One attribute's precomputed distribution.
 * @param ruleCount - How many feeding rules reference the attribute.
 * @returns The signals that hold. Empty means the attribute is quiet — a real
 * answer, not a missing one.
 */
export function attributeSignals(summary: AttributeSummary, ruleCount: number): AttributeSignal[] {
  const signals: AttributeSignal[] = [];

  const drift = attributeDriftValues(summary);
  if (drift.length > 1) {
    signals.push({
      kind: 'drift',
      weight: DRIFT_WEIGHT,
      label: `${drift.length} near-duplicate values`,
      description: `${drift.join(', ')} — these differ only in case or spacing, so they are almost certainly one value entered more than one way.`,
    });
  }

  const tailCount = attributeTailCount(summary);
  const tailShare = summary.total > 0 ? (tailCount / summary.total) * 100 : 0;
  if (tailShare >= TAIL_SHARE_THRESHOLD) {
    signals.push({
      kind: 'tail',
      weight: TAIL_WEIGHT,
      label: `${Math.round(tailShare)}% hidden in the tail`,
      description: `${tailCount.toLocaleString()} of ${summary.total.toLocaleString()} members hold a value this card does not name. Open it to see them.`,
    });
  }

  if (ruleCount > 0) {
    signals.push({
      kind: 'rule',
      weight: RULE_WEIGHT,
      label: ruleCount === 1 ? 'A rule depends on it' : `${ruleCount} rules depend on it`,
      description: 'A feeding rule reads this attribute, so how it is spelled grants access today.',
    });
  }

  return signals;
}

/** An attribute plus why it ranks where it does. */
export interface RankedAttribute {
  /** The attribute's precomputed distribution. */
  summary: AttributeSummary;
  /** The signals that hold, in badge order. */
  signals: AttributeSignal[];
  /** Sum of the signals' weights. */
  score: number;
  /** `true` when at least one signal holds — the flagged/quiet split. */
  flagged: boolean;
}

/**
 * Rank discovered attributes by how much they want reading: score descending,
 * **stable** within a score.
 *
 * Stability is the point of the second half. `discoverAttributeBreakdowns`
 * already orders by "common organizational attributes first, then fill rate";
 * scoring re-orders across that ordering without discarding it, so two equally
 * unremarkable attributes keep the sensible order they arrived in.
 *
 * @param summaries - Discovered attributes, in discovery order.
 * @param ruleCountFor - How many feeding rules reference a given attribute key.
 * @returns One entry per summary, ranked.
 */
export function rankAttributes(
  summaries: readonly AttributeSummary[],
  ruleCountFor: (key: string) => number,
): RankedAttribute[] {
  const ranked = summaries.map((summary) => {
    const signals = attributeSignals(summary, ruleCountFor(summary.key));
    const score = signals.reduce((sum, signal) => sum + signal.weight, 0);
    return { summary, signals, score, flagged: score > 0 };
  });
  // `Array.prototype.sort` is stable, so discovery order survives inside a score.
  return ranked.sort((a, b) => b.score - a.score);
}
