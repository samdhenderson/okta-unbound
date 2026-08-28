/**
 * @module sidepanel/components/users/MembershipRuleEvidence
 * @description One attributed rule inside a Groups-pane row's disclosure: the
 * rule, the profile attributes its condition reads, and the condition itself
 * explained clause by clause against the user.
 *
 * It deliberately carries **no caption**. The row's verdict badge already says
 * how much the attribution is worth, and repeating that phrase once per rule was
 * how this surface used to read — three hedges stacked down one row for a single
 * hedged answer.
 *
 * ## Security
 *
 * Rule names and condition text are untrusted, end-user-controllable Okta data.
 * They are rendered as escaped React text and never logged, and the condition is
 * read by the shared rule parser rather than by a regex or `eval` (ADR-0017).
 */
import React from 'react';
import type jsep from 'jsep';
import { Badge, EntityLink, Eyebrow } from '../shared';
import ClauseChecklist from '../groups/detail/ClauseChecklist';
import { parseRuleExpression, type RuleGroupContext } from '../../../shared/ruleEvaluator';
import type { MembershipRule, OktaUser } from '../../../shared/types';

/**
 * A rule's condition expression, whichever shape the rule arrived in — the same
 * two-source fallback the classifier uses
 * (`shared/utils/membershipAnalysis.conditionExpressionOf`, which is
 * module-private). The Users tab supplies a `FormattedRule`, which carries
 * `conditionExpression` and no `conditions` at all, so reading only
 * `conditions.expression.value` here rendered nothing on this surface.
 *
 * An empty result is *not* "no conditions, so everything passes": it is reported
 * as unevaluable, and {@link ClauseChecklist} says so.
 */
const conditionExpressionOf = (rule: MembershipRule): string =>
  rule.conditionExpression || rule.conditions?.expression?.value || '';

/** Recursion guard for the attribute walk — conditions are untrusted input. */
const MAX_WALK_DEPTH = 64;

/** Cap on the chips one rule card renders; a pathological condition cannot flood the row. */
const MAX_ATTRIBUTE_CHIPS = 12;

/** Whether an arbitrary node value from the AST is itself an expression node. */
function isExpressionNode(value: unknown): value is jsep.Expression {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

/**
 * Collect the `user.*` profile attributes a parsed condition reads.
 *
 * Walks the AST rather than pattern-matching the text. That is not fussiness:
 * `user.department == "user.title"` names **one** attribute, and any regex over
 * the expression — or over a clause's reconstructed `expressionText` — reports
 * two. The tree comes from `parseRuleExpression`, the same memoised parse the
 * evaluator and the clause explainer use, so no second parser exists to drift
 * and the chips cannot disagree with the condition rendered beneath them.
 *
 * @param node - The node to walk.
 * @param found - Accumulator, in first-appearance order.
 * @param depth - Current recursion depth.
 */
function collectUserAttributes(node: jsep.Expression, found: Set<string>, depth: number): void {
  if (depth > MAX_WALK_DEPTH || found.size >= MAX_ATTRIBUTE_CHIPS) return;

  if (node.type === 'MemberExpression') {
    const member = node as jsep.MemberExpression;
    const object = member.object;
    const property = member.property;
    if (
      !member.computed &&
      object.type === 'Identifier' &&
      (object as jsep.Identifier).name === 'user' &&
      property.type === 'Identifier'
    ) {
      found.add((property as jsep.Identifier).name);
      return;
    }
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isExpressionNode(item)) collectUserAttributes(item, found, depth + 1);
      }
    } else if (isExpressionNode(value)) {
      collectUserAttributes(value, found, depth + 1);
    }
  }
}

/**
 * The profile attributes one condition reads, in the order it reads them.
 *
 * An unparseable condition yields **no** chips rather than an empty "Reads"
 * row — the row would otherwise state as fact that the rule reads nothing, when
 * what actually happened is that it could not be read.
 *
 * @param expression - The rule's condition (untrusted Okta text).
 * @returns Attribute names without their `user.` prefix.
 */
function conditionAttributes(expression: string): string[] {
  const parsed = parseRuleExpression(expression);
  if (!parsed.ok) return [];

  const found = new Set<string>();
  try {
    collectUserAttributes(parsed.ast, found, 0);
  } catch {
    // Defensive, mirroring the evaluator: a pathologically nested expression can
    // exhaust the stack. Degrade to "no chips", never to a wrong list.
    return [];
  }
  return [...found];
}

/** Props for {@link MembershipRuleEvidence}. */
export interface RuleEvidenceProps {
  /** One rule this membership is attributed to. */
  rule: MembershipRule;
  /** The user to explain the rule's condition against; omitted, the raw condition is shown. */
  user?: OktaUser;
  /**
   * The same user's **complete** group list, so the checklist can resolve
   * `isMemberOfAnyGroup` / `isMemberOfGroup*` instead of reporting them as
   * "Cannot be determined". Threaded down from the pane that already holds the
   * memberships, never rebuilt here — see
   * {@link sidepanel/components/users/GroupMembershipsList}.
   *
   * **Absent is not empty.** Omitted, those clauses stay honestly unevaluated;
   * a partial list would report groups the user *is* in as clauses they failed
   * (ADR-0021).
   */
  groupContext?: RuleGroupContext;
}

/**
 * One attributed rule: a link to it, what its condition reads, and the condition.
 *
 * @param props - See {@link RuleEvidenceProps}.
 */
const MembershipRuleEvidence: React.FC<RuleEvidenceProps> = ({ rule, user, groupContext }) => {
  const expression = conditionExpressionOf(rule);
  const attributes = conditionAttributes(expression);

  return (
    <div className="rounded-md border border-neutral-200 bg-canvas p-(--sp-card)">
      <EntityLink type="rule" id={rule.id} name={rule.name} />

      {attributes.length > 0 && (
        <div className="mt-2">
          <Eyebrow className="mb-1 block">Reads</Eyebrow>
          <div className="flex flex-wrap gap-(--sp-inline)">
            {attributes.map((attribute) => (
              <Badge key={attribute} variant="neutral" className="font-mono">
                {attribute}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2">
        <Eyebrow className="mb-1 block">Condition</Eyebrow>
        {user ? (
          <ClauseChecklist expression={expression} user={user} groupContext={groupContext} />
        ) : (
          <code className="block overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-neutral-200 bg-white p-2 font-mono text-xs text-neutral-900">
            {expression || 'No condition expression'}
          </code>
        )}
      </div>
    </div>
  );
};

export default MembershipRuleEvidence;
