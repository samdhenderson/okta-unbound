/**
 * @module sidepanel/components/users/UserProfilePaneHeader
 * @description The Profile pane's top strip: what the pane is showing, and every
 * verb that acts on the pane as a whole.
 *
 * Extracted from {@link module:sidepanel/components/users/UserProfilePane} when
 * the pane became editable. The pane was already at the ~300-line ceiling
 * (`docs/state-management.md`), and the strip had grown from "a summary line and
 * a gear" into a mode switch with three states — so it became its own pure,
 * story-able component rather than another sixty lines of JSX inside a component
 * that also owns filter state and block derivation.
 *
 * ## Two clusters, and only one of them changes
 *
 * The summary sentence and the gear are constant. What varies is the edit
 * cluster beside them:
 *
 * | State                | Renders                                        |
 * | -------------------- | ---------------------------------------------- |
 * | nothing editable     | nothing — no Edit button at all                |
 * | editable, read mode  | **Edit**                                       |
 * | edit mode            | the dirty count, **Cancel**, **Save**          |
 *
 * **The Edit button is absent, not disabled, when the profile has nothing
 * editable.** A disabled Edit on a profile that is entirely mastered by Active
 * Directory invites the reader to hunt for the reason it will not press; an
 * absent one says the same thing without the hunt, and the per-attribute lock
 * reasons — which only appear in edit mode — would have nothing to explain.
 * Whether anything is editable is decided once by the caller, from the same
 * `attributeEditability` verdicts the cells are built from, so the button and
 * the controls can never disagree.
 *
 * ## The dirty count exists because Save is disabled
 *
 * Save refuses an edit with no changes and an edit with an invalid value, and a
 * disabled button that does not say why is a dead end. The status line beside it
 * carries the reason in every state: how many attributes would be written, that
 * there is nothing to write yet, or that a value needs fixing first.
 *
 * ## Security
 *
 * The counts here are derived from tenant data but are counts only; no attribute
 * name, label or value appears in this component, and **nothing here logs**.
 */
import React from 'react';
import { Button, IconButton } from '../shared';
import Icon from '../overview/shared/Icon';

/**
 * The pane-level edit verbs and the state that decides which of them show.
 *
 * Passed as one object rather than seven props because it travels intact from
 * {@link module:sidepanel/hooks/useUsersTabProfileEdit} through
 * {@link module:sidepanel/components/users/UserDetailPanel} and the pane to get
 * here, and a bundle that arrives whole cannot be threaded half-way.
 */
export interface ProfileEditControls {
  /**
   * Whether **any** attribute on this profile can be edited here. `false` hides
   * the Edit button entirely — see the module header for why it is not merely
   * disabled.
   */
  canEdit: boolean;
  /** Whether the pane is currently in edit mode. */
  isEditing: boolean;
  /** How many attributes the draft would write. `0` disables Save. */
  changeCount: number;
  /** Whether any drafted value fails validation. Disables Save. */
  hasInvalid: boolean;
  /** Enters edit mode with a clean draft. */
  onBeginEdit: () => void;
  /** Leaves edit mode, discarding every draft. */
  onCancelEdit: () => void;
  /** Arms the save confirmation — it does not write anything itself. */
  onSave: () => void;
}

/** Props for {@link UserProfilePaneHeader}. */
export interface UserProfilePaneHeaderProps {
  /** How many attributes the current filter and configuration leave on screen. */
  shown: number;
  /** How many distinct attributes this profile has in total. */
  total: number;
  /** How many of the shown attributes a currently *granting* rule reads. */
  ruleReadCount: number;
  /** Opens the "Configure attribute display" modal, which the pane does not own. */
  onConfigure: () => void;
  /**
   * The edit verbs. Absent on a surface that does not offer editing at all,
   * which is not the same thing as a profile with nothing editable
   * ({@link ProfileEditControls.canEdit}).
   */
  edit?: ProfileEditControls;
}

/** `1 change` / `3 changes` — the count never says "changes" for one. */
function changeCountLabel(count: number): string {
  return count === 1 ? '1 change' : `${count} changes`;
}

/**
 * The status line beside Save, which always says why Save is in the state it is.
 *
 * Order matters: an invalid value is the reason Save is refusing even when there
 * are changes, so it is reported ahead of the count.
 */
const EditStatus: React.FC<{ changeCount: number; hasInvalid: boolean }> = ({
  changeCount,
  hasInvalid,
}) => {
  if (hasInvalid) {
    return <span className="text-xs text-danger-text">Fix the highlighted values</span>;
  }
  return (
    <span className="text-xs text-neutral-600">
      {changeCount === 0 ? 'No changes yet' : changeCountLabel(changeCount)}
    </span>
  );
};

/**
 * The Profile pane's header strip: the attribute summary, the display gear, and
 * the Edit / Cancel / Save cluster.
 *
 * @param props - See {@link UserProfilePaneHeaderProps}.
 *
 * @example
 * ```tsx
 * <UserProfilePaneHeader
 *   shown={12}
 *   total={21}
 *   ruleReadCount={2}
 *   onConfigure={() => setConfigOpen(true)}
 *   edit={editControls}
 * />
 * ```
 */
const UserProfilePaneHeader: React.FC<UserProfilePaneHeaderProps> = ({
  shown,
  total,
  ruleReadCount,
  onConfigure,
  edit,
}) => (
  // `flex-wrap` rather than a fixed row: at the 360px panel floor the sentence
  // and a three-control cluster do not share a line, and the cluster taking a
  // second row is better than either of them being squeezed.
  <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
    <p className="min-w-0 flex-1 text-xs text-neutral-600 text-pretty">
      {shown} of {total} attributes shown &middot; {ruleReadCount} read by rules that grant access
    </p>

    <div className="flex shrink-0 items-center gap-2">
      {edit?.isEditing ? (
        <>
          <EditStatus changeCount={edit.changeCount} hasInvalid={edit.hasInvalid} />
          <Button size="sm" variant="secondary" onClick={edit.onCancelEdit}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={edit.onSave}
            disabled={edit.changeCount === 0 || edit.hasInvalid}
          >
            Save
          </Button>
        </>
      ) : (
        // No glyph: the `Icon` registry has no pencil, and adding a shared glyph
        // for one button is a change to a registry every tab reads.
        edit?.canEdit && (
          <Button size="sm" variant="secondary" onClick={edit.onBeginEdit}>
            Edit
          </Button>
        )
      )}

      <IconButton
        label="Configure attribute display"
        variant="subtle"
        size="md"
        onClick={onConfigure}
      >
        <Icon type="settings" size="sm" />
      </IconButton>
    </div>
  </div>
);

export default UserProfilePaneHeader;
