/**
 * Tab State Manager
 *
 * Manages persistence and restoration of UI state across tab navigation.
 * Prevents unnecessary re-fetching and maintains user context when switching tabs.
 *
 * State is stored in chrome.storage.local with:
 * - Per-tab state isolation
 * - TTL-based expiration
 * - Automatic cleanup of stale state
 * - Migration support for schema changes
 */

import type {
  TabName,
  AllTabStates,
  BaseTabState,
  RulesTabState,
  UsersTabState,
  GroupsTabState,
  DashboardTabState,
  OperationsTabState,
  SecurityTabState,
  StatePersistOptions,
  StoredStateMetadata,
} from './types';

const STORAGE_KEY_PREFIX = 'tab_state_';
const STATE_VERSION = 1;
const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes

export class TabStateManager {
  /**
   * Save state for a specific tab
   */
  static async saveTabState<T extends BaseTabState>(
    tabName: TabName,
    state: T,
    options: StatePersistOptions = {}
  ): Promise<void> {
    const ttl = options.ttl ?? DEFAULT_TTL;
    const now = Date.now();

    const metadata: StoredStateMetadata = {
      version: STATE_VERSION,
      lastUpdated: now,
      expiresAt: ttl ? now + ttl : null,
    };

    const storageKey = `${STORAGE_KEY_PREFIX}${tabName}`;
    const storageValue = {
      ...state,
      _metadata: metadata,
    };

    try {
      await chrome.storage.local.set({ [storageKey]: storageValue });
      console.log(`[TabStateManager] Saved state for tab: ${tabName}`, {
        ttl: ttl ? `${ttl / 1000}s` : 'forever',
        expiresAt: metadata.expiresAt ? new Date(metadata.expiresAt).toISOString() : 'never',
      });
    } catch (error) {
      console.error(`[TabStateManager] Failed to save state for tab: ${tabName}`, error);
    }
  }

  /**
   * Load state for a specific tab
   */
  static async loadTabState<T extends BaseTabState>(
    tabName: TabName
  ): Promise<T | null> {
    const storageKey = `${STORAGE_KEY_PREFIX}${tabName}`;

    try {
      const result = await chrome.storage.local.get([storageKey]);
      const stored = result[storageKey] as any;

      if (!stored || typeof stored !== 'object') {
        console.log(`[TabStateManager] No state found for tab: ${tabName}`);
        return null;
      }

      const metadata: StoredStateMetadata = stored._metadata;

      // Check version
      if (metadata.version !== STATE_VERSION) {
        console.warn(`[TabStateManager] State version mismatch for tab: ${tabName}. Clearing.`);
        await this.clearTabState(tabName);
        return null;
      }

      // Check expiration
      if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
        console.log(`[TabStateManager] State expired for tab: ${tabName}`);
        await this.clearTabState(tabName);
        return null;
      }

      // Remove metadata before returning
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _metadata, ...state } = stored;

      console.log(`[TabStateManager] Loaded state for tab: ${tabName}`, {
        age: `${Math.round((Date.now() - metadata.lastUpdated) / 1000)}s`,
      });

