/**
 * @module sidepanel/hooks/useExportPresets
 * @description React binding over {@link module:shared/storage/presetStore} for the
 * Export tab.
 *
 * Loads the saved presets for the active entity and reconciles any persisted
 * column ids against the descriptor's current catalog (dropping ids that no longer
 * exist), so a catalog change never resurrects a stale column. All mutations are
 * fire-and-forget and refresh the in-memory list.
 */

import { useCallback, useEffect, useState } from 'react';
import { presetStore, type ExportPreset } from '@/shared/storage/presetStore';

/** What {@link useExportPresets} returns. */
export interface UseExportPresets {
  /** Saved presets for the active entity, newest first. */
  presets: ExportPreset[];
  /** Save a new named preset from the current selection. Returns it, or `null`. */
  save: (
    name: string,
    enabledColumnIds: string[],
    filterText?: string,
  ) => Promise<ExportPreset | null>;
  /** Delete a preset by id and refresh the list. */
  remove: (id: string) => Promise<void>;
  /** Read + reconcile the last-used column selection for this entity, or `null`. */
  loadLastUsed: () => Promise<{ enabledColumnIds: string[] } | null>;
  /** Persist the current column selection as this entity's last-used. */
  saveLastUsed: (enabledColumnIds: string[]) => Promise<void>;
  /** Reconcile arbitrary column ids against the current catalog. */
  reconcile: (ids: string[]) => string[];
}

/**
 * Manage saved presets and last-used selection for one export entity.
 *
 * @param entityId - The active {@link EntityExport.id}.
 * @param validColumnIds - Column ids present in the descriptor's current catalog.
 * @returns Preset list + save/remove/last-used operations (see {@link UseExportPresets}).
 */
export function useExportPresets(entityId: string, validColumnIds: string[]): UseExportPresets {
  const [presets, setPresets] = useState<ExportPreset[]>([]);
  const validKey = validColumnIds.join(',');

  const reconcile = useCallback(
    (ids: string[]): string[] => {
      const valid = new Set(validColumnIds);
      return ids.filter((id) => valid.has(id));
    },
    // validKey captures the catalog identity without a new array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [validKey],
  );

  const refresh = useCallback(async () => {
    const list = await presetStore.listPresets(entityId);
    setPresets(list);
  }, [entityId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (name: string, enabledColumnIds: string[], filterText?: string) => {
      const preset = await presetStore.savePreset({ entityId, name, enabledColumnIds, filterText });
      await refresh();
      return preset;
    },
    [entityId, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await presetStore.deletePreset(id);
      await refresh();
    },
    [refresh],
  );

  const loadLastUsed = useCallback(async () => {
    const last = await presetStore.getLastUsed(entityId);
    if (!last) return null;
    return { enabledColumnIds: reconcile(last.enabledColumnIds) };
  }, [entityId, reconcile]);

  const saveLastUsed = useCallback(
    async (enabledColumnIds: string[]) => {
      await presetStore.setLastUsed(entityId, enabledColumnIds);
    },
    [entityId],
  );

  return { presets, save, remove, loadLastUsed, saveLastUsed, reconcile };
}
