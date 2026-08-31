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
 * ## The disclosure tier
 *
 * This strip shipped with no tier at first, on the reasoning that no
 * group-level verb changed the group's state with no symmetric undo. *Remove
 * deprovisioned* is that verb, and so the tier exists now. It empties a group
 * of every member Okta has already deprovisioned — the cleanup an admin
 * reaches for when accounts were offboarded but left in the groups they
 * carried — and there is no one press that puts them back. So it is
 * `priority: 'tier'` (behind **More** from the start, never in the row) plus a
 * confirm `Modal` naming the count and the group in plain language, exactly
 * the treatment `UserActionBar` gives suspend and reset-password.
 *
 * The verb is **absent, not disabled**, whenever it cannot honestly run
 * (ADR-0039): with no `onRemoveDeprovisioned` wire, on an `APP_GROUP` (the
 * operation refuses those outright — membership is mastered by the app), or
 * with a `deprovisionedCount` of `0` or `undefined`. `undefined` is the
 * pre-analysis state, and it is deliberately not rendered as zero: the roster
 * is gated behind an explicit load for large groups, so before it lands this
 * page does not know the count and must not imply it knows one (ADR-0032 §2a).
 *
 * The confirm modal is a sibling of `ActionBar`, not part of `expansion` —
 * `ActionBar` holds a closed tier `inert`, which would take the dialog out of
 * the accessible tree along with the button that opened it.
 *
 * `ActionBar` itself still owns every disclosure mechanic — the **More**
 * control, the region it opens, that region's `aria-controls` target; this
 * component only decides what belongs on each side of it.
 */
import React, { useState } from 'react';
import { ActionBar, AlertMessage, Button, Modal, type ActionDescriptor } from '../../shared';
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
   * How many of this group's members are `DEPROVISIONED`, counted from the
   * roster the page has already loaded. `undefined` means *not yet known* (the
   * member analysis is gated and has not run) and, like `0`, omits the *Remove
   * deprovisioned* action rather than rendering a count this page cannot vouch
   * for — see the module doc.
   */
  deprovisionedCount?: number;
  /**
   * Runs the bulk removal once the confirm modal is accepted. Optional: per
   * ADR-0039, without it the action is **omitted from the strip entirely**
   * rather than shipped disabled.
   */
  onRemoveDeprovisioned?: () => void;
  /** True while that removal is in flight; holds the confirm button in its loading state. */
  isRemoving?: boolean;
  /** The last error the removal reported, shown inside the confirm modal. */
  removeError?: string | null;
  /**
   * Pin the strip below the header while the page scrolls under it. Defaults to
   * `true`; pass `false` in a story, where there is nothing to scroll.
   */
  sticky?: boolean;
}

/**
 * The group-detail rung's action strip: *Export members* (pinned, primary,
 * only when wired), *Add* and *Compare* (both flex) in the row, and *Remove
 * deprovisioned* behind **More** with a confirm modal — the one verb here with
 * no symmetric undo.
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
 *   deprovisionedCount={deprovisionedCount}
 *   onRemoveDeprovisioned={removeDeprovisioned.run}
 *   isRemoving={removeDeprovisioned.isRemoving}
 *   removeError={removeDeprovisioned.error}
 * />
 * ```
 */
const GroupActionBar: React.FC<GroupActionBarProps> = ({
  group,
  targetTabId,
  onExportGroup,
  onAddMember,
  onCompare,
  deprovisionedCount,
  onRemoveDeprovisioned,
  isRemoving = false,
  removeError = null,
  sticky = true,
}) => {
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Every condition under which the verb cannot honestly run collapses to one
  // boolean, and its falsity omits the descriptor rather than disabling it.
  const canRemoveDeprovisioned =
    onRemoveDeprovisioned !== undefined &&
    group.type !== 'APP_GROUP' &&
    deprovisionedCount !== undefined &&
    deprovisionedCount > 0;
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
    {
      id: 'compare',
      label: 'Compare',
      icon: 'users',
      priority: 'flex',
      onClick: onCompare,
      disabled: targetTabId === null,
      title: 'Compare this group\u2019s membership with another group',
    },
    ...(canRemoveDeprovisioned
      ? [
          {
            id: 'remove-deprovisioned',
            label: `Remove ${deprovisionedCount} deprovisioned`,
            icon: 'trash',
            variant: 'danger',
            priority: 'tier',
            onClick: () => setConfirmingRemove(true),
            disabled: targetTabId === null,
            title: 'Remove every deprovisioned member from this group',
          } satisfies ActionDescriptor,
        ]
      : []),
  ];

  return (
    <>
      <ActionBar ariaLabel={`Actions for ${group.name}`} sticky={sticky} actions={actions} />

      {/* A sibling of the strip, not part of its tier: `ActionBar` holds a
          closed tier `inert`, which would hide the dialog too. */}
      <Modal
        isOpen={confirmingRemove}
        onClose={() => setConfirmingRemove(false)}
        title="Remove deprovisioned members"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingRemove(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmingRemove(false);
                onRemoveDeprovisioned?.();
              }}
              loading={isRemoving}
              disabled={isRemoving}
            >
              Remove {deprovisionedCount}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          This will remove <strong>{deprovisionedCount}</strong> deprovisioned member
          {deprovisionedCount === 1 ? '' : 's'} from <strong>{group.name}</strong>. This action
          cannot be undone.
        </p>
        {removeError && (
          <AlertMessage message={{ text: removeError, type: 'danger' }} className="mt-3" />
        )}
      </Modal>
    </>
  );
};

export default GroupActionBar;