      return state as T;
    } catch (error) {
      console.error(`[TabStateManager] Failed to load state for tab: ${tabName}`, error);
      return null;
    }
  }

  /**
   * Clear state for a specific tab
   */
  static async clearTabState(tabName: TabName): Promise<void> {
    const storageKey = `${STORAGE_KEY_PREFIX}${tabName}`;

    try {
      await chrome.storage.local.remove([storageKey]);
      console.log(`[TabStateManager] Cleared state for tab: ${tabName}`);
    } catch (error) {
      console.error(`[TabStateManager] Failed to clear state for tab: ${tabName}`, error);
    }
  }

  /**
   * Clear all tab states
   */
  static async clearAllTabStates(): Promise<void> {
    try {
      const allKeys = await chrome.storage.local.get(null);
      const tabStateKeys = Object.keys(allKeys).filter((key) =>
        key.startsWith(STORAGE_KEY_PREFIX)
      );

      if (tabStateKeys.length > 0) {
        await chrome.storage.local.remove(tabStateKeys);
        console.log(`[TabStateManager] Cleared ${tabStateKeys.length} tab states`);
      }
    } catch (error) {
      console.error('[TabStateManager] Failed to clear all tab states', error);
    }
  }

  /**
   * Get all tab states
   */
  static async getAllTabStates(): Promise<Partial<AllTabStates>> {
    const tabNames: TabName[] = ['dashboard', 'operations', 'rules', 'users', 'security', 'groups', 'undo'];
    const states: Partial<AllTabStates> = {};

    for (const tabName of tabNames) {
      const state = await this.loadTabState(tabName);
      if (state) {
        (states as any)[tabName] = state;
      }
    }

    return states;
  }

  /**
   * Update scroll position for a tab
   */
  static async updateScrollPosition(tabName: TabName, scrollPosition: number): Promise<void> {
    const currentState = await this.loadTabState(tabName);
    if (currentState) {
      await this.saveTabState(tabName, {
        ...currentState,
        scrollPosition,
        lastVisited: Date.now(),
      });
    }
  }

  /**
   * Mark tab as visited
   */
  static async markTabVisited(tabName: TabName): Promise<void> {
    const currentState = await this.loadTabState(tabName);
    if (currentState) {
      await this.saveTabState(tabName, {
        ...currentState,
        lastVisited: Date.now(),
      });
    }
  }

  /**
   * Clean up expired states
   */
  static async cleanupExpiredStates(): Promise<void> {
    try {
      const allKeys = await chrome.storage.local.get(null);
      const now = Date.now();
      const keysToRemove: string[] = [];

      for (const [key, value] of Object.entries(allKeys)) {
        if (key.startsWith(STORAGE_KEY_PREFIX) && value && typeof value === 'object') {
          const metadata = (value as any)._metadata as StoredStateMetadata | undefined;
          if (metadata && metadata.expiresAt && now > metadata.expiresAt) {
            keysToRemove.push(key);
          }
        }
      }

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`[TabStateManager] Cleaned up ${keysToRemove.length} expired states`);
      }
    } catch (error) {
      console.error('[TabStateManager] Failed to cleanup expired states', error);
    }
  }

  /**
   * Get state age in milliseconds
   */
  static async getStateAge(tabName: TabName): Promise<number | null> {
    const storageKey = `${STORAGE_KEY_PREFIX}${tabName}`;

    try {
      const result = await chrome.storage.local.get([storageKey]);
      const stored = result[storageKey] as any;

      if (!stored || !stored._metadata) {
        return null;
      }

      return Date.now() - stored._metadata.lastUpdated;
    } catch (error) {
      console.error(`[TabStateManager] Failed to get state age for tab: ${tabName}`, error);
      return null;
    }
  }

  /**
   * Check if state exists and is valid
   */
  static async hasValidState(tabName: TabName): Promise<boolean> {
    const state = await this.loadTabState(tabName);
    return state !== null;
  }

  /**
   * Get storage usage info
   */
  static async getStorageInfo(): Promise<{
    totalStates: number;
    totalBytes: number;
    states: Array<{ tabName: string; age: number; size: number }>;
  }> {
    try {
      const allKeys = await chrome.storage.local.get(null);
      const tabStateEntries = Object.entries(allKeys).filter(([key]) =>
        key.startsWith(STORAGE_KEY_PREFIX)
      );

      const states = tabStateEntries.map(([key, value]) => {
        const tabName = key.replace(STORAGE_KEY_PREFIX, '');
        const metadata = (value as any)._metadata as StoredStateMetadata;
        const size = JSON.stringify(value).length;
        const age = metadata ? Date.now() - metadata.lastUpdated : 0;

        return { tabName, age, size };
      });

      const totalBytes = states.reduce((sum, s) => sum + s.size, 0);

      return {
        totalStates: states.length,
        totalBytes,
        states,
      };
    } catch (error) {
      console.error('[TabStateManager] Failed to get storage info', error);
      return { totalStates: 0, totalBytes: 0, states: [] };
    }
  }
}

// Convenience functions for specific tab types

export async function saveRulesTabState(state: Partial<RulesTabState>): Promise<void> {
  const currentState = await TabStateManager.loadTabState<RulesTabState>('rules');
  const newState: RulesTabState = {
    lastVisited: Date.now(),
    scrollPosition: 0,
    searchQuery: '',
    activeFilter: 'all',
    cachedRules: null,
    cachedStats: null,
    lastFetchTime: null,
    ...currentState,
    ...state,
  };
  await TabStateManager.saveTabState('rules', newState);
}

export async function saveUsersTabState(state: Partial<UsersTabState>): Promise<void> {
  const currentState = await TabStateManager.loadTabState<UsersTabState>('users');
  const newState: UsersTabState = {
    lastVisited: Date.now(),
    scrollPosition: 0,
    searchQuery: '',
    statusFilter: '',
    sortBy: 'name',
    sortDirection: 'asc',
    selectedUserIds: [],
    expandedUserId: null,
    ...currentState,
    ...state,
  };
  await TabStateManager.saveTabState('users', newState);
}

export async function saveGroupsTabState(state: Partial<GroupsTabState>): Promise<void> {
  const currentState = await TabStateManager.loadTabState<GroupsTabState>('groups');
  const newState: GroupsTabState = {
    lastVisited: Date.now(),
    scrollPosition: 0,
    viewMode: 'browse',
    searchQuery: '',
    typeFilter: '',
    sizeFilter: '',
    sortBy: 'name',
    selectedGroupIds: [],
    cachedGroups: null,
    cacheTimestamp: null,
    ...currentState,
    ...state,
  };
  await TabStateManager.saveTabState('groups', newState);
}

export async function saveDashboardTabState(state: Partial<DashboardTabState>): Promise<void> {
  const currentState = await TabStateManager.loadTabState<DashboardTabState>('dashboard');
  const newState: DashboardTabState = {
    lastVisited: Date.now(),
    scrollPosition: 0,
    activeWidget: null,
    expandedSections: [],
    ...currentState,
    ...state,
  };
  await TabStateManager.saveTabState('dashboard', newState);
}

export async function saveOperationsTabState(state: Partial<OperationsTabState>): Promise<void> {
  const currentState = await TabStateManager.loadTabState<OperationsTabState>('operations');
  const newState: OperationsTabState = {
    lastVisited: Date.now(),
    scrollPosition: 0,
    selectedOperation: null,
    lastOperation: null,
    outputLog: [],
    ...currentState,
    ...state,
  };
  await TabStateManager.saveTabState('operations', newState);
}

export async function saveSecurityTabState(state: Partial<SecurityTabState>): Promise<void> {
  const currentState = await TabStateManager.loadTabState<SecurityTabState>('security');
  const newState: SecurityTabState = {
    lastVisited: Date.now(),
    scrollPosition: 0,
    activeView: 'findings',
    selectedFindings: [],
    cachedFindings: null,
    cacheTimestamp: null,
    ...currentState,
    ...state,
  };
  await TabStateManager.saveTabState('security', newState);
}
