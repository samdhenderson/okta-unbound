/**
 * @module sidepanel/components/groups/detail/GroupDetailView
 * @description The Group Detail view pushed onto the Groups tab's view stack.
 *
 * Purpose-built for the one question an admin drills in with — *where do this
 * group's members come from, and what depends on it?* — so the sections are
 * ordered by how often each settles a real question: identity, membership source,
 * rules, app push, metadata.
 *
 * Rendered as a **sibling** of the (hidden, still-mounted) groups list rather than
 * in place of it, so the list's filters, selection, loaded window and per-row
 * expansion all survive the round trip — see
 * {@link sidepanel/hooks/useViewStack.useViewStack}.
 *
 * This is the container half: it owns the two read-only loads
 * ({@link sidepanel/hooks/useGroupSource.useGroupSource} for the rules that assign
 * into the group plus the gated member split, and
 * {@link sidepanel/hooks/useGroupRuleReferences.useGroupRuleReferences} for the
 * rules that merely reference it) and hands their state to pure sections. It never
 * mutates anything.
 */
import React, { useEffect } from 'react';
import GroupIdentitySection from './GroupIdentitySection';
import GroupMembershipSourceSection from './GroupMembershipSourceSection';
import GroupRulesSection from './GroupRulesSection';
import GroupPushSection from './GroupPushSection';
import GroupMetadataSection from './GroupMetadataSection';
import { useGroupSource } from '../../../hooks/useGroupSource';
import { useGroupRuleReferences } from '../../../hooks/useGroupRuleReferences';
import type { GroupSummary } from '../../../../shared/types';

/** Props for {@link GroupDetailView}. */
interface GroupDetailViewProps {
  /** The group to explain. Re-opens the loads when its identity changes. */
  group: GroupSummary;
  /** Connected Okta tab id; reads are disabled and the gate button greys out when null. */
  targetTabId: number | null;
  /** Okta org origin, enabling the Admin Console deep link. */
  oktaOrigin?: string;
  /** Deep-links a rule in the Rules tab (from either rule list, or a contribution). */
  onNavigateToRule?: (ruleId: string) => void;
}

/**
 * Read-only detail view for one group: identity, membership source, the two rule
 * relationships, app push, and metadata.
 */
const GroupDetailView: React.FC<GroupDetailViewProps> = ({
  group,
  targetTabId,
  oktaOrigin,
  onNavigateToRule,
}) => {
  const source = useGroupSource(targetTabId ?? undefined);
  const references = useGroupRuleReferences(group.id, targetTabId ?? undefined);

  // `open` is memoized on the (stable) API operation, so this runs once per group.
  const { open } = source;
  useEffect(() => {
    open(group);
  }, [open, group]);

  return (
    <div className="space-y-3" data-testid="group-detail-view">
      <GroupIdentitySection group={group} oktaOrigin={oktaOrigin} />

      <GroupMembershipSourceSection
        memberCount={group.memberCount}
        breakdown={source.breakdown}
        status={source.memberStatus}
        error={source.error}
        onAnalyze={source.analyzeMembers}
        canAnalyze={targetTabId !== null}
        onNavigateToRule={onNavigateToRule}
      />

      <GroupRulesSection
        assigningRules={source.feedingRules}
        assigningStatus={source.rulesStatus}
        assigningError={source.error}
        referencingRules={references.rules}
        referencingStatus={references.status}
        referencingError={references.error}
        onNavigateToRule={onNavigateToRule}
      />

      <GroupPushSection mappings={group.pushMappings} />

      <GroupMetadataSection
        groupId={group.id}
        created={group.created}
        lastUpdated={group.lastUpdated}
      />
    </div>
  );
};

export default GroupDetailView;
