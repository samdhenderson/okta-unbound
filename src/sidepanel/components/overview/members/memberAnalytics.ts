/**
 * @module sidepanel/components/overview/members/memberAnalytics
 * @description Pure, memoizable helpers for the group Member Explorer: composition
 * breakdowns, MFA facet breakdowns, and member filtering. Kept free of React so the
 * heavy work over large groups (up to ~64k members) is easy to test and reason about.
 */

import type { OktaUser, MemberMfaResult } from '../../../../shared/types';

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
      if (EXCLUDED_ATTRIBUTES.has(key)) continue;
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
 * @returns The subset of members matching the query and all filter dimensions.
 */
export function filterMembers(
  members: OktaUser[],
  query: string,
  filters: MemberFilter[],
  mfaResults: Map<string, MemberMfaResult> | null,
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
      if (dimension === 'mfa') {
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
