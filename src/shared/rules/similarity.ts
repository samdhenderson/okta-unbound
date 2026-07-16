/**
 * @module shared/rules/similarity
 * @description Pure ordering of rules so similar ones sit next to each other.
 *
 * The Rules tab loads rules in Okta's arbitrary order, which scatters
 * near-duplicates across the list and makes them hard to review or consolidate.
 * This module clusters rules that are alike — same or similar match expression,
 * same attribute shape, or same/similar name — and produces an ordering that
 * keeps each cluster contiguous, tightest and largest clusters first, so a
 * reviewer sees "these three all key off department" as an adjacent block.
 *
 * It is deliberately separate from `consolidation.findMergeableRuleGroups`, which
 * only surfaces *identical*-expression rules that are provably safe to auto-merge.
 * Similarity here is fuzzier and for the human eye, not for a write.
 *
 * All pure — no I/O, deterministic for a given input.
 *
 * @see {@link sortRules}
 * @see {@link clusterSimilarRules}
 */

import type { FormattedRule } from '../types';

/** How the Rules tab orders its list. */
export type RuleSortMode = 'default' | 'name' | 'similarity';

/** Human-readable labels for each sort mode (for a picker). */
export const RULE_SORT_LABELS: Record<RuleSortMode, string> = {
  default: 'Default order',
  name: 'Name (A–Z)',
  similarity: 'Group similar',
};

/** Token-overlap (Jaccard) at or above which two expressions count as similar. */
export const EXPRESSION_SIMILARITY_THRESHOLD = 0.6;
/** Token-overlap (Jaccard) at or above which two names count as similar.
 * 0.5 pairs names sharing two of three tokens (e.g. "…Access West"/"…Access East"). */
export const NAME_SIMILARITY_THRESHOLD = 0.5;

/** Suffix the consolidation flow appends; stripped so a merged rule pairs with its source. */
const CONSOLIDATED_SUFFIX = /\s*\(consolidated\)\s*$/i;

/**
 * Normalize a rule name for comparison: drop the "(consolidated)" suffix, lower-case,
 * reduce punctuation to spaces, and collapse whitespace.
 */
