/**
 * @module shared/storage/presetStore
 * @description IndexedDB-backed store for Export tab column presets and per-entity
 * last-used selections.
 *
 * Mirrors {@link module:shared/storage/auditStore}: a lazily-opened, reused
 * connection, a {@link https://github.com/jakearchibald/idb | idb} `DBSchema`, and
 * a singleton export ({@link presetStore}). Every method is fire-and-forget —
 * failures are logged and never propagate, and reads degrade to `[]`/`null`. Only
 * non-sensitive UI preferences are stored here (column ids, an optional filter
 * string); never credentials or PII.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { createLogger } from '../utils/logger';

const log = createLogger('PresetStore');

/** A named, saved column selection for one entity's export. */
export interface ExportPreset {
  /** Stable record id (`crypto.randomUUID()`); the object-store key. */
  id: string;
  /** The {@link EntityExport.id} this preset belongs to (indexed). */
  entityId: string;
  /** Admin-chosen preset name (e.g. "Offboarding audit"). */
  name: string;
  /** Enabled column ids, resolved against the descriptor catalog on load. */
  enabledColumnIds: string[];
  /** Optional saved raw filter expression. */
  filterText?: string;
  /** When the preset was created. */
  createdAt: Date;
  /** Per-record schema version, for forward migration without a DB bump. */
  version: 1;
}

/**
 * The most-recent column selection for one entity, restored on next visit.
 *
 * Deliberately holds no filter text: a raw filter expression may carry PII, so it
 * is persisted only in explicit, individually-deletable {@link ExportPreset}s — not
 * auto-saved here (see the "store no more than needed" hard rule).
 */
export interface LastUsed {
  /** The {@link EntityExport.id}; the object-store key (one row per entity). */
  entityId: string;
  /** Enabled column ids from the last export. */
  enabledColumnIds: string[];
  /** When it was last updated. */
  updatedAt: Date;
}

interface ExportDB extends DBSchema {
  presets: {
    key: string;
    value: ExportPreset;
    indexes: { entityId: string };
  };
  lastUsed: {
    key: string;
    value: LastUsed;
  };
}

const DB_NAME = 'okta-unbound-export';
const DB_VERSION = 1;
const PRESETS_STORE = 'presets';
const LAST_USED_STORE = 'lastUsed';

/**
 * IndexedDB store for export presets + last-used selections. Prefer the shared
 * {@link presetStore} singleton over constructing new instances.
 */
class PresetStore {
  private dbPromise: Promise<IDBPDatabase<ExportDB>> | null = null;

  private async getDB(): Promise<IDBPDatabase<ExportDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<ExportDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(PRESETS_STORE)) {
            const presets = db.createObjectStore(PRESETS_STORE, { keyPath: 'id' });
            presets.createIndex('entityId', 'entityId');
          }
          if (!db.objectStoreNames.contains(LAST_USED_STORE)) {
            db.createObjectStore(LAST_USED_STORE, { keyPath: 'entityId' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * List saved presets for one entity, newest first.
   *
   * @param entityId - The {@link EntityExport.id}.
   * @returns The entity's presets, or `[]` on any failure.
   */
  async listPresets(entityId: string): Promise<ExportPreset[]> {
    try {
      const db = await this.getDB();
      const presets = await db.getAllFromIndex(PRESETS_STORE, 'entityId', entityId);
      return presets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      log.error('Failed to list presets:', error);
      return [];
    }
  }

  /**
   * Save a new preset. Assigns the id, `createdAt`, and `version`.
   *
   * @param input - Entity id, name, enabled column ids, and optional filter text.
   * @returns The stored preset, or `null` on failure.
   */
  async savePreset(
    input: Pick<ExportPreset, 'entityId' | 'name' | 'enabledColumnIds' | 'filterText'>,
  ): Promise<ExportPreset | null> {
    try {
      const db = await this.getDB();
      const preset: ExportPreset = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        version: 1,
      };
      await db.put(PRESETS_STORE, preset);
      return preset;
    } catch (error) {
      log.error('Failed to save preset:', error);
      return null;
    }
  }

  /**
   * Delete a preset by id.
   *
   * @param id - The preset's {@link ExportPreset.id}.
   */
  async deletePreset(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete(PRESETS_STORE, id);
    } catch (error) {
      log.error('Failed to delete preset:', error);
    }
  }

  /**
   * Read the last-used selection for an entity.
   *
   * @param entityId - The {@link EntityExport.id}.
   * @returns The last-used record, or `null` when absent or on failure.
   */
  async getLastUsed(entityId: string): Promise<LastUsed | null> {
    try {
      const db = await this.getDB();
      return (await db.get(LAST_USED_STORE, entityId)) ?? null;
    } catch (error) {
      log.error('Failed to read last-used selection:', error);
      return null;
    }
  }

  /**
   * Upsert the last-used selection for an entity (keyed by `entityId`).
   *
   * @param entityId - The {@link EntityExport.id}.
   * @param enabledColumnIds - Enabled column ids from the export just run.
   */
  async setLastUsed(entityId: string, enabledColumnIds: string[]): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put(LAST_USED_STORE, {
        entityId,
        enabledColumnIds,
        updatedAt: new Date(),
      });
    } catch (error) {
      log.error('Failed to save last-used selection:', error);
    }
  }
}

/** Shared export-preset store singleton — use this rather than `new PresetStore()`. */
export const presetStore = new PresetStore();
export default presetStore;
