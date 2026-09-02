/**
 * @module sidepanel/hooks/fetchGroupRulesRequest
 * @description Scheduler-routed fetch of all group rules with names + conflicts.
 *
 * §8: reproduces the content script's former `fetchGroupRules` handler in the side
 * panel, issuing every fetch through the rate-limited scheduler (`makeApiRequest`)
 * instead of a direct `chrome.tabs.sendMessage`. The four-stage pipeline was ported
 * verbatim from the content script's `ruleHandlers.ts` (since deleted — this module
 * is the sole implementation):
 *   1. paginate `/api/v1/groups/rules?limit=200` (follow `Link` rel="next"),
 *      validating every page against `oktaGroupRuleSchema` (ADR-0006);
 *   2. label referenced group ids with names from the org snapshot (no API calls;
 *      unknown ids fall back to the id in the display — ADR-0040);
 *   3. detect attribute/target conflicts between active rules (O(n²));
 *   4. format each rule for display (names, `allGroupNamesMap`, conflicts).
 * The `{ success, rules, stats, conflicts }` **top-level** result shape (not under
 * `data`) is preserved so consumers change only their transport line.
 */

import type { OktaGroupRule, FormattedRule, RuleConflict, RuleStats } from '../../shared/types';
import type { CoreApi } from './useOktaApi/core';
import { detectConflicts, expressionText, formatRuleForDisplay } from '../../shared/ruleUtils';
import { nextPageUrl } from './useOktaApi/utilities';
import { orgSnapshotStore } from '../../shared/snapshot/orgSnapshotStore';
import type { RawOktaGroup } from '../components/groups/groupSummary';
import { findRulesWithMissingTargets } from '../components/groups/ruleOrphans';
import { createLogger } from '../../shared/utils/logger';
import { oktaGroupRuleSchema, parseOktaList } from '../../shared/schemas/okta';

const log = createLogger('fetchGroupRulesRequest');

/** The scheduler-routed request function (`useOktaApi().makeApiRequest`). */
type MakeApiRequest = CoreApi['makeApiRequest'];

/** Result of {@link fetchGroupRulesRequest}, mirroring the old content-script response. */
export interface FetchGroupRulesResult {
  success: boolean;
  rules?: FormattedRule[];
  /**
   * The same rules exactly as returned by Okta (the one paginated fetch produces
   * both shapes) — cached in `RulesCache` so raw-rule consumers (e.g. rule-impact
   * analysis) never re-paginate data already in memory.
   */
  rawRules?: OktaGroupRule[];
  stats?: RuleStats;
  conflicts?: RuleConflict[];
  error?: string;
}

/** Matches an Okta group id embedded in a rule condition expression. */
const GROUP_ID_IN_EXPRESSION = /\b00g[a-zA-Z0-9]{17}\b/g;

/**
 * Collect every group id a rule references — both its assignment targets and any
 * group ids embedded in its condition expression.
 *
 * The expression is read through `ruleUtils.expressionText`, the shared
 * string-or-`''` guard, rather than a local falsy check: `expression.value` is
 * typed `string` but that is a claim about an Okta response, not a check of one,
 * and a non-string here would throw `.match` out of the caller's `.map` and cost
 * the whole rules surface for one malformed row (D-066, the twin of D-055).
 */
function groupIdsReferencedBy(rule: OktaGroupRule): string[] {
  const ids = rule.actions?.assignUserToGroups?.groupIds || [];
  const inExpression = expressionText(rule).match(GROUP_ID_IN_EXPRESSION) || [];
  return [...ids, ...inExpression];
}

/**
 * Build an id→name map for the org's groups, from the snapshot (ADR-0040).
 *
 * Reuses names the background already walked instead of issuing a
 * `GET /api/v1/groups/{id}` per referenced group. Exported because it is the
 * cheapest id→name source in the extension — one local read, no API traffic —
 * and the Rules tab, the blast-radius report and the user comparison all need
 * the same labels for group ids embedded in a rule condition.
 *
 * @param origin - The connected org's origin, which the snapshot is scoped by.
 * A missing origin returns an empty map rather than reading some other org's
 * names; callers then fall back to showing the raw group id.
 * @returns Group id → display name for every group the snapshot holds.
 * @remarks Was the Groups tab's `chrome.storage.local` cache until ADR-0040
 * moved the group list into the background-owned snapshot. It reads the same
 * rows the Groups tab renders, so the two can no longer disagree — and unlike
 * the old cache it has no TTL of its own to age out from under the rules.
 * {@link orgSnapshotStore.getCollection} logs and swallows its own failures, so
 * there is nothing to catch here: a store that cannot be read yields no names,
 * which is the same degrade as an org with none.
 */
