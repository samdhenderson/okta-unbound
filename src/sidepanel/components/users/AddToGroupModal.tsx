/**
 * @module sidepanel/components/users/AddToGroupModal
 * @description Presentational Add-to-Group modal for the Users tab.
 *
 * A pure view over the {@link useAddToGroup} state machine: a debounced group
 * type-ahead (raw input + results dropdown), the chosen-group chip, and the
 * confirm/cancel footer built from the shared `Button` and `Modal` primitives. All
 * state (the query, the debounced search, the add-in-flight flag) lives in the hook;
 * this component only renders it and forwards user intent through callbacks.
 */
import React from 'react';
import { Button, Modal, LoadingSpinner } from '../shared';
import type { GroupSearchResult } from '../../hooks/useAddToGroup';

/** Props for {@link AddToGroupModal}. */
interface AddToGroupModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** First name of the user being added; the title falls back to "User" when absent. */
  userFirstName?: string;
  /** Controlled group type-ahead query. */
  groupSearchQuery: string;
  /** Called with the new query string on each keystroke. */
  onGroupSearchQueryChange: (value: string) => void;
  /** Current group search results shown in the dropdown. */
  groupSearchResults: GroupSearchResult[];
  /** True while a debounced group search is in flight (shows the inline spinner). */
  isSearchingGroups: boolean;
  /** Whether the results dropdown should be shown. */
  showGroupDropdown: boolean;
  /** The chosen group, or null when none is selected yet. */
  selectedGroup: GroupSearchResult | null;
  /** Choose a group from the dropdown. */
  onSelectGroup: (group: GroupSearchResult) => void;
  /** Clear the chosen group (the selected-group "Clear" button). */
  onClearSelectedGroup: () => void;
  /** True while the add request is in flight (drives the confirm button spinner). */
  isAddingToGroup: boolean;
  /** Close the modal (Cancel, Escape, overlay click, or header close). */
  onClose: () => void;
  /** Confirm the add of the selected group. */
  onConfirm: () => void;
}

/**
 * The Users tab's Add-to-Group modal. Renders the group type-ahead, the selected
 * group chip, and the confirm/cancel actions; all logic lives in `useAddToGroup`.
 */
const AddToGroupModal: React.FC<AddToGroupModalProps> = ({
  isOpen,
  userFirstName,
  groupSearchQuery,
  onGroupSearchQueryChange,
  groupSearchResults,
  isSearchingGroups,
  showGroupDropdown,
  selectedGroup,
  onSelectGroup,
  onClearSelectedGroup,
  isAddingToGroup,
  onClose,
  onConfirm,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add ${userFirstName || 'User'} to Group`}
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
            disabled={!selectedGroup || isAddingToGroup}
            loading={isAddingToGroup}
          >
            Add to Group
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/*
          CHARACTERIZED: raw <input> + raw dropdown <button>s kept intentionally.
          This is a type-ahead composite (like the §3-exempt SearchDropdown /
          UserSearchBar): the spinner and results dropdown are absolutely positioned
          against this `.relative` wrapper. The shared <Input> renders a different DOM
          shape (nested wrapper, `mb-2` label, outline-not-ring focus) and the dropdown
          items are left-aligned two-line rows (not centered CTAs like <Button>), so
          migrating would shift pixels. Do not migrate without a pixel review.
        */}
        <div className="relative">
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Search for a group
          </label>
          <input
            type="text"
            value={groupSearchQuery}
            onChange={(e) => onGroupSearchQueryChange(e.target.value)}
            placeholder="Type to search by group name..."
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {isSearchingGroups && (
            <div className="absolute right-3 top-8">
              <LoadingSpinner size="sm" />
            </div>
          )}

          {/* Search results dropdown */}
          {showGroupDropdown && groupSearchResults.length > 0 && !selectedGroup && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
              {groupSearchResults.map((group) => (
                <button
                  key={group.id}
                  onClick={() => onSelectGroup(group)}
                  className="w-full text-left px-3 py-2 hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
                >
                  <div className="text-sm font-medium text-neutral-900">{group.name}</div>
                  <div className="text-xs text-neutral-500">{group.type}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected group display */}
        {selectedGroup && (
          <div className="flex items-center justify-between p-3 bg-primary-light border border-primary-highlight rounded-md">
            <div>
              <div className="text-sm font-medium text-neutral-900">{selectedGroup.name}</div>
              <div className="text-xs text-neutral-500">{selectedGroup.type}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClearSelectedGroup}>
              Clear
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AddToGroupModal;
