/**
 * @module sidepanel/hooks/useEntitySelection
 * @description Generic checkbox-selection state for any id-bearing entity list.
 *
 * Selection is stored as a set of ids and resolved against the full entity list,
 * so picks survive filtering and live/cached mode switches. Generalized from the
 * Groups tab's selection hook so upcoming sections (Applications, Authentication
 * Policies) can reuse it via a thin typed wrapper.
 */

import { useState, useMemo, useCallback } from 'react';

/** Selection state and mutators returned by {@link useEntitySelection}. */
export interface EntitySelection<T extends { id: string }> {
  /** The selected ids (source of truth). */
  selectedIds: Set<string>;
  /** The selected entities, resolved against the full list passed in. */
  selectedEntities: T[];
  /** Toggle a single id in/out of the selection. */
  toggleSelect: (id: string) => void;
  /** Replace the whole selection (Select All against filtered ids, or load a saved set). */
  replaceSelection: (ids: string[]) => void;
  /** Clear the selection. */
  deselectAll: () => void;
}

/**
 * Owns entity selection. `selectedEntities` derives from the full `entities` list
 * (NOT a filtered view), so a selection deliberately survives filtering and
 * live/cached mode switches — hidden picks stay selected. Do not re-scope this to
 * a filtered list.
 *
 * @param entities - The full entity list selected ids are resolved against.
 * @returns `selectedIds`, the resolved `selectedEntities`, and the
 * `toggleSelect` / `replaceSelection` / `deselectAll` mutators.
 */
export function useEntitySelection<T extends { id: string }>(entities: T[]): EntitySelection<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const replaceSelection = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedEntities = useMemo(
    () => entities.filter((entity) => selectedIds.has(entity.id)),
    [entities, selectedIds],
  );

  return { selectedIds, selectedEntities, toggleSelect, replaceSelection, deselectAll };
}
