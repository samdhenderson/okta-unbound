/**
 * @module sidepanel/components/groups/detail/GroupDetailView
 * @description The Group Detail view pushed onto the Groups tab's view stack.
 *
 * Purpose-built for the one question an admin drills in with — *where do this
 * group's members come from, and what depends on it?* Below the action bar, a
 * `Tabs` shell (`variant="underline"`) splits the body into five panes, each
 * one tap away — no pane gated behind another: **Overview**
 * ({@link GroupOverviewPane}, verdict tiles that drill into the pane below
 * answering each), **Members** ({@link GroupMembersSection}, which folds the
 * membership-source readout into its own roster —
 * {@link GroupMembersSection}, stacked), **Access**
 * ({@link GroupAccessSection} + {@link GroupPushSection}, stacked),
 * **Rules** ({@link GroupRulesSection}), and **Health**
 * ({@link GroupInsightsPane} — attribute spread and drift cards, a
 * gated MFA-coverage scan, and the group's own reference facts folded into a
 * closed `CollapsibleSection`). `activeTab` is owned here (`useState`,
 * default `'overview'` — `'members'` when `autoAnalyze` is set; see that
 * prop's doc) — this is a page-local pane switch, not sub-navigation, so it
 * does not warrant `useViewStack` or a lifted hook.
 *
 * It opens on membership source rather than on an identity card because the tab's
 * `PageHeader` now describes the group itself (ADR-0032) — name, type and member count
 * live there, one scroll-pinned line above this view.
 *
 * Rendered as a **sibling** of the (hidden, still-mounted) groups list rather than
 * in place of it, so the list's filters, selection, loaded window and per-row
 * expansion all survive the round trip — see
 * {@link sidepanel/hooks/useViewStack.useViewStack}.
 *
 * This is the container half: it owns the read-only loads —
 * {@link sidepanel/hooks/useGroupSource.useGroupSource} for the rules that assign
 * into the group plus the gated member split,
 * {@link sidepanel/hooks/useGroupRuleReferences.useGroupRuleReferences} for the
 * rules that merely reference it,
 * {@link sidepanel/hooks/useGroupAccessGrants.useGroupAccessGrants} for what
 * membership actually grants (assigned apps, admin roles), and
 * {@link sidepanel/hooks/useMemberMfaScan.useMemberMfaScan} for the Insights tab's
 * opt-in MFA-coverage scan (scoped to the same roster the Members tab's gate
 * loads) — and hands their state to pure sections/panes.
 *
 * It also owns the view's mutating surfaces: a page-level "Export members"
 * action and an "Add" action in {@link GroupActionBar} (ADR-0030, ADR-0039),
 * and per-member add/remove in {@link GroupMembersSection}, whose state lives
 * in {@link module:sidepanel/components/groups/detail/useGroupMembersSection.useGroupMembersSection}.
 * The members section piggybacks on `useGroupSource`'s gated member read rather
 * than fetching a second time — see that hook's module doc.
 *
 * The strip's third mutating surface is its **disclosure tier**: *Create feeding
 * rule*, the rung's one verb with no symmetric undo, whose state lives in
 * {@link module:sidepanel/hooks/useCreateFeedingRule.useCreateFeedingRule} and
 * whose confirm is {@link CreateFeedingRuleModal}. It is wired to the same
 * `onNavigateToRule` the Rules pane uses, so the created (inactive) rule is one
 * press from the tab that activates it.
 *
 * The action bar's "Add" button opens {@link AddGroupMemberModal}, backed by
 * its own {@link module:sidepanel/hooks/useAddGroupMember.useAddGroupMember}
 * instance — the only add path now that `GroupMembersSection`'s inline add
 * field has been removed (step 3 of the Group Detail rework). This view's
 * `onAdded` is wired straight to `membersSection.onMemberAdded`, the
 * write-back callback `useGroupMembersSection` exposes for exactly this
 * purpose, so there is only ever one copy of the cache-write/`resummarize`
 * logic even though the modal's mutation state lives in a separate hook
 * instance from the roster it writes into.
 */
