/**
 * @module shared/membership/groupContext
 * @description The one place a user's memberships become a {@link RuleGroupContext}.
 *
 * Four lines with a contract attached. Every surface that evaluates a rule
 * expression on a user's behalf — the blast-radius engine, the comparison's
 * access-cause classifier, and the rows built on top of them — has to hand
 * `ruleEvaluator` the same id/name pairs, or two panels end up answering
 * `isMemberOfGroup` differently about the same person. This module exists so
 * that mapping has exactly one implementation to read.
 *
 * @see {@link module:shared/ruleEvaluator} — what consumes the shape.
 */

import type { RuleGroupContext } from '../ruleEvaluator';
import type { GroupMembership } from '../types';

/**
 * The user's memberships in the shape the evaluator matches `isMemberOf*`
 * against.
 *
 * @param memberships - The user's **complete** membership list. `isMemberOf*` is
 *   two-valued over the list it is given (ADR-0021): a group missing from here is
 *   not "unknown", it is a confident "they are not in it". Pass the whole set or
 *   pass nothing.
 * @returns The id/name pairs the evaluator reads.
 */
export function groupContextOf(memberships: readonly GroupMembership[]): RuleGroupContext {
  return memberships.map((membership) => ({
    id: membership.group.id,
    name: membership.group.profile.name,
  }));
}
