/**
 * @module sidepanel/components/groups/detail/GroupRulesSection
 * @description The two rule relationships a group can have, listed separately.
 *
 * A rule either **assigns members into** the group (`assignUserToGroups`) or
 * **consults** it in its condition (`isMemberOfAnyGroup("…")`). Those are opposite
 * facts — one populates the group, the other reads it — and the groups-list badge
 * conflated them by summing the two counts. This section never does: two headed
 * lists, each with its own loading / empty / error state.
 *
 * Presentational; the caller owns
 * {@link sidepanel/hooks/useGroupSource.useGroupSource} and
 * {@link sidepanel/hooks/useGroupRuleReferences.useGroupRuleReferences}.
 *
 * ## A rule you can read, not a link to one
 *
 * Both lists were `RuleLinkRow`s: a name, a status pill, and a click that
 * navigated *away* to the Rules tab. They are {@link RuleCard} now, the same row the
 * Rules tab itself renders, which discharged one of ADR-0030's outstanding migrations.
 *
 * It costs no request. `getGroupRulesForGroup` and `ensureGroupRulesLoaded`
 * already return `FormattedRule[]` — the exact shape the card takes — and both
 * hooks were copying four fields off each one and dropping the rest.
 *
 * ## Where the rule's body went
 *
 * The card used to carry a disclosure holding the condition expression, the attributes
 * and the target groups, so "what does that rule actually say?" could be answered without
 * leaving this tab. That body is a **rule detail rung** on the Rules tab now, with its own
 * `ActionBar` — more than the disclosure ever held, and it exists because a disclosure was
 * the wrong home for four write verbs (ADR-0030 §2, ADR-0039).
 *
 * So this section is back to being a set of links out — but the link lands differently.
 * `onNavigateToRule` used to deposit you on a rules *list* scrolled to a collapsed card;
 * it opens the rule's rung directly now. The row still carries the facts you scan for —
 * name, status, and the condition in its human-readable form — and the row itself is the
 * jump, rather than a secondary control buried inside a disclosure.
 *
 * None of the card's write verbs are wired here — this section cannot activate or
 * deactivate a rule, and since the verbs moved to the rung there is no control here that
 * could (ADR-0039).
 *
 * ## The one question, answered in place (I-031, decided)
 *
 * Losing the disclosure meant "what does that rule actually say?" cost a tab change, and
 * the reader lost their place in the group they were studying. The decision is a
 * **read-only `When` line under each row**, printing the rule's condition expression
 * through the shared {@link sidepanel/components/shared/RuleExpressionText} — the same
 * renderer the rung uses, reused rather than copied, so group ids read as named badges
 * here too. It is a line of code, not prose: the answer is meant to be *seen*, not
 * explained.
 *
 * Two alternatives were rejected and are named here so the question does not re-open.
 * **Accept it and document the deep link** was cheapest but left the trade unpaid — the
 * answer stayed one navigation away. **Pushing the rule's rung onto the group stack**
 * would have dragged the rung's four write verbs onto a surface that deliberately wires
 * none, so it needed a read-only mode for `RuleDetailView` to be safe (ADR-0039). The
 * inline line needs neither: it renders no control of its own, and the deep link to the
 * full rung stays exactly as it was.
 */
import React, { useMemo } from 'react';
import { AlertMessage, DetailSection, LoadingSpinner, RuleExpressionText } from '../../shared';
import RuleCard from '../../RuleCard';
import type { FeedingRule, SourceStatus } from '../../../hooks/useGroupSource';
import type { ReferencingRule } from '../../../hooks/useGroupRuleReferences';
import type { FormattedRule } from '../../../../shared/types';

/**
 * The rule's condition, stated under its row and readable without a navigation.
 *
 * Read-only by construction: a label, the expression, and nothing pressable except the
 * group badges {@link RuleExpressionText} already resolves. It wraps rather than scrolls
 * — a horizontal scroller in a side panel this narrow hides the end of the very line the
 * block exists to show.
 */
