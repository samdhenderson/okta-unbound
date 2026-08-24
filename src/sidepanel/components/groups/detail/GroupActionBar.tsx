/**
 * @module sidepanel/components/groups/detail/GroupActionBar
 * @description The group-detail rung's action strip — the ADR-0039 wrapper this
 * page was missing.
 *
 * Before this component existed, {@link GroupDetailView} called the shared
 * `ActionBar` directly with one `export-members` descriptor shipped
 * `disabled: !onExportGroup` whenever the caller left that prop out — a ghost
 * action with no live wire, permanently disabled rather than absent. That is
 * the exact failure ADR-0039 was written to name and forbid: *Export members*
 * now only appears in the strip when {@link GroupActionBarProps.onExportGroup}
 * is actually provided. `GroupsTab.tsx` already documents that prop as
 * optional — `App.tsx` doesn't wire it through to the Groups tab yet — so the
 * omitted state is a real, reachable one, not a hypothetical.
 *
 * *Add* is the everyday, reversible verb (an add can always be undone by a
 * remove) and stays in the row at `priority: 'flex'`, mirroring
 * {@link module:sidepanel/components/users/UserActionBar}'s treatment of *Add
 * group*. Unlike that strip, this one ships with **no disclosure tier**: there
 * is no group-level verb today that changes the group's state with no
 * symmetric undo, so there is nothing to put one press behind **More** — a
 * page with no irreversible action simply has no tier, rather than an empty
 * one invented to look consistent.
 *
 * `ActionBar` itself still owns every disclosure mechanic (there happens to be
 * none to disclose here); this component only decides what belongs in the row.
 */
import React from 'react';
import { ActionBar, type ActionDescriptor } from '../../shared';
import type { GroupSummary } from '../../../../shared/types';

/** Props for {@link GroupActionBar}. */
export interface GroupActionBarProps {
  /** The group every verb in the strip acts on. */
  group: GroupSummary;
  /** Connected Okta tab id; `Add` disables without one (the type-ahead has nothing to search). */
  targetTabId: number | null;
  /**
   * Opens the Export tab pre-scoped to this group's members. Optional and
   * forwarded as-is from `GroupsTab` — when absent, per ADR-0039 the *Export
   * members* action is **omitted from the strip entirely**, never shipped
   * `disabled` forever.
   */
  onExportGroup?: (groupId: string, groupName: string) => void;
  /** Opens the Add-member modal. */
  onAddMember: () => void;
  /**
   * Pin the strip below the header while the page scrolls under it. Defaults to
   * `true`; pass `false` in a story, where there is nothing to scroll.
   */
  sticky?: boolean;
}

/**
 * The group-detail rung's action strip: *Export members* (pinned, primary,
 * only when wired) and *Add* (flex) in the row, no disclosure tier.
 *
 * @param props - See {@link GroupActionBarProps}.
 *
 * @example
 * ```tsx
 * <GroupActionBar
 *   group={group}
 *   targetTabId={targetTabId}
 *   onExportGroup={onExportGroup}
 *   onAddMember={addMember.openModal}
 * />
 * ```
 */
const GroupActionBar: React.FC<GroupActionBarProps> = ({
  group,
  targetTabId,
  onExportGroup,
  onAddMember,
  sticky = true,
}) => {
  // Declaration order is reading order and overflow order both: `Export
  // members` is `primary` and defaults to `pinned` (never overflows), `Add` is
  // explicitly `flex` — the first (and only) row action to move behind **More**
  // if the strip ever gains a tier to move it into.
  const actions: ActionDescriptor[] = [
    ...(onExportGroup
      ? [
          {
            id: 'export-members',
            label: 'Export members',
            icon: 'download',
            variant: 'primary',
            onClick: () => onExportGroup(group.id, group.name),
            title:
              "Export this group's members (opens the Export tab with column picker + presets)",
          } satisfies ActionDescriptor,
        ]
      : []),
    {
      id: 'add-member',
      label: 'Add',
      icon: 'plus',
      priority: 'flex',
      onClick: onAddMember,
      disabled: targetTabId === null,
      title: 'Add a member to this group',
    },
  ];

  return <ActionBar ariaLabel={`Actions for ${group.name}`} sticky={sticky} actions={actions} />;
};

export default GroupActionBar;
