/**
 * @module shared/storage/profileDisplayStore
 * @description IndexedDB-backed store for the admin-authored profile display
 * configuration, one record per Okta org.
 *
 * Mirrors {@link module:shared/storage/presetStore}: a lazily-opened, reused
 * connection, an {@link https://github.com/jakearchibald/idb | idb} `DBSchema`, and
 * a singleton export ({@link profileDisplayStore}). Every method is
 * fire-and-forget — failures are logged and never propagate, and a failed read
 * degrades to "no saved config" (`null`) so the caller falls back to
 * {@link DEFAULT_PROFILE_DISPLAY_CONFIG}.
 *
 * IndexedDB rather than `chrome.storage.sync`: the config carries an order array
 * plus an assignment map over the org's whole profile schema, which approaches
 * `sync`'s 8KB per-item cap, and nothing in this extension reads `storage.sync`.
 *
 * The stored value is an admin's *view preference*, not org data — but the
 * attribute names and category labels inside it are admin-authored and may echo
 * org-specific vocabulary, so **nothing in this module ever logs a category name,
 * an attribute name, or an attribute value**: identifiers and outcomes only
 * (see `docs/security.md`).
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { createLogger } from '../utils/logger';

const log = createLogger('ProfileDisplayStore');

/** One admin-defined category that profile attributes can be assigned to. */
export interface ProfileDisplayCategory {
  /** Stable identifier referenced by {@link ProfileDisplayConfig.assign}. */
  key: string;
  /** Admin-facing label (e.g. "Account state"). */
  name: string;
}

/** How one admin wants profiles rendered in this org. */
export interface ProfileDisplayConfig {
  /** Presentation of the attribute list. */
  layout: 'rows' | 'compact' | 'grid';
  /** Show the raw Okta profile key alongside each attribute's label. */
  showApiNames: boolean;
  /** Show the "set by a group rule" chips. */
  showRuleChips: boolean;
  /** Render attributes whose value is empty. */
  showEmpty: boolean;
  /** Categories, in display order. Order is the array order. */
  categories: ProfileDisplayCategory[];
  /** attribute name -> category key. '' means uncategorized. */
  assign: Record<string, string>;
  /** Attribute names in the admin's global order. */
  attrOrder: string[];
  /** attribute name -> hidden. Absent or `false` means visible. */
  hidden: Record<string, boolean>;
}

/**
 * The per-org record actually written to IndexedDB: the config plus the
 * bookkeeping needed to migrate it later without a DB version bump.
 */
export interface StoredProfileDisplay {
  /** Okta org origin (e.g. `https://example.okta.com`); the object-store key. */
  oktaOrigin: string;
  /** The admin's configuration for this org. */
  config: ProfileDisplayConfig;
  /** When the config was last written. */
  updatedAt: Date;
  /** Per-record schema version, for forward migration without a DB bump. */
  version: 1;
}

/**
 * The starting configuration for an org that has never been configured: the
 * five built-in categories, rows layout, rule chips on, API names and empty
 * attributes off. Attribute placement starts empty, so every attribute the org
 * actually has shows up as uncategorized until the admin files it.
 *
 * Category keys are stable kebab-case ids — the labels may be renamed by the
 * admin, the keys never change.
 */
export const DEFAULT_PROFILE_DISPLAY_CONFIG: ProfileDisplayConfig = {
  layout: 'rows',
  showApiNames: false,
  showRuleChips: true,
  showEmpty: false,
  categories: [
    { key: 'identity', name: 'Identity' },
    { key: 'organization', name: 'Organization' },
    { key: 'account-state', name: 'Account state' },
    { key: 'contact-locale', name: 'Contact & locale' },
    { key: 'custom', name: 'Custom attributes' },
  ],
  assign: {},
  attrOrder: [],
  hidden: {},
};

interface ProfileDisplayDB extends DBSchema {
  configs: {
    key: string;
    value: StoredProfileDisplay;
  };
}

const DB_NAME = 'okta-unbound-profile-display';
const DB_VERSION = 1;
const CONFIGS_STORE = 'configs';

/**
 * IndexedDB store for per-org profile display configurations. Prefer the shared
 * {@link profileDisplayStore} singleton over constructing new instances.
 */
class ProfileDisplayStore {
  private dbPromise: Promise<IDBPDatabase<ProfileDisplayDB>> | null = null;

  private async getDB(): Promise<IDBPDatabase<ProfileDisplayDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<ProfileDisplayDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(CONFIGS_STORE)) {
            db.createObjectStore(CONFIGS_STORE, { keyPath: 'oktaOrigin' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * Read the saved configuration for one org.
   *
   * @param oktaOrigin - Okta org origin (e.g. `https://example.okta.com`).
   * @returns The stored config, or `null` when the org has none *or* the read
   *   failed — callers treat both as "fall back to
   *   {@link DEFAULT_PROFILE_DISPLAY_CONFIG}".
   */
  async getConfig(oktaOrigin: string): Promise<ProfileDisplayConfig | null> {
    try {
      const db = await this.getDB();
      const record = await db.get(CONFIGS_STORE, oktaOrigin);
      return record?.config ?? null;
    } catch (error) {
      log.error('Failed to read profile display config:', error);
      return null;
    }
  }

  /**
   * Upsert the configuration for one org (one record per origin).
   *
   * @param oktaOrigin - Okta org origin (e.g. `https://example.okta.com`).
   * @param config - The configuration to persist, stored verbatim — including
   *   placements for attributes not currently in the schema, so a transiently
   *   missing attribute keeps its position.
   */
  async saveConfig(oktaOrigin: string, config: ProfileDisplayConfig): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put(CONFIGS_STORE, {
        oktaOrigin,
        config,
        updatedAt: new Date(),
        version: 1,
      });
    } catch (error) {
      log.error('Failed to save profile display config:', error);
    }
  }

  /**
   * Delete the configuration for one org, returning it to the defaults.
   *
   * @param oktaOrigin - Okta org origin (e.g. `https://example.okta.com`).
   */
  async clearConfig(oktaOrigin: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete(CONFIGS_STORE, oktaOrigin);
    } catch (error) {
      log.error('Failed to clear profile display config:', error);
    }
  }
}

/**
 * Shared profile-display store singleton — use this rather than
 * `new ProfileDisplayStore()`.
 */
export const profileDisplayStore = new ProfileDisplayStore();
export default profileDisplayStore;
