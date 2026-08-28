/**
 * @module sidepanel/components/groups/detail/AddGroupMemberModal
 * @description Presentational Add-member modal for the Group Detail view.
 *
 * The group-side mirror of `AddToGroupModal.tsx` (Users tab): a pure view over
 * the {@link useAddGroupMember} state machine — a debounced user type-ahead
 * (shared `Input` + results dropdown), the chosen-user chip, and the
 * confirm/cancel footer built from the shared `Button` and `Modal` primitives.
 * All state (the query, the debounced search, the add-in-flight flag) lives in
 * the hook; this component only renders it and forwards user intent through
 * callbacks. A failed *search* ({@link AddGroupMemberModalProps.addSearchError})
 * and a failed *add* ({@link AddGroupMemberModalProps.addMemberError}) render as
 * two distinct inline alerts — the hook's `onResult` only ever reports the
 * latter, so the caller passes it straight through rather than this component
 * inferring one from the other.
 */
import React from 'react';
import { AlertMessage, Button, Modal, Input, LoadingSpinner } from '../../shared';
import type { OktaUser } from '../../../../shared/types';
import { userDisplayName } from '../../../../shared/utils/userDisplay';

/** Props for {@link AddGroupMemberModal}. */
interface AddGroupMemberModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Name of the group members are being added to; the title falls back to "Group" when absent. */
  groupName?: string;
  /** Controlled user type-ahead query. */
  addQuery: string;
  /** Called with the new query string on each keystroke. */
  onAddQueryChange: (value: string) => void;
  /** Current user search results shown in the dropdown, with existing members already excluded. */
  addResults: OktaUser[];
  /** True while a debounced user search is in flight (shows the inline spinner). */
  isSearchingToAdd: boolean;
  /** Error message from the debounced search, if any. */
  addSearchError?: string | null;
  /** The chosen user, or null when none is selected yet. */
  selectedUser: OktaUser | null;
  /** Choose a user from the dropdown. */
  onSelectUser: (user: OktaUser) => void;
  /** Clear the chosen user (the selected-user "Clear" button). */
  onClearSelectedUser: () => void;
  /** True while the add request is in flight (drives the confirm button spinner). */
  isAddingMember: boolean;
  /** Close the modal (Cancel, Escape, overlay click, or header close). */
  onClose: () => void;
  /** Confirm the add of the selected user. */
  onConfirm: () => void;
  /**
   * Error from a failed add attempt (the mutation, not the search) — distinct
   * from {@link AddGroupMemberModalProps.addSearchError}, which reports a
   * failed type-ahead. `null`/omitted when the last attempt succeeded or none
   * has run yet.
   */
  addMemberError?: string | null;
}

/**
 * The Group Detail view's Add-member modal. Renders the user type-ahead, the
 * selected-user chip, and the confirm/cancel actions; all logic lives in
 * `useAddGroupMember`.
 */
const AddGroupMemberModal: React.FC<AddGroupMemberModalProps> = ({
  isOpen,
  groupName,
  addQuery,
  onAddQueryChange,
  addResults,
  isSearchingToAdd,
  addSearchError,
  selectedUser,
  onSelectUser,
  onClearSelectedUser,
  isAddingMember,
  onClose,
  onConfirm,
  addMemberError,
}) => {
  const showDropdown = addResults.length > 0 && !selectedUser;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add member to ${groupName || 'Group'}`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            disabled={!selectedUser || isAddingMember}
            loading={isAddingMember}
          >
            Add member
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/*
          Type-ahead composite: the results dropdown is absolutely positioned
          against this `.relative` wrapper, below the shared <Input> (label +
          field). The dropdown rows are left-aligned two-line rows, not
          centered CTAs, so they stay raw <button>s rather than <Button>.
        */}
        <div className="relative">
          <Input
            label="Search for a user"
            type="text"
            value={addQuery}
            onChange={onAddQueryChange}
            placeholder="Type to search by name, email, or login..."
            trailing={isSearchingToAdd ? <LoadingSpinner size="sm" /> : undefined}
          />

          {addSearchError && (
            <AlertMessage message={{ text: addSearchError, type: 'danger' }} className="mt-1" />
          )}

          {/* Search results dropdown */}
          {showDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
              {addResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onSelectUser(user)}
                  /* `press press-subtle` (ADR-0046): a wide list row, not a button-weight
                     target, so it takes the subtle press scale. */
                  className="press press-subtle w-full text-left px-(--sp-row-x) py-(--sp-row-y) hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
                >
                  <div className="text-sm font-medium text-neutral-900">
                    {userDisplayName(user)}
                  </div>
                  <div className="text-xs text-neutral-500">{user.profile.email}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected user display */}
        {selectedUser && (
          <div className="flex items-center justify-between p-(--sp-card) bg-primary-light border border-primary-highlight rounded-md">
            <div>
              <div className="text-sm font-medium text-neutral-900">
                {userDisplayName(selectedUser)}
              </div>
              <div className="text-xs text-neutral-500">{selectedUser.profile.email}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClearSelectedUser}>
              Clear
            </Button>
          </div>
        )}

        {addMemberError && <AlertMessage message={{ text: addMemberError, type: 'danger' }} />}
      </div>
    </Modal>
  );
};

export default AddGroupMemberModal;
