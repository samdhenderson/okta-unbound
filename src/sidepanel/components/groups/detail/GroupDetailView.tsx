/**
 * @module sidepanel/components/groups/detail/GroupDetailView
 * @description The Group Detail view pushed onto the Groups tab's view stack.
 *
 * Purpose-built for the one question an admin drills in with — *where do this
 * group's members come from, and what depends on it?* Below the action bar, a
 * `Tabs` shell (`variant="underline"`) splits the body into three panes, each
 * one tap away — no pane gated behind another: **Members**
 * ({@link GroupMembershipSourceSection} + {@link GroupMembersSection}, stacked),
 * **Access** ({@link GroupAccessSection} + {@link GroupPushSection}, stacked)
 * and **Rules** ({@link GroupRulesSection}). `activeTab` is owned here
 * (`useState`, default `'members'`) — this is a page-local pane switch, not
 * sub-navigation, so it does not warrant `useViewStack` or a lifted hook.
 * {@link GroupMetadataSection} — the group's own reference facts — stays
 * outside the tab card, below it in its original position; it is not yet
 * folded into a tab (a later step of the Group Detail rework does that).
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
 * rules that merely reference it, and
 * {@link sidepanel/hooks/useGroupAccessGrants.useGroupAccessGrants} for what
 * membership actually grants (assigned apps, admin roles) — and hands their state
 * to pure sections.
 *
 * It also owns the view's mutating surfaces: a page-level "Export members"
 * action and an "Add" action in {@link GroupActionBar} (ADR-0030, ADR-0039),
 * and per-member add/remove in {@link GroupMembersSection}, whose state lives
 * in {@link module:sidepanel/components/groups/detail/useGroupMembersSection.useGroupMembersSection}.
 * The members section piggybacks on `useGroupSource`'s gated member read rather
 * than fetching a second time — see that hook's module doc.
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
import React, { useState } from 'react';
import GroupMembershipSourceSection from './GroupMembershipSourceSection';
import GroupMembersSection from './GroupMembersSection';
import GroupAccessSection from './GroupAccessSection';
import GroupRulesSection from './GroupRulesSection';
import GroupPushSection from './GroupPushSection';
import GroupMetadataSection from './GroupMetadataSection';
import GroupActionBar from './GroupActionBar';
import AddGroupMemberModal from './AddGroupMemberModal';
import { Tabs, type TabItem } from '../../shared';
import { useGroupSource } from '../../../hooks/useGroupSource';
import { useOwedLoad } from '../../../hooks/useOwedLoad';
import { useGroupRuleReferences } from '../../../hooks/useGroupRuleReferences';
import { useGroupAccessGrants } from '../../../hooks/useGroupAccessGrants';
import { useGroupMembersSection } from './useGroupMembersSection';
import { useAddGroupMember } from '../../../hooks/useAddGroupMember';
import type { GroupSummary } from '../../../../shared/types';

/** Which tabbed pane of the body (below the action bar) is on screen. */
type GroupDetailTab = 'members' | 'access' | 'rules';

/** Tab strip for the body — every pane one tap away, none gated behind another. */
const GROUP_DETAIL_TABS: TabItem[] = [
  { key: 'members', label: 'Members' },
  { key: 'access', label: 'Access' },
  { key: 'rules', label: 'Rules' },
];

/** Props for {@link GroupDetailView}. */
interface GroupDetailViewProps {
  /** The group to explain. Re-opens the loads when its identity changes. */
  group: GroupSummary;
  /** Connected Okta tab id; reads are disabled and the gate button greys out when null. */
  targetTabId: number | null;
  /** Deep-links a rule in the Rules tab (from either rule list, or a contribution). */
  onNavigateToRule?: (ruleId: string) => void;
  /**
   * Runs the gated member-source analysis as soon as the view opens, once per
   * group. Set when the push came from a list row's "Analyze member source"
   * action — the user already asked for the analysis, so re-asking here would be
   * a pointless second click. Never set by a plain drill-in. The Members tab is
   * already `activeTab`'s default, so the result lands where it's visible with
   * no extra tab-switching logic tied to this prop.
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
   * "Export members" action). Optional and forwarded as-is from `GroupsTab`;
   * per ADR-0039, omitting it **omits the action from {@link GroupActionBar}
   * entirely** rather than shipping it disabled — `App.tsx` does not wire this
   * through to the Groups tab yet.
   */
  onExportGroup?: (groupId: string, groupName: string) => void;
}

