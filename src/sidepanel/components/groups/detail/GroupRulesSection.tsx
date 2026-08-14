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
import { AlertMessage, Skeleton } from '../../shared';
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

/** The rules one relation lists, plus the states that stand in for them. */
interface RuleRelationBodyProps {
  /** Async status of this axis' load. */
  status: SourceStatus;
  /** Error message when the load failed. */
  error: string | null;
  /** What to say when the load succeeded and found nothing. */
  emptyMessage: string;
  /** The loaded rules for this axis. */
  rules: Array<{ id: string; name: string; status: string; detail?: string }>;
  /** Deep-links a rule in the Rules tab. */
  onNavigateToRule?: (ruleId: string) => void;
}

/**
 * One relation's async body: placeholder, error, empty message or the rows.
 *
 * Split out of {@link RuleRelationList} so each state is an early return rather
 * than a rung on a four-deep ternary.
 */
const RuleRelationBody: React.FC<RuleRelationBodyProps> = ({
  status,
  error,
  emptyMessage,
  rules,
  onNavigateToRule,
}) => {
  if (status === 'loading') {
    // `RuleLinkRow` is a `ListRow` at `compact` density, so the placeholder is the
    // matching one-line row at the default `md`, in the list's own `space-y-1.5`.
    return <Skeleton variant="lineRow" count={2} gap="space-y-1.5" label="Loading rules…" />;
  }

  if (status === 'error') {
    return <AlertMessage message={{ text: error || 'Failed to load rules.', type: 'danger' }} />;
  }

  // `idle` deliberately does not share the skeleton. A skeleton says "content is
  // on its way and will look like this"; `idle` means the load has not been
  // started, so it would claim work that is not in flight — the same overclaim
  // the spinner made. Falling through to `emptyMessage` would be worse still,
  // asserting a result ("no rule assigns users to this group") this axis has not
  // produced. Nothing is the honest render, and it is momentary in practice: both
  // hooks backing this section are `loading` from mount and only return to `idle`
  // when the detail view closes.
  if (status === 'idle') return null;

  if (rules.length === 0) {
    return <p className="text-sm text-neutral-500">{emptyMessage}</p>;
  }

  return (
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
  );
};

/** One headed rule list with its own async triad. */
const RuleRelationList: React.FC<
  RuleRelationBodyProps & {
    /** The relation this list states, as its sub-heading. */
    heading: string;
    /** One line explaining what the relation means. */
    hint: string;
  }
> = ({ heading, hint, ...body }) => (
  <div>
    <h3 className="text-xs font-medium text-neutral-600">
      {heading}
      {body.status === 'done' && ` (${body.rules.length})`}
    </h3>
    <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>
    <div className="mt-2">
      <RuleRelationBody {...body} />
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
