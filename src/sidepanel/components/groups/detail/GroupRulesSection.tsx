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
 */
import React from 'react';
import { AlertMessage, LoadingSpinner } from '../../shared';
import DetailSection from './DetailSection';
import RuleLinkRow from './RuleLinkRow';
import type { FeedingRule, SourceStatus } from '../../../hooks/useGroupSource';
import type { ReferencingRule } from '../../../hooks/useGroupRuleReferences';

/** A rule's ACTIVE/INACTIVE state, exactly as Okta returns it. */
const RuleStatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`px-2 py-0.5 rounded-md text-xs font-medium border ${
      status === 'ACTIVE'
        ? 'bg-success-light text-success-text border-success-light'
        : 'bg-neutral-50 text-neutral-600 border-neutral-200'
    }`}
  >
    {status}
  </span>
);

/** One headed rule list with its own async triad. */
const RuleRelationList: React.FC<{
  heading: string;
  hint: string;
  status: SourceStatus;
  error: string | null;
  emptyMessage: string;
  rules: Array<{ id: string; name: string; status: string; detail?: string }>;
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
        <ul className="space-y-1.5">
          {rules.map((rule) => (
            <li key={rule.id}>
              <RuleLinkRow
                name={rule.name}
                detail={rule.detail}
                trailing={<RuleStatusPill status={rule.status} />}
                onSelect={onNavigateToRule ? () => onNavigateToRule(rule.id) : undefined}
              />
            </li>
          ))}
        </ul>
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
  /** Deep-links a rule in the Rules tab. */
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
        rules={referencingRules.map((rule) => ({
          id: rule.id,
          name: rule.name,
          status: rule.status,
          detail: rule.conditionExpression,
        }))}
        onNavigateToRule={onNavigateToRule}
      />
    </div>
  </DetailSection>
);

export default GroupRulesSection;