import React, { useMemo, useState } from 'react';
import GroupOverviewPane from './GroupOverviewPane';
import GroupMembersSection from './GroupMembersSection';
import GroupAccessSection from './GroupAccessSection';
import GroupRulesSection from './GroupRulesSection';
import GroupPushSection from './GroupPushSection';
import GroupInsightsPane from './GroupInsightsPane';
import GroupActionBar from './GroupActionBar';
import AddGroupMemberModal from './AddGroupMemberModal';
import CompareGroupModal from './CompareGroupModal';
import CreateFeedingRuleModal from './CreateFeedingRuleModal';
import GroupComparisonModal from '../GroupComparisonModal';
import { Tabs, type TabItem } from '../../shared';
import { useGroupSource } from '../../../hooks/useGroupSource';
import { useOktaApi } from '../../../hooks/useOktaApi';
import { useOwedLoad } from '../../../hooks/useOwedLoad';
import { useGroupRuleReferences } from '../../../hooks/useGroupRuleReferences';
import { useGroupAccessGrants } from '../../../hooks/useGroupAccessGrants';
import { useGroupComparison } from '../../../hooks/useGroupComparison';
import { useMemberMfaScan } from '../../../hooks/useMemberMfaScan';
import { useGroupMembersSection } from './useGroupMembersSection';
import { useAddGroupMember } from '../../../hooks/useAddGroupMember';
import { useCreateFeedingRule } from '../../../hooks/useCreateFeedingRule';
import { useWorkingSetEntry } from '../../../hooks/useWorkingSetEntry';
import { OKTA_PAGE_SIZE } from '../../../../shared/utils/oktaPagination';
import type { GroupSummary } from '../../../../shared/types';

/** Which tabbed pane of the body (below the action bar) is on screen. */
type GroupDetailTab = 'overview' | 'members' | 'access' | 'rules' | 'insights';

/**
 * 5 pages of the group-members walk — the auto-load/manual-gate boundary for
 * the Members roster and its source-split analysis. A group at or under this
 * auto-populates on open, matching how Access and Rules already load for
 * free; a larger group keeps the explicit Analyze/Load button, since its walk
 * would cost more than the "cheap, 1-5 request" budget the rest of the page
 * auto-loads within.
 */
const AUTO_LOAD_MEMBER_CAP = OKTA_PAGE_SIZE * 5;

/** Tab strip for the body — every pane one tap away, none gated behind another. */
const GROUP_DETAIL_TABS: TabItem[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'members', label: 'Members' },
  { key: 'access', label: 'Access' },
  { key: 'rules', label: 'Rules' },
  { key: 'insights', label: 'Insights' },
];

/** Props for {@link GroupDetailView}. */
interface GroupDetailViewProps {
  /** The group to explain. Re-opens the loads when its identity changes. */
  group: GroupSummary;
  /** Connected Okta tab id; reads are disabled and the gate button greys out when null. */
  targetTabId: number | null;
  /**
   * Okta org origin, from the connected tab. Every "View in Okta" affordance on
   * this page is built from it plus a validated entity id; without it the links
   * are absent rather than broken.
   */
  oktaOrigin?: string | null;
  /** Deep-links a rule in the Rules tab (from either rule list, or a contribution). */
  onNavigateToRule?: (ruleId: string) => void;
  /**
   * Runs the gated member-source analysis as soon as the view opens, once per
   * group. Set when the push came from a list row's "Analyze member source"
   * action — the user already asked for the analysis, so re-asking here would be
   * a pointless second click. Never set by a plain drill-in.
   *
   * Also picks the tab shell's initial pane: a plain drill-in opens on
   * `'overview'` (the landing tab), but `autoAnalyze` opens straight on
   * `'members'` instead, so the analysis this prop just triggered lands where
   * its result is actually visible rather than one tap away.
   */
  autoAnalyze?: boolean;
  /**
   * Whether the Groups tab is the visible top-level tab. The view stays mounted
   * while another tab is selected, so its two read-only loads are deferred rather
   * than issued from a hidden tab. Defaults to `true`.
   */
  isActive?: boolean;
  /**
   * Opens the Export tab pre-scoped to this group's members (the page-level
   * "Export members" action). Forwarded as-is from `GroupsTab`, which `App.tsx`
   * wires; per ADR-0039, omitting it **omits the action from
   * {@link GroupActionBar} entirely** rather than shipping it disabled, which is
   * why it stays optional for stories and tests.
   */
  onExportGroup?: (groupId: string, groupName: string) => void;
}

/**
 * Detail view for one group: a landing Overview of verdict tiles, membership
 * source and a member roster with add/remove (Members tab), what membership
 * grants plus app push (Access tab), the two rule relationships (Rules tab),
 * and attribute health, a gated MFA scan, and the group's own reference facts
 * (Insights tab). Its identity is the header's job. Export and membership
 * writes (the action bar's Add-member modal, and per-member add/remove) are
 * its only mutations; everything else here still just reads — including the
 * group comparison, which reuses the Groups list's `GroupComparisonModal`
 * behind a picker for the second operand ({@link useGroupComparison}).
 */