/**
 * Detail view for one group: membership source and a member roster with
 * add/remove (Members tab), what membership grants plus app push (Access tab),
 * and the two rule relationships (Rules tab), with the group's own reference
 * facts below the tab card. Its identity is the header's job. Export and
 * membership writes (the action bar's Add-member modal, and per-member
 * add/remove) are its only mutations; everything else here still just reads.
 */
const GroupDetailView: React.FC<GroupDetailViewProps> = ({
  group,
  targetTabId,
  onNavigateToRule,
  autoAnalyze = false,
  isActive = true,
  onExportGroup,
}) => {
  // Page-local pane switch, not sub-navigation — no `useViewStack`, no lifted
  // hook. Defaults to `'members'`, which is also where `autoAnalyze`'s result
  // renders (see that prop's doc).
  const [activeTab, setActiveTab] = useState<GroupDetailTab>('members');

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
  const openedGroupId = source.group?.id;
  useOwedLoad(group.id, autoAnalyze && openedGroupId === group.id, () => {
    analyzeMembers();
  });

  return (
    // A fragment, not just the stack `div`: the Add-member modal below is a
    // page-level overlay, mounted once and controlled by `addMember.isOpen`
    // (the pattern `UsersTab.tsx` uses for `AddToGroupModal`) rather than a
    // child of the `space-y-6` rhythm it has nothing to do with.
    <>
      {/*
        `space-y-6`, the same step the Users detail rung uses. It was `space-y-3`,
        which is the card-to-card gap and not the rung's step — the strip is a card
        the width of the column like every section under it, so it takes the same
        rhythm as the rest of the rung rather than a tighter one of its own.
      */}
      <div className="space-y-6" data-testid="group-detail-view">
        <GroupActionBar
          group={group}
          targetTabId={targetTabId}
          onExportGroup={onExportGroup}
          onAddMember={openAddMemberModal}
        />

        <div>
          <Tabs
            tabs={GROUP_DETAIL_TABS}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as GroupDetailTab)}
            variant="underline"
            ariaLabel="Group detail sections"
          />

          <div className="mt-6">
            {activeTab === 'members' && (
              <div className="space-y-6" role="tabpanel" aria-label="Members">
                <GroupMembershipSourceSection
                  memberCount={group.memberCount}
                  breakdown={source.breakdown}
                  status={source.memberStatus}
                  error={source.error}
                  onAnalyze={source.analyzeMembers}
                  canAnalyze={targetTabId !== null}
                  onNavigateToRule={onNavigateToRule}
                />

                <GroupMembersSection
                  groupType={group.type}
                  memberCount={group.memberCount}
                  members={membersSection.members}
                  status={source.memberStatus}
                  error={source.error}
                  onAnalyze={source.analyzeMembers}
                  canAnalyze={targetTabId !== null}
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
              <div className="space-y-6" role="tabpanel" aria-label="Access">
                <GroupAccessSection
                  apps={accessGrants.apps}
                  appsStatus={accessGrants.appsStatus}
                  appsError={accessGrants.appsError}
                  roles={accessGrants.roles}
                  rolesStatus={accessGrants.rolesStatus}
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
          </div>
        </div>

        <GroupMetadataSection
          groupId={group.id}
          description={group.description}
          created={group.created}
          lastUpdated={group.lastUpdated}
        />
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
    </>
  );
};

export default GroupDetailView;
