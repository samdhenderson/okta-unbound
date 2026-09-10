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
 * ## One summary sentence, three modes beside it
 *
 * The summary sentence is constant. What varies is the cluster beside it, and
 * the pane has three mutually exclusive modes because value-editing and
 * display-customizing take over the same rows:
 *
 * | Mode                            | Renders                                      |
 * | ------------------------------- | -------------------------------------------- |
 * | read, nothing editable          | the gear only                                |
 * | read, editable                  | **Edit** + the gear                          |
 * | value edit (`edit.isEditing`)   | the dirty count, **Cancel**, **Save** — no gear |
 * | customizing                     | a `Customizing display` badge — no Edit, no gear |
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
 * **The gear is absent, not disabled, mid-draft** — the same argument, extended.
 * Pressing it during a value edit would switch modes and silently discard the
 * draft, so a gear that refuses to explain itself is replaced by no gear at all.
 * It is likewise absent when the caller passes no {@link
 * UserProfilePaneHeaderProps.customize} bundle: a verb with no wired handler is
 * omitted, never shipped inert.
 *
 * While customizing, the cluster is a plain badge rather than a verb strip. The
 * customize-mode verbs — Reset to default, Cancel, Done — belong to the editor
 * that owns the draft, and live in its own footer bar; a Done up here could not
 * say what it would commit.
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
import { Badge, Button, IconButton } from '../shared';
import Icon from '../shared/Icon';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';

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

/**
 * The display-customization verbs and the state that decides what the header
 * shows for them.
 *
 * Passed as one object for the same reason {@link ProfileEditControls} is: it
 * travels intact from {@link module:sidepanel/components/users/UserDetailPanel}
 * through the pane to both the header and the editor, and a bundle that arrives
 * whole cannot be threaded half-way. **The header reads only `isCustomizing`
 * and calls only `onBegin`** — `onCommit` and `onCancel` are the editor's, and
 * are carried here so the rung wires the mode once rather than in two places.
 */
export interface ProfileDisplayCustomizeControls {
  /** Whether the pane is currently in display-customize mode. */
  isCustomizing: boolean;
  /** Enters customize mode. The gear's handler. */
  onBegin: () => void;
  /**
   * Persists the edited configuration and leaves customize mode. Receives the
   * **whole** config, never a patch — a one-key patch is how a record merge
   * un-files every attribute it did not mention.
   */
  onCommit: (config: ProfileDisplayConfig) => void;
  /** Leaves customize mode, discarding the draft. */
  onCancel: () => void;
}

/** Props for {@link UserProfilePaneHeader}. */
export interface UserProfilePaneHeaderProps {
  /** How many attributes the current filter and configuration leave on screen. */
  shown: number;
  /** How many distinct attributes this profile has in total. */
  total: number;
  /** How many of the shown attributes a currently *granting* rule reads. */
  ruleReadCount: number;
  /**
   * The display-customization verbs and mode flag. Absent on a surface that does
   * not offer customization at all — a story, or a read-only column — and then
   * the gear is not rendered, because a verb with no handler is omitted rather
   * than shipped disabled.
   */
  customize?: ProfileDisplayCustomizeControls;
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
 * The Profile pane's header strip: the attribute summary, the display gear, the
 * Edit / Cancel / Save cluster, and the customize-mode badge.
 *
 * @param props - See {@link UserProfilePaneHeaderProps}.
 *
 * @example
 * ```tsx
 * <UserProfilePaneHeader
 *   shown={12}
 *   total={21}
 *   ruleReadCount={2}
 *   customize={customizeControls}
 *   edit={editControls}
 * />
 * ```
 */
const UserProfilePaneHeader: React.FC<UserProfilePaneHeaderProps> = ({
  shown,
  total,
  ruleReadCount,
  customize,
  edit,
}) => (
  // `flex-wrap` rather than a fixed row: at the 360px panel floor the sentence
  // and a three-control cluster do not share a line, and the cluster taking a
  // second row is better than either of them being squeezed.
  <div className="flex flex-wrap items-start justify-between gap-(--sp-inline) p-(--sp-card)">
    <p className="min-w-0 flex-1 text-xs text-neutral-600 text-pretty">
      {shown} of {total} attributes shown &middot; {ruleReadCount} read by rules that grant access
    </p>

    <div className="flex shrink-0 items-center gap-(--sp-field)">
      {customize?.isCustomizing ? (
        // Customize mode's verbs live in the editor's own footer, next to the
        // draft they act on. All the header owes the reader here is which mode
        // the rows below are in.
        <Badge variant="neutral">Customizing display</Badge>
      ) : (
        <>
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
            // No glyph: the `Icon` registry has no pencil, and adding a shared
            // glyph for one button is a change to a registry every tab reads.
            edit?.canEdit && (
              <Button size="sm" variant="secondary" onClick={edit.onBeginEdit}>
                Edit
              </Button>
            )
          )}

          {/* Omitted mid-draft: switching modes would discard the draft. */}
          {customize && !edit?.isEditing && (
            <IconButton
              label="Configure attribute display"
              variant="subtle"
              size="md"
              onClick={customize.onBegin}
            >
              <Icon type="settings" size="sm" />
            </IconButton>
          )}
        </>
      )}
    </div>
  </div>
);

export default UserProfilePaneHeader;