const RuleConditionLine: React.FC<{ rule: FormattedRule }> = ({ rule }) => {
  const names = rule.allGroupNamesMap;
  /*
    The resolver is derived from the names the caller already holds — this component
    fetches nothing, and an id with no known name stays verbatim in the expression.
  */
  const resolveGroupName = useMemo(
    () => (names ? (groupId: string) => names[groupId] : undefined),
    [names],
  );

  const expression = rule.conditionExpression || rule.condition;
  if (!expression) return null;

  return (
    <div className="mt-1 flex items-baseline gap-(--sp-inline) rounded-md border border-neutral-200 bg-neutral-50 px-(--sp-inline) py-1.5">
      <span className="shrink-0 text-xs font-medium text-neutral-500">When</span>
      <RuleExpressionText
        text={expression}
        resolveGroupName={resolveGroupName}
        className="min-w-0 flex-1 font-mono text-xs whitespace-pre-wrap text-neutral-900"
      />
    </div>
  );
};

/** One headed rule list with its own async triad. */
const RuleRelationList: React.FC<{
  heading: string;
  hint: string;
  status: SourceStatus;
  error: string | null;
  emptyMessage: string;
  rules: FormattedRule[];
  onNavigateToRule?: (ruleId: string) => void;
}> = ({ heading, hint, status, error, emptyMessage, rules, onNavigateToRule }) => (
  <div>
    <h3 className="text-xs font-medium text-neutral-600">
      {heading}
      {status === 'done' && ` (${rules.length})`}
    </h3>
    <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>
    <div className="mt-2">
      {status === 'loading' || status === 'idle' ? (
        <LoadingSpinner size="sm" message="Loading rules…" centered />
      ) : status === 'error' ? (
        <AlertMessage message={{ text: error || 'Failed to load rules.', type: 'danger' }} />
      ) : rules.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id}>
              {/* `onOpenInRulesTab`, never `onOpenRule`: this tab's view stack is showing
                  a *group*, so it has no rule rung of its own to push. With neither handler
                  the row is inert by design — the same "no control without a handler"
                  discipline the card applied to its writes (ADR-0039). */}
              <RuleCard rule={rule} onOpenInRulesTab={onNavigateToRule} />
              {/* Outside the row, never inside it: the row is covered by a stretched
                  button, and a badge under that overlay would be unreachable. */}
              <RuleConditionLine rule={rule} />
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

/** Props for {@link GroupRulesSection}. */
interface GroupRulesSectionProps {
  /** Rules whose `assignUserToGroups` targets this group. */
  assigningRules: FeedingRule[];
  /** Status of the assigning-rules load. */
  assigningStatus: SourceStatus;
  /** Error message when the assigning-rules load failed. */
  assigningError: string | null;
  /** Rules whose condition expression names this group by id. */
  referencingRules: ReferencingRule[];
  /** Status of the referencing-rules load. */
  referencingStatus: SourceStatus;
  /** Error message when the referencing-rules load failed. */
  referencingError: string | null;
  /** Opens a rule's detail rung on the Rules tab. Pressing a row is the jump. */
  onNavigateToRule?: (ruleId: string) => void;
}

/**
 * Renders the two rule relationships as separate lists: rules that assign into
 * the group, and rules that merely reference it in a condition.
 */
const GroupRulesSection: React.FC<GroupRulesSectionProps> = ({
  assigningRules,
  assigningStatus,
  assigningError,
  referencingRules,
  referencingStatus,
  referencingError,
  onNavigateToRule,
}) => (
  <DetailSection title="Rules">
    <div className="space-y-4">
      <RuleRelationList
        heading="Assigns members into this group"
        hint="These rules add users here — the group's automated intake."
        status={assigningStatus}
        error={assigningError}
        emptyMessage="No rule assigns users to this group. Members are added manually or by app push."
        rules={assigningRules}
        onNavigateToRule={onNavigateToRule}
      />

      <RuleRelationList
        heading="References this group in a condition"
        hint="These rules read this group's membership to decide some other group. Only references by group id are detected — a rule matching on group name is not listed."
        status={referencingStatus}
        error={referencingError}
        emptyMessage="No rule condition references this group by id."
        rules={referencingRules}
        onNavigateToRule={onNavigateToRule}
      />
    </div>
  </DetailSection>
);

export default GroupRulesSection;
