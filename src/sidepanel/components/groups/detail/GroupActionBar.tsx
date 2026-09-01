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
 * group*. *Compare* joins it there for the reason that strip puts its own
 * *Compare* in the row: a comparison reads two rosters and writes nothing, so
 * the worst a mis-press costs is a page you close again.
 *
 * ## The tier, and the one verb in it
 *
 * This strip shipped with **no disclosure tier** at first, on the accurate
 * grounds that no group-level verb then existed which changed the group's state
 * with no symmetric undo. *Create feeding rule* is the first one that does, so
 * it is the first thing in this strip's `expansion` (ADR-0039 §2) — and it is
 * there for the consequence, not the importance: a rule **grants** memberships
 * as it matches, and deleting the rule afterwards leaves every membership it
 * already made in place. There is no opposite button.
 *
 * The consequence is written next to the control rather than only inside the
 * dialog it opens, the way `UserLifecycleActions` writes "Blocks sign-in until
 * reversed" — a reader deciding whether to press an irreversible verb needs the
 * state it leaves behind, not a second reading of its label. The confirm itself,
 * the draft it takes and what it declines to predict all belong to
 * {@link module:sidepanel/components/groups/detail/CreateFeedingRuleModal},
 * which the page owns; this strip only opens it.
 *
 * The tier's open state is left to `ActionBar` (uncontrolled): nothing on this
 * rung needs to close it, and the verbs behind it survive a pane switch by
 * design. `ActionBar` still owns every disclosure mechanic — the **More**
 * control, the region it opens and that region's `aria-controls` target — which
 * is why there is no disclosure button below.
 */
import React from 'react';
import { ActionBar, Button, Eyebrow, type ActionDescriptor } from '../../shared';
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
  /** Opens the picker for the second group in a membership comparison. */
  onCompare: () => void;
  /**
   * Opens the create-feeding-rule confirm dialog. The verb lives in the strip's
   * disclosure tier, one press behind **More**, because a rule's grants outlive
   * the rule (ADR-0039 §2).
   */
  onCreateFeedingRule: () => void;
  /**
   * Pin the strip below the header while the page scrolls under it. Defaults to
   * `true`; pass `false` in a story, where there is nothing to scroll.
   */
  sticky?: boolean;
}

/**
 * The group-detail rung's action strip: *Export members* (pinned, primary, only
 * when wired), *Add* and *Compare* (both flex) in the row, and *Create feeding
 * rule* — the rung's one verb with no symmetric undo — in the disclosure tier.
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
 *   onCompare={openComparePicker}
 *   onCreateFeedingRule={createFeedingRule.open}
 * />
 * ```
 */
const GroupActionBar: React.FC<GroupActionBarProps> = ({
  group,
  targetTabId,
  onExportGroup,
  onAddMember,
  onCompare,
  onCreateFeedingRule,
  sticky = true,
}) => {
  // Declaration order is reading order and overflow order both: `Export
  // members` is `primary` and defaults to `pinned` (never overflows), while
  // `Add` and `Compare` are explicitly `flex` — and now that the strip has a
  // tier, `Compare` is the first of them to move behind **More** when the panel
  // tightens, `Add` the second.
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
    {
      id: 'compare',
      label: 'Compare',
      icon: 'users',
      priority: 'flex',
      onClick: onCompare,
      disabled: targetTabId === null,
      title: 'Compare this group\u2019s membership with another group',
    },
  ];

  return (
    <ActionBar
      ariaLabel={`Actions for ${group.name}`}
      sticky={sticky}
      actions={actions}
      expansion={
        /* The tier — mounted whether or not it is open, held out of the tab order
           and the accessible tree by `ActionBar`'s `inert` while closed. */
        <div className="space-y-(--sp-field)">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>Automated intake</Eyebrow>
            <span className="text-xs text-neutral-600">Asks to confirm</span>
          </div>
          {/*
            The consequence beside the control, not only inside the dialog:
            what the press leaves behind, in the noun it acts on (ADR-0039 §2).
          */}
          <div className="flex flex-wrap items-center justify-between gap-(--sp-field)">
            <span className="text-xs text-danger-text">
              Memberships a rule grants outlive the rule
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              onClick={onCreateFeedingRule}
              disabled={targetTabId === null}
              title={
                targetTabId === null
                  ? 'Connect an Okta tab to create a rule'
                  : 'Create a rule that assigns users to this group'
              }
            >
              Create feeding rule
            </Button>
          </div>
        </div>
      }
    />
  );
};

export default GroupActionBar;
