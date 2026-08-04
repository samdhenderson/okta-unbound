/**
 * @module sidepanel/components/policies/policyFilters
 * @description Pure filter helpers for the read-only Auth Policies list.
 *
 * The search predicate for the policy list, side-effect free, mirroring
 * `apps/appFilters.ts` and `groups/groupFilters.ts`. Extracted from
 * {@link sidepanel/components/AuthPoliciesTab} so it is unit-testable on its own and
 * so the tab shell holds shell state only.
 *
 * @remarks Deliberately no sort: the Auth Policies tab renders policies in the order
 * Okta returns them, which is priority order. Adding a sort control means adding a
 * comparator here, not in the component.
 */
import type { OktaPolicyListItem } from '../../../shared/schemas/okta';

/**
 * Filter policies by a case-insensitive substring of their name or description.
 *
 * @param policies - The loaded policies.
 * @param query - Raw search text; blank returns everything.
 * @returns The matching policies, in their original (priority) order. The input
 * array is returned as-is for a blank query, so a memoized caller keeps its
 * reference identity.
 */
export function filterPolicies(
  policies: OktaPolicyListItem[],
  query: string,
): OktaPolicyListItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return policies;
  return policies.filter(
    (policy) =>
      (policy.name ?? '').toLowerCase().includes(needle) ||
      (policy.description ?? '').toLowerCase().includes(needle),
  );
}
