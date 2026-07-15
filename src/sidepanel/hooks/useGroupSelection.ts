/**
 * @module sidepanel/hooks/useGroupSelection
 * @description Tracks which groups are selected in the Groups tab (checkbox state).
 *
 * Selection is stored as a set of ids and resolved against the full group list, so
 * picks survive filtering and live/cached mode switches.
 */

import { useState, useMemo, useCallback } from 'react';
import type { GroupSummary } from '../../shared/types';

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
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  /** Replace the whole selection (Select All against the filtered ids, or load a collection). */
  const replaceSelection = useCallback((ids: string[]) => {
    setSelectedGroupIds(new Set(ids));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedGroupIds(new Set());
  }, []);

  const selectedGroups = useMemo(
    () => groups.filter((g) => selectedGroupIds.has(g.id)),
    [groups, selectedGroupIds],
  );

  return { selectedGroupIds, selectedGroups, toggleSelect, replaceSelection, deselectAll };
}
