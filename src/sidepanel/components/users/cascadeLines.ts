/**
 * @module sidepanel/components/users/cascadeLines
 * @description Joins {@link BlastRadiusReport.cascades} to the rule rows it
 * references, so a row can render "which rules read this group, and what they
 * assign" without re-deriving anything.
 *
 * Pure and I/O-free. It exists as a module rather than a helper inside a
 * component file for two reasons: both Blast Radius row components need the same
 * joined shape and neither should own it, and exporting a non-component from a
 * component file breaks fast refresh (the rule `BlastRadiusGroupRow` states at
 * its own private helpers).
 *
 * ## Why the join exists at all
 *
 * `GroupCascadeRule` deliberately carries only a `ruleId`: the report's `rules`
 * array already holds every rule in the inventory with its name and target
 * groups, and duplicating those onto the cascade would give one name two places
 * to go stale. This module is where the two halves meet.
 *
 * ## Security
 *
 * Rule names and group names are untrusted, end-user-controllable tenant data.
 * Rendered through React's escaping only; nothing here is logged.
 */

import type {
  BlastRadiusReport,
  CascadeDirection,
  GroupCascadeRule,
  RuleEffect,
} from '../../../shared/membership/blastRadiusTypes';
import type { ClauseGroupMatch } from '../../../shared/rules/explainExpression';

/** One rule that reads an affected group, resolved for rendering. */
export interface CascadeLine {
  /** Okta rule id (`0pr…`). */
  readonly ruleId: string;
  /** The rule's display name. **Untrusted.** */
  readonly ruleName: string;
  /** Which way this edit turns the rule's test of the group. */
  readonly direction: CascadeDirection;
  /** How the condition named the group — drives the "matched by pattern" note. */
  readonly matchedBy: ClauseGroupMatch;
  /** The groups this rule assigns matched users into. **Untrusted.** */
  readonly targetGroupNames: readonly string[];
}

/**
 * The literal `match` kinds — a condition naming a group outright. Everything
 * else reaches the group through a pattern, where the link is not self-evident
 * on screen and the row says so.
 */
const LITERAL_MATCHES: ReadonlySet<ClauseGroupMatch> = new Set<ClauseGroupMatch>(['id', 'name']);

/**
 * Whether this rule reached the group through a pattern rather than naming it.
 *
 * @param line - The resolved cascade line.
 * @returns `true` for the three pattern forms, `false` for a literal id or name.
 */
export function isPatternMatch(line: CascadeLine): boolean {
  return !LITERAL_MATCHES.has(line.matchedBy);
}

/**
 * Resolve every cascade in a report, keyed by the affected group it belongs to.
 *
 * A cascade rule whose id is absent from `report.rules` is dropped. That cannot
 * happen — `rules` is the whole inventory the cascade was scanned from — but
 * dropping it beats rendering a raw `0pr…` id where a rule name belongs.
 *
 * @param report - The report to read. Any status; a non-`computed` one has no cascades.
 * @returns Affected group id → its cascade lines, in the engine's order. Groups
 *   with no cascade are absent, never present-and-empty: the scan under-reports
 *   by design, so an empty entry would invite a surface to render an absence the
 *   engine cannot back.
 */
export function cascadeLinesByGroupId(
  report: BlastRadiusReport,
): ReadonlyMap<string, readonly CascadeLine[]> {
  if (report.cascades.length === 0) return new Map();

  const byRuleId = new Map<string, RuleEffect>(report.rules.map((rule) => [rule.ruleId, rule]));
  const resolved = new Map<string, readonly CascadeLine[]>();

  for (const cascade of report.cascades) {
    const lines = cascade.rules
      .map((rule: GroupCascadeRule): CascadeLine | undefined => {
        const effect = byRuleId.get(rule.ruleId);
        if (!effect) return undefined;
        return {
          ruleId: rule.ruleId,
          ruleName: effect.ruleName,
          direction: rule.direction,
          matchedBy: rule.matchedBy,
          targetGroupNames: effect.targetGroupNames,
        };
      })
      .filter((line): line is CascadeLine => line !== undefined);

    if (lines.length > 0) resolved.set(cascade.groupId, lines);
  }

  return resolved;
}
