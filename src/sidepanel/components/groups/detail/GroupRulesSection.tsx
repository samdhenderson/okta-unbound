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
 * navigated *away* to the Rules tab. So the one question this tab exists to
 * answer — "what does that rule actually say?" — could only be answered by
 * leaving it. They are {@link RuleCard} now, the same expandable card the Rules
 * tab itself renders, which discharges one of ADR-0030's outstanding migrations.
 *
 * It costs no request. `getGroupRulesForGroup` and `ensureGroupRulesLoaded`
 * already return `FormattedRule[]` — the exact shape the card takes — and both
 * hooks were copying four fields off each one and dropping the rest.
 *
 * `onNavigateToRule` survives as a **secondary** affordance inside the expanded
 * card rather than as the only way to see the rule. None of the card's write
 * verbs are wired here: this section cannot activate or deactivate a rule, so it
 * renders no control that would (ADR-0039).
 */
import React from 'react';
import { AlertMessage, DetailSection, LoadingSpinner } from '../../shared';
import RuleCard from '../../RuleCard';
import type { FeedingRule, SourceStatus } from '../../../hooks/useGroupSource';
import type { ReferencingRule } from '../../../hooks/useGroupRuleReferences';
import type { FormattedRule } from '../../../../shared/types';

/** One headed rule list with its own async triad. */
const RuleRelationList: React.FC<{
  heading: string;
  hint: string;
  status: SourceStatus;
  error: string | null;
  emptyMessage: string;
  rules: FormattedRule[];
  oktaOrigin?: string | null;
  onNavigateToRule?: (ruleId: string) => void;
}> = ({ heading, hint, status, error, emptyMessage, rules, oktaOrigin, onNavigateToRule }) => (
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
            /* No `onActivate`/`onDeactivate`/`onPreviewImpact`: this section
               wires none of them, so the card renders no control for them. */
            <RuleCard
              key={rule.id}
              rule={rule}
              oktaOrigin={oktaOrigin}
              onOpenInRulesTab={onNavigateToRule}
            />
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
  /** Deep-links a rule in the Rules tab, from inside its expanded card. */
  onNavigateToRule?: (ruleId: string) => void;
  /** Okta org origin for each card's "View in Okta" link. */
  oktaOrigin?: string | null;
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
  oktaOrigin,
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
        oktaOrigin={oktaOrigin}
        onNavigateToRule={onNavigateToRule}
      />

      <RuleRelationList
        heading="References this group in a condition"
        hint="These rules read this group's membership to decide some other group. Only references by group id are detected — a rule matching on group name is not listed."
        status={referencingStatus}
        error={referencingError}
        emptyMessage="No rule condition references this group by id."
        rules={referencingRules}
        oktaOrigin={oktaOrigin}
        onNavigateToRule={onNavigateToRule}
      />
    </div>
  </DetailSection>
);

export default GroupRulesSection;
