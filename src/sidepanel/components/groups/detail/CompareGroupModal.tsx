/**
 * @module sidepanel/components/groups/detail/CompareGroupModal
 * @description Picks the *other* group for a membership comparison from the
 * Group Detail rung.
 *
 * Comparing groups already exists: `GroupComparisonModal` and `api.compareGroups`
 * do the overlap analysis, and the Groups list opens them by ticking two to five
 * rows. A detail page has no rows to tick, so this modal supplies the missing
 * second operand and then hands both groups to that same modal. The comparison
 * itself is not reimplemented here.
 *
 * A pure view over {@link sidepanel/hooks/useGroupComparison.useGroupComparison},
 * exactly as `AddGroupMemberModal` is a pure view over `useAddGroupMember`: every
 * piece of state — the query, the debounced search, the chosen group — lives in
 * the hook, and this component only renders it. That is also what keeps it
 * storyable, since a story has no Okta tab to search.
 */
import React from 'react';
import { AlertMessage, Button, Modal, SearchDropdown } from '../../shared';
import type { GroupSummary } from '../../../../shared/types';

/** Props for {@link CompareGroupModal}. */
export interface CompareGroupModalProps {
  /** Whether the picker is open. */
  isOpen: boolean;
  /** The group already on screen — the first operand, named in the field label. */
  group: GroupSummary;
  /** Controlled type-ahead query. */
  query: string;
  /** Called with the new query on each keystroke. */
  onQueryChange: (value: string) => void;
  /** Hits, with the group being viewed already removed by the hook. */
  results: GroupSummary[];
  /** True while a debounced search is in flight. */
  isSearching: boolean;
  /** Message from a failed search, if any. */
  searchError?: string | null;
  /** The chosen second operand, or `null`. */
  selected: GroupSummary | null;
  /** Choose a hit from the dropdown. */
  onSelect: (hit: GroupSummary) => void;
  /** Clear the chosen group. */
  onClearSelected: () => void;
  /** `false` when no Okta tab is connected — the type-ahead has nothing to search. */
  canSearch: boolean;
  /** Close without comparing (Cancel, Escape, overlay, header close). */
  onClose: () => void;
  /** Confirm the pick and open the comparison. */
  onConfirm: () => void;
}

/** One hit: name over type and member count. */
const groupRow = (hit: GroupSummary): React.ReactNode => (
  <span className="flex min-w-0 flex-col items-start text-left">
    <span className="truncate text-sm text-neutral-900">{hit.name}</span>
    <span className="text-xs text-neutral-600">
      {hit.type} · {hit.memberCount.toLocaleString()} member{hit.memberCount === 1 ? '' : 's'}
    </span>
  </span>
);

/**
 * The group picker behind *Compare*: a live group search over everything but the
 * group being viewed, and a confirm that opens the existing comparison.
 *
 * @param props - See {@link CompareGroupModalProps}.
 */
const CompareGroupModal: React.FC<CompareGroupModalProps> = ({
  isOpen,
  group,
  query,
  onQueryChange,
  results,
  isSearching,
  searchError,
  selected,
  onSelect,
  onClearSelected,
  canSearch,
  onClose,
  onConfirm,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Compare with another group"
    footer={
      <>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!selected} onClick={onConfirm}>
          Compare
        </Button>
      </>
    }
  >
    <div className="space-y-3">
      <p className="text-sm text-neutral-600">
        Reports who is in both groups, who is unique to each, and how far they overlap. Reading each
        roster costs one pass per group.
      </p>

      <SearchDropdown
        label={`Compare ${group.name} with`}
        placeholder="Search groups by name…"
        query={query}
        onQueryChange={onQueryChange}
        isSearching={isSearching}
        results={results}
        showDropdown={!selected && results.length > 0 && query.trim().length > 0}
        onSelect={onSelect}
        renderResult={groupRow}
        selectedItem={selected}
        renderSelected={groupRow}
        onClear={onClearSelected}
        disabled={!canSearch}
        hint={canSearch ? undefined : 'Connect an Okta tab to search groups.'}
      />

      {searchError && <AlertMessage message={{ text: searchError, type: 'danger' }} />}
    </div>
  </Modal>
);

export default CompareGroupModal;