export async function loadCachedGroupNames(
  origin: string | null | undefined,
): Promise<Map<string, string>> {
  return (await loadCachedGroupIndex(origin)).nameById;
}

/** What the snapshot can say about the org's groups in one read. */
export interface CachedGroupIndex {
  /** Group id → display name, for every group the snapshot holds. */
  nameById: Map<string, string>;
  /**
   * Every group id the snapshot holds — including the ones with no usable name,
   * which {@link CachedGroupIndex.nameById} necessarily drops. A membership
   * question asked of this set must not turn on whether a row happened to carry
   * a `profile.name`.
   */
  idsHeld: Set<string>;
  /**
   * Whether the group walk finished. `false` for an interrupted walk, an org
   * that has never been walked, and a missing origin alike — so a reader that
   * gates on it degrades to saying nothing rather than to a claim built on a
   * partial inventory (ADR-0040 §7).
   */
  complete: boolean;
}

/**
 * The group snapshot read as both a naming source and an inventory.
 *
 * {@link loadCachedGroupNames} answers "what is this id called?", which needs
 * only the rows that have names. Deciding an id has **no** group behind it is a
 * different question with a different failure mode — a negative read — and it
 * needs two things that map cannot supply: every id held, named or not, and
 * whether the walk that produced them finished.
 *
 * @param origin - The connected org's origin. A missing one yields an empty,
 * incomplete index rather than another org's rows.
 * @returns See {@link CachedGroupIndex}.
 */
export async function loadCachedGroupIndex(
  origin: string | null | undefined,
): Promise<CachedGroupIndex> {
  const nameById = new Map<string, string>();
  const idsHeld = new Set<string>();
  if (!origin) return { nameById, idsHeld, complete: false };
  const groups = await orgSnapshotStore.getCollection<RawOktaGroup>('groups', origin);
  for (const group of groups) {
    if (!group.id) continue;
    idsHeld.add(group.id);
    const name = group.profile?.name;
    if (name) nameById.set(group.id, name);
  }
  const meta = await orgSnapshotStore.getMeta('groups', origin);
  return { nameById, idsHeld, complete: meta.complete };
}

/**
 * Fetch every group rule through the scheduler, resolve referenced group names,
 * detect conflicts, and return display-formatted rules plus aggregate stats — the
 * exact behavior of the old content-script `fetchGroupRules` handler.
 *
 * @param makeApiRequest - `useOktaApi().makeApiRequest`, routing via the background scheduler.
 * @param currentGroupId - When provided, flags rules that target this group
 *   (`affectsCurrentGroup`); the caller supplies the panel's current group, which
 *   mirrors the page-URL group the content script used to derive.
 * @param options - `resolveGroupNames` (default `true`) controls step 2. Set it to
 *   `false` for callers that only need raw rule ids/expressions (e.g. membership
 *   analysis, which never reads a resolved name): it skips the snapshot read and
 *   leaves `groupNames`/`allGroupNamesMap` falling back to ids. `origin` is the
 *   connected org, required for step 2 to resolve anything at all.
 * @returns `{ success: true, rules, stats, conflicts }`; a failed rules page is
 *   returned verbatim, and a thrown error becomes `{ success: false, error }`.
 * @remarks Every page is validated with `oktaGroupRuleSchema` through
 *   `parseOktaList` (ADR-0006). Validation is *lenient*: a malformed row is
 *   dropped rather than failing the load, so `rules`, `rawRules` and `stats`
 *   describe only the rows Okta returned in a shape this extension understands.
 */