const GroupDetailView: React.FC<GroupDetailViewProps> = ({
  group,
  targetTabId,
  oktaOrigin,
  onNavigateToRule,
  autoAnalyze = false,
  isActive = true,
  onExportGroup,
}) => {
  // Page-local pane switch, not sub-navigation — no `useViewStack`, no lifted
  // hook. A plain drill-in lands on the Overview tiles; `autoAnalyze` skips
  // straight to Members, where the analysis it triggers actually renders (see
  // that prop's doc). The initializer runs once, so a later prop change does
  // not retroactively move a reader who is already looking at a tab.
  const [activeTab, setActiveTab] = useState<GroupDetailTab>(autoAnalyze ? 'members' : 'overview');

  // Two lines, and the reason they are *here* rather than in the navigation
  // machinery: this rung is the only surface that knows all four facts at once —
  // which kind, which id, what it is called, and which pane is open. Gated on
  // `isActive` because the rung stays mounted behind another top-level tab
  // (ADR-0018) and a hidden one must not keep re-asserting itself as the most
  // recent thing the reader looked at.
  useWorkingSetEntry({
    origin: oktaOrigin,
    kind: 'group',
    id: group.id,
    name: group.name,
    pane: GROUP_DETAIL_TABS.find((tab) => tab.key === activeTab)?.label,
    enabled: isActive,
  });

  const source = useGroupSource(targetTabId ?? undefined);
  const references = useGroupRuleReferences(group.id, targetTabId ?? undefined, isActive);
  const accessGrants = useGroupAccessGrants(group.id, targetTabId ?? undefined, isActive);
  // `resummarize` keeps the membership-source meter honest after a write. The
  // cache invalidation that rides every membership write fixes the *next* read;
  // the meter above this section is React state, so without this it would keep
  // showing pre-mutation counts for as long as the view stayed open.
  const membersSection = useGroupMembersSection(
    group,
    targetTabId,
    source.memberStatus,
    source.resummarize,
  );

  // The opt-in MFA-coverage scan, shared by the Insights tab's coverage card and the
  // Members tab's explorer — one scan, one cache entry, whichever tab triggers it.
  // Scoped to the exact roster the Members tab's gate loads
  // (`membersSection.members`) rather than fetching its own — `[]` before that
  // roster exists is inert, since neither surface wires a trigger until the roster
  // has loaded. Owned here, not inside a pane, so it stays a sibling of every
  // other read-only load this container composes, and so the two tabs cannot each
  // start their own.
  const mfaScan = useMemberMfaScan({
    groupId: group.id,
    members: membersSection.members ?? [],
    targetTabId: targetTabId ?? undefined,
  });

  // The Members tab's per-row ADR-0031 proof: one call about one membership, from
  // a click on an already-open row. This view holds no other `useOktaApi`
  // instance, and this one issues nothing on mount — `useOktaApi` only hands back
  // operations, and every operation here is behind a click.
  //
  // Most rows never offer it: the roster read already carries Okta's own
  // attribution via `expand=group-rules` (ADR-0020), so the action appears only
  // where that embed left the answer unknown.
  const { getMembershipRuleProof, compareGroups } = useOktaApi({
    targetTabId: targetTabId ?? null,
  });
  const proveMemberSource = useMemo(
    () =>
      targetTabId !== null
        ? (userId: string) => getMembershipRuleProof(group.id, userId)
        : undefined,
    [targetTabId, group.id, getMembershipRuleProof],
  );

  // The action bar's Add-member modal — a second, independent `useAddGroupMember`
  // instance from the one `useGroupMembersSection` composes internally for its
  // own inline field. `onAdded` routes through `membersSection.onMemberAdded` so
  // both instances write into the exact same cache entry/`cacheTick` rather than
  // this view holding a second copy of that logic — see the module doc.
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const addMember = useAddGroupMember({
    targetTabId,
    group,
    members: membersSection.members,
    onResult: (result) => setAddMemberError(result.text),
    onAdded: membersSection.onMemberAdded,
    enabled: isActive,
  });
  const openAddMemberModal = (): void => {
    setAddMemberError(null);
    addMember.openModal();
  };
  const closeAddMemberModal = (): void => {
    setAddMemberError(null);
    addMember.closeModal();
  };

  // The strip's disclosure tier. The write is one POST that already exists
  // (`ruleWrites.createGroupRule`), and Okta creates the rule INACTIVE, so this
  // hook grants nothing on its own — see its module doc for why the verb is
  // behind a confirm regardless, and for what it declines to predict.
  const createFeedingRule = useCreateFeedingRule({ targetTabId, group });

  // Compare with another group. Two dialogs in sequence, deliberately: the picker
  // supplies the second operand, and the comparison itself is the same
  // `GroupComparisonModal` the Groups list opens from a multi-select — this rung
  // owns no second implementation of overlap analysis, only the missing half of
  // its input. See `useGroupComparison` for why the picker uses the live search.
  const comparison = useGroupComparison({ group, targetTabId, enabled: isActive });

  // `open` is memoized on the (stable) API operation, so this runs once per group.
  // While the Groups tab is hidden the open is *owed* rather than run: it reaches
  // Okta, and re-running it on every return to the tab would also discard a member
  // analysis the admin already paid for. The two effects are split so only a real
  // input change (`open`/`group`) arms it — re-showing the tab alone does not.
  const { open, analyzeMembers } = source;
  useOwedLoad(group.id, isActive, () => {
    open(group);
  });

  // Wait for `open` to land before auto-analyzing (`analyzeMembers` no-ops until
  // the hook holds the group), and latch on the id so it fires exactly once.
  // Same latch, a different readiness condition: not "is the tab visible" but "has
  // `open` landed" — `analyzeMembers` no-ops until the hook holds the group.
  //
  // Fires whenever the group's roster is cheap enough to auto-load
  // (`AUTO_LOAD_MEMBER_CAP`), not just when a list row explicitly asked for it
  // (`autoAnalyze`) — the same "populate what's cheap, gate what isn't"
  // tiering `useGroupAccessGrants`/`useGroupRuleReferences` already apply.
  // Not gated on `isActive` directly: `openedGroupId` only becomes truthy
  // once `open()` has actually run, and `open()`'s own owed-load already
  // carries the `isActive` gate above — so this is transitively
  // tab-visibility-safe (ADR-0018) without repeating that check here.
  const openedGroupId = source.group?.id;
  const withinAutoLoadBudget = group.memberCount <= AUTO_LOAD_MEMBER_CAP;
  useOwedLoad(group.id, (autoAnalyze || withinAutoLoadBudget) && openedGroupId === group.id, () => {
    analyzeMembers();
  });

  return (
    // A fragment, not just the stack `div`: the Add-member modal below is a
    // page-level overlay, mounted once and controlled by `addMember.isOpen`
    // (the pattern `UsersTab.tsx` uses for `AddToGroupModal`) rather than a
    // child of the `space-y-6` rhythm it has nothing to do with.
    <>
      {/*
        `space-y-(--sp-rung)` (ADR-0048) — the gap-between-stacked-cards role. It
        was `space-y-3`, which is the card-*interior* gap and not the rung's step
        — the strip is a card the width of the column like every section under
        it, so it takes the same rhythm as the rest of the rung rather than a
        tighter one of its own.
      */}
      <div className="space-y-(--sp-rung)" data-testid="group-detail-view">
        <GroupActionBar
          group={group}
          targetTabId={targetTabId}
          onExportGroup={onExportGroup}
          onAddMember={openAddMemberModal}
          onCompare={comparison.openPicker}
          onCreateFeedingRule={createFeedingRule.open}
        />

        <div>
          <Tabs
            tabs={GROUP_DETAIL_TABS}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as GroupDetailTab)}
            variant="underline"
            ariaLabel="Group detail sections"
          />

          <div className="mt-(--sp-rung)">
            {activeTab === 'overview' && (
              <GroupOverviewPane
                group={group}
                breakdown={source.breakdown}
                memberStatus={source.memberStatus}
                feedingRulesCount={source.feedingRules.length}
                rulesStatus={source.rulesStatus}
                appsCount={accessGrants.apps.length}
                appsStatus={accessGrants.appsStatus}
                rolesCount={accessGrants.roles.length}
                rolesStatus={accessGrants.rolesStatus}
                referencingRulesCount={references.rules.length}
                referencingStatus={references.status}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'members' && (
              <div role="tabpanel" aria-label="Members">
                <GroupMembersSection
                  oktaOrigin={oktaOrigin}
                  groupType={group.type}
                  memberCount={group.memberCount}
                  members={membersSection.members}
                  status={source.memberStatus}
                  error={source.error}
                  onAnalyze={source.analyzeMembers}
                  canAnalyze={targetTabId !== null}
                  breakdown={source.breakdown}
                  memberSourceIndex={source.memberSourceIndex}
                  onNavigateToRule={onNavigateToRule}
                  onProveMemberSource={proveMemberSource}
                  mfaResults={mfaScan.mfaResults}
                  scanStatus={mfaScan.scanStatus}
                  onRunScan={mfaScan.runScan}
                  onRequestConfirm={mfaScan.requestConfirm}
                  onCancelConfirm={mfaScan.cancelConfirm}
                  removeTarget={membersSection.removeTarget}
                  onRequestRemove={membersSection.requestRemove}
                  onCancelRemove={membersSection.cancelRemove}
                  onConfirmRemove={membersSection.confirmRemove}
                  removeStatus={membersSection.removeStatus}
                  removeError={membersSection.removeError}
                />
              </div>
            )}

            {activeTab === 'access' && (
              <div className="space-y-(--sp-rung)" role="tabpanel" aria-label="Access">
                <GroupAccessSection
                  oktaOrigin={oktaOrigin}
                  apps={accessGrants.apps}
                  appsStatus={accessGrants.appsStatus}
                  appsError={accessGrants.appsError}
                  roles={accessGrants.roles}
                  rolesStatus={accessGrants.rolesStatus}
                  pushMappings={group.pushMappings}
                />

                <GroupPushSection mappings={group.pushMappings} />
              </div>
            )}

            {activeTab === 'rules' && (
              <div role="tabpanel" aria-label="Rules">
                <GroupRulesSection
                  assigningRules={source.feedingRules}
                  assigningStatus={source.rulesStatus}
                  assigningError={source.error}
                  referencingRules={references.rules}
                  referencingStatus={references.status}
                  referencingError={references.error}
                  onNavigateToRule={onNavigateToRule}
                />
              </div>
            )}

            {activeTab === 'insights' && (
              <div role="tabpanel" aria-label="Insights">
                <GroupInsightsPane
                  groupId={group.id}
                  memberCount={group.memberCount}
                  members={membersSection.members}
                  memberStatus={source.memberStatus}
                  error={source.error}
                  onAnalyzeMembers={source.analyzeMembers}
                  canAnalyze={targetTabId !== null}
                  feedingRules={source.feedingRules}
                  onNavigateToRule={onNavigateToRule}
                  mfaResults={mfaScan.mfaResults}
                  scanStatus={mfaScan.scanStatus}
                  onRunScan={mfaScan.runScan}
                  onRequestConfirm={mfaScan.requestConfirm}
                  onCancelConfirm={mfaScan.cancelConfirm}
                  description={group.description}
                  created={group.created}
                  lastUpdated={group.lastUpdated}
                  lastMembershipUpdated={group.lastMembershipUpdated}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <AddGroupMemberModal
        isOpen={addMember.isOpen}
        groupName={group.name}
        addQuery={addMember.addQuery}
        onAddQueryChange={addMember.setAddQuery}
        addResults={addMember.addResults}
        isSearchingToAdd={addMember.isSearchingToAdd}
        addSearchError={addMember.addSearchError}
        selectedUser={addMember.selectedUser}
        onSelectUser={addMember.selectUser}
        onClearSelectedUser={addMember.clearSelectedUser}
        isAddingMember={addMember.isAddingMember}
        onClose={closeAddMemberModal}
        onConfirm={addMember.confirmAddMember}
        addMemberError={addMemberError}
      />

      <CompareGroupModal
        isOpen={comparison.isPicking}
        group={group}
        query={comparison.query}
        onQueryChange={comparison.setQuery}
        results={comparison.results}
        isSearching={comparison.isSearching}
        searchError={comparison.searchError}
        selected={comparison.selected}
        onSelect={comparison.select}
        onClearSelected={comparison.clearSelected}
        canSearch={targetTabId !== null}
        onClose={comparison.closePicker}
        onConfirm={comparison.confirm}
      />

      <CreateFeedingRuleModal
        isOpen={createFeedingRule.isOpen}
        groupName={group.name}
        name={createFeedingRule.name}
        onNameChange={createFeedingRule.setName}
        nameError={createFeedingRule.nameError}
        expression={createFeedingRule.expression}
        onExpressionChange={createFeedingRule.setExpression}
        expressionNotice={createFeedingRule.expressionNotice}
        canSubmit={createFeedingRule.canSubmit}
        isCreating={createFeedingRule.isCreating}
        error={createFeedingRule.error}
        createdRuleName={createFeedingRule.createdRuleName}
        createdRuleId={createFeedingRule.createdRuleId}
        onClose={createFeedingRule.close}
        onConfirm={createFeedingRule.confirm}
        onNavigateToRule={onNavigateToRule}
      />

      <GroupComparisonModal
        isOpen={comparison.comparedWith !== null}
        onClose={comparison.closeComparison}
        groups={comparison.comparedWith ? [group, comparison.comparedWith] : []}
        compareGroups={compareGroups}
        memberCache={comparison.memberCache}
      />
    </>
  );
};

export default GroupDetailView;