export function normalizeRuleName(name: string): string {
  return name
    .replace(CONSOLIDATED_SUFFIX, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Normalize a match expression for equality: lower-case and collapse whitespace. */
export function normalizeRuleExpression(expression: string): string {
  return expression.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** The `user.<attr>` identifiers referenced in an expression, lower-cased and unique. */
function attributeSignature(expression: string): Set<string> {
  const matches = expression.toLowerCase().match(/user\.[a-z0-9_]+/g) ?? [];
  return new Set(matches);
}

/** Tokenize an expression into identifier/literal-ish tokens for overlap scoring. */
function expressionTokens(expression: string): Set<string> {
  return new Set(expression.toLowerCase().match(/[a-z0-9_.']+/g) ?? []);
}

/** The comparison signature derived once per rule. */
interface RuleSignature {
  normName: string;
  nameTokens: Set<string>;
  normExpression: string;
  exprTokens: Set<string>;
  attrs: Set<string>;
}

function signatureOf(rule: FormattedRule): RuleSignature {
  const expression = rule.conditionExpression ?? rule.condition ?? '';
  const normName = normalizeRuleName(rule.name);
  return {
    normName,
    nameTokens: new Set(normName ? normName.split(' ') : []),
    normExpression: normalizeRuleExpression(expression),
    exprTokens: expressionTokens(expression),
    attrs: attributeSignature(expression),
  };
}

/** Jaccard overlap of two sets: |A∩B| / |A∪B|. Empty-vs-anything is 0. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/** Whether two sets are equal (same members). */
function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size || a.size === 0) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

/**
 * Decide whether two rules are similar enough to sit together. True when they
 * share an (identical or high-overlap) expression, the same attribute shape, or
 * an (identical or high-overlap) name.
 */
export function rulesAreSimilar(a: FormattedRule, b: FormattedRule): boolean {
  return signaturesAreSimilar(signatureOf(a), signatureOf(b));
}

function signaturesAreSimilar(a: RuleSignature, b: RuleSignature): boolean {
  // Same or near-identical expression — the strongest signal.
  if (a.normExpression && a.normExpression === b.normExpression) return true;
  if (jaccard(a.exprTokens, b.exprTokens) >= EXPRESSION_SIMILARITY_THRESHOLD) return true;
  // Same attribute shape (e.g. both key off user.department, different values).
  if (setsEqual(a.attrs, b.attrs)) return true;
  // Same or near-identical name.
  if (a.normName && a.normName === b.normName) return true;
  if (jaccard(a.nameTokens, b.nameTokens) >= NAME_SIMILARITY_THRESHOLD) return true;
  return false;
}

/** A cluster of mutually/transitively similar rules, in a stable inner order. */
export interface SimilarRuleCluster {
  /** The rules in this cluster (1+). Singletons are clusters of size 1. */
  rules: FormattedRule[];
  /** True when the cluster has 2+ rules (i.e. something to compare). */
  hasSiblings: boolean;
}

/**
 * Cluster rules into connected components of similarity (union-find over all
 * pairs). Clusters are ordered multi-rule first, then by size descending, then by
 * a representative normalized name; within a cluster rules are ordered by
 * expression then name so identical rules are adjacent. O(n²) in the rule count,
 * which is fine for the tens-to-low-hundreds of rules a tenant has.
 *
 * @param rules - The rules to cluster (order-independent).
 * @returns The similarity clusters in display order.
 */
export function clusterSimilarRules(rules: FormattedRule[]): SimilarRuleCluster[] {
  const n = rules.length;
  const signatures = rules.map(signatureOf);

  // Union-find over rule indices.
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    while (parent[i] !== root) {
      const next = parent[i];
      parent[i] = root;
      i = next;
    }
    return root;
  };
  const union = (i: number, j: number) => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (signaturesAreSimilar(signatures[i], signatures[j])) union(i, j);
    }
  }

  // Bucket indices by component root.
  const components = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const bucket = components.get(root);
    if (bucket) bucket.push(i);
    else components.set(root, [i]);
  }

  const clusters: SimilarRuleCluster[] = [];
  for (const indices of components.values()) {
    // Inner order: identical/similar expressions adjacent, then name, then id.
    indices.sort((a, b) => {
      const sa = signatures[a];
      const sb = signatures[b];
      return (
        sa.normExpression.localeCompare(sb.normExpression) ||
        sa.normName.localeCompare(sb.normName) ||
        rules[a].id.localeCompare(rules[b].id)
      );
    });
    clusters.push({
      rules: indices.map((i) => rules[i]),
      hasSiblings: indices.length > 1,
    });
  }

  // Cluster order: something-to-compare first, larger first, then representative name.
  clusters.sort((a, b) => {
    if (a.hasSiblings !== b.hasSiblings) return a.hasSiblings ? -1 : 1;
    if (a.rules.length !== b.rules.length) return b.rules.length - a.rules.length;
    return normalizeRuleName(a.rules[0].name).localeCompare(normalizeRuleName(b.rules[0].name));
  });

  return clusters;
}

/**
 * Order rules for display according to a {@link RuleSortMode}.
 *
 * - `default` — preserve the incoming (load) order.
 * - `name` — alphabetical by name (case-insensitive), id as a stable tiebreak.
 * - `similarity` — group similar rules adjacently (see {@link clusterSimilarRules}).
 *
 * Always returns a new array; never mutates the input.
 *
 * @param rules - The rules to order.
 * @param mode - The sort mode.
 * @returns A new, ordered array.
 */
export function sortRules(rules: FormattedRule[], mode: RuleSortMode): FormattedRule[] {
  switch (mode) {
    case 'name':
      return [...rules].sort(
        (a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
          a.id.localeCompare(b.id),
      );
    case 'similarity':
      return clusterSimilarRules(rules).flatMap((cluster) => cluster.rules);
    case 'default':
    default:
      return [...rules];
  }
}