export async function fetchGroupRulesRequest(
  makeApiRequest: MakeApiRequest,
  currentGroupId?: string,
  options: { resolveGroupNames?: boolean; origin?: string | null } = {},
): Promise<FetchGroupRulesResult> {
  const { resolveGroupNames = true, origin } = options;
  try {
    // 1. Fetch all rules with pagination.
    let rules: OktaGroupRule[] = [];
    let nextUrl: string | null = '/api/v1/groups/rules?limit=200';

    while (nextUrl) {
      const response = await makeApiRequest(nextUrl, { reason: 'Load group rules' });
      if (!response.success) {
        return response;
      }
      // Validated at the response boundary (ADR-0006), mirroring
      // `ruleImpact.fetchRawRules`: `parseOktaList` is lenient, so a row that
      // fails `oktaGroupRuleSchema` is dropped and counted in a single warning
      // (counts only, never the row) while the rest of the page survives.
      // Rule expressions and target group ids are end-user-controllable
      // (`docs/security.md`), and five surfaces render what this returns.
      const page = parseOktaList(oktaGroupRuleSchema, response.data, 'GET /api/v1/groups/rules');
      // The lenient schema `.passthrough()`es fields it does not declare
      // (`created`, `lastUpdated`, `type`, …), so validated rows still carry the
      // domain type's required audit fields at runtime — hence the widen through
      // `unknown`, the same one `ruleImpact` documents.
      rules = rules.concat(page as unknown as OktaGroupRule[]);
      // The empty-page loop guard reads what Okta *returned*, not what survived
      // validation: a page whose rows were all dropped is not the last page.
      const rowsReturned = Array.isArray(response.data) ? response.data.length : 0;
      nextUrl = nextPageUrl(nextUrl, response.headers?.link, rowsReturned);
    }

    log.debug('Fetched rules (total across all pages)', { count: rules.length });

    // 2. Label referenced group ids with names from the org snapshot — no API
    //    calls. Loading rules costs only the page fetches above; the snapshot is
    //    the single source of id→name. Ids absent from it fall back to the id in
    //    the display. Skipped when the caller only needs ids/expressions.
    const groupIndex = resolveGroupNames
      ? await loadCachedGroupIndex(origin)
      : { nameById: new Map<string, string>(), idsHeld: new Set<string>(), complete: false };
    const groupNameMap = groupIndex.nameById;

    // 3. Detect conflicts between active rules (O(n²), active-only).
    const conflicts = detectConflicts(rules);

    // 4. Format each rule for display, layering on the resolved group names.
    //    Target ids with no group behind them are stamped on here too — a set
    //    difference over rows already in hand, suppressed wholesale unless the
    //    group walk finished (D-061). `findRulesWithMissingTargets` owns the
    //    gate; this is only the projection onto its input shape.
    const missingTargetsByRule = new Map<string, string[]>(
      findRulesWithMissingTargets(
        rules.map((rule) => ({
          id: rule.id,
          name: rule.name,
          groupIds: rule.actions?.assignUserToGroups?.groupIds ?? [],
        })),
        groupIndex.idsHeld,
        groupIndex.complete,
      ).map((finding) => [finding.id, finding.missingGroupIds]),
    );

    const formattedRules: FormattedRule[] = rules.map((rule) => {
      const base = formatRuleForDisplay(rule, currentGroupId, conflicts);
      const groupNames = base.groupIds.map((id) => groupNameMap.get(id) || id);
      // Stamped whenever the question could be *asked*, so `[]` (asked, clean)
      // stays distinguishable from `undefined` (never asked). A surface that
      // could not tell them apart would have to treat a half-read inventory as
      // a clean bill of health.
      const missingGroupIds = groupIndex.complete
        ? (missingTargetsByRule.get(rule.id) ?? [])
        : undefined;

      // Map of ALL referenced group ids (targets + condition) → resolved names.
      const allGroupNamesMap: Record<string, string> = {};
      new Set(groupIdsReferencedBy(rule)).forEach((id) => {
        const name = groupNameMap.get(id);
        if (name) allGroupNamesMap[id] = name;
      });

      return missingGroupIds
        ? { ...base, groupNames, allGroupNamesMap, missingGroupIds }
        : { ...base, groupNames, allGroupNamesMap };
    });

    const activeCount = rules.filter((r) => r.status === 'ACTIVE').length;
    const stats: RuleStats = {
      total: rules.length,
      active: activeCount,
      inactive: rules.filter((r) => r.status === 'INACTIVE').length,
      conflicts: conflicts.length,
    };

    log.debug('Rule stats', stats);
    return { success: true, rules: formattedRules, rawRules: rules, stats, conflicts };
  } catch (error) {
    log.error('fetchGroupRules error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch rules',
    };
  }
}
