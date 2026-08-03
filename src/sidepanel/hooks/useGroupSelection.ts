/**
 * @module sidepanel/hooks/useGroupSelection
 * @description Tracks which groups are selected in the Groups tab (checkbox state).
 *
 * Selection is stored as a set of ids and resolved against the full group list, so
 * picks survive filtering and live/cached mode switches. Thin typed wrapper over
 * the generic {@link useEntitySelection}.
 */

import type { GroupSummary } from '../../shared/types';
import { useEntitySelection } from './useEntitySelection';

/**
 * Owns group selection. `selectedGroups` derives from the full `groups` list (NOT
 * the filtered view), so a selection deliberately survives filtering and live/cached
 * mode switches — hidden picks stay selected. Do not re-scope this to filteredGroups.
 *
 * @param groups - The full group list selected ids are resolved against.
 * @returns `selectedGroupIds`, the resolved `selectedGroups`, and the
 * `toggleSelect` / `replaceSelection` / `deselectAll` mutators.
 */
export function useGroupSelection(groups: GroupSummary[]) {
  const { selectedIds, selectedEntities, toggleSelect, replaceSelection, deselectAll } =
    useEntitySelection(groups);

  return {
    selectedGroupIds: selectedIds,
    selectedGroups: selectedEntities,
    toggleSelect,
    replaceSelection,
    deselectAll,
  };
}
