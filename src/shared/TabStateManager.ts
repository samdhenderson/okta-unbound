/**
 * TabStateManager - Persistent state management for tab search/filter preferences
 *
 * Stores and retrieves tab-specific state (search queries, filters, scroll position, etc.)
 * across browser sessions using Chrome's storage API.
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY_PREFIX = 'tab_state_';
const STATE_VERSION = 1;

export interface TabState {
  version: number;
  timestamp: number;
  searchQuery?: string;
  filters?: Record<string, any>;
  scrollPosition?: number;
  expandedSections?: string[];
  selectedItems?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: any; // Allow custom properties
}

export class TabStateManager {
  private tabName: string;
  private storageKey: string;

  constructor(tabName: string) {
    this.tabName = tabName;
    this.storageKey = `${STORAGE_KEY_PREFIX}${tabName}`;
  }

  /**
   * Save tab state to storage
   */
  async saveState(state: Partial<TabState>): Promise<void> {
    try {
      const currentState = await this.getState();
      const newState: TabState = {
        ...currentState,
        ...state,
        version: STATE_VERSION,
        timestamp: Date.now(),
      };

      await chrome.storage.local.set({ [this.storageKey]: newState });
      console.log(`[TabStateManager] Saved state for ${this.tabName}:`, newState);
    } catch (error) {
      console.error(`[TabStateManager] Failed to save state for ${this.tabName}:`, error);
    }
  }

  /**
   * Get tab state from storage
   */
  async getState(): Promise<TabState> {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      const state = result[this.storageKey] as TabState | undefined;

      // Return state if valid, otherwise return default
      if (state && state.version === STATE_VERSION) {
        console.log(`[TabStateManager] Loaded state for ${this.tabName}:`, state);
        return state;
      }

      // Return default state
      return {
        version: STATE_VERSION,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[TabStateManager] Failed to get state for ${this.tabName}:`, error);
      return {
        version: STATE_VERSION,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Update specific property in state
   */
  async updateProperty<K extends keyof TabState>(key: K, value: TabState[K]): Promise<void> {
    const currentState = await this.getState();
    await this.saveState({
      ...currentState,
      [key]: value,
    });
  }

  /**
   * Clear tab state
   */
  async clearState(): Promise<void> {
    try {
      await chrome.storage.local.remove(this.storageKey);
      console.log(`[TabStateManager] Cleared state for ${this.tabName}`);
    } catch (error) {
      console.error(`[TabStateManager] Failed to clear state for ${this.tabName}:`, error);
    }
  }

  /**
   * Check if state is stale (older than specified duration)
   */
  async isStale(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<boolean> {
    const state = await this.getState();
    return Date.now() - state.timestamp > maxAgeMs;
  }
}

/**
 * Hook-like utility for React components
 */
export const createTabStateHook = (tabName: string) => {
  const manager = new TabStateManager(tabName);

  return {
    manager,
    saveState: (state: Partial<TabState>) => manager.saveState(state),
    getState: () => manager.getState(),
    updateProperty: <K extends keyof TabState>(key: K, value: TabState[K]) =>
      manager.updateProperty(key, value),
    clearState: () => manager.clearState(),
  };
};

/**
 * Global state manager registry
 */
class TabStateRegistry {
  private managers: Map<string, TabStateManager> = new Map();

  getManager(tabName: string): TabStateManager {
    if (!this.managers.has(tabName)) {
      this.managers.set(tabName, new TabStateManager(tabName));
    }
    return this.managers.get(tabName)!;
  }

  async clearAllStates(): Promise<void> {
    const keys = await chrome.storage.local.getKeys();
    const stateKeys = keys.filter(key => key.startsWith(STORAGE_KEY_PREFIX));
    await chrome.storage.local.remove(stateKeys);
    console.log('[TabStateRegistry] Cleared all tab states');
  }
}

export const tabStateRegistry = new TabStateRegistry();

/**
 * React hook for managing tab state
 */
export function useTabState(tabName: string) {
  const manager = tabStateRegistry.getManager(tabName);

  const [state, setState] = useState<TabState>(() => ({
    version: STATE_VERSION,
    timestamp: Date.now(),
  }));
  const [isLoading, setIsLoading] = useState(true);

  // Load initial state
  useEffect(() => {
    const loadState = async () => {
      const loadedState = await manager.getState();
      setState(loadedState);
      setIsLoading(false);
    };
    loadState();
  }, [manager]);

  // Save search query
  const setSearchQuery = useCallback(async (query: string) => {
    await manager.updateProperty('searchQuery', query);
    setState((prev: TabState) => ({ ...prev, searchQuery: query }));
  }, [manager]);

  // Save filters
  const setFilters = useCallback(async (filters: Record<string, unknown>) => {
    await manager.updateProperty('filters', filters);
    setState((prev: TabState) => ({ ...prev, filters }));
  }, [manager]);

  // Save scroll position
  const setScrollPosition = useCallback(async (position: number) => {
    await manager.updateProperty('scrollPosition', position);
    setState((prev: TabState) => ({ ...prev, scrollPosition: position }));
  }, [manager]);

  // Update any property
  const updateState = useCallback(async (updates: Partial<TabState>) => {
    await manager.saveState(updates);
    setState((prev: TabState) => ({ ...prev, ...updates }));
  }, [manager]);

  // Clear state
  const clearState = useCallback(async () => {
    await manager.clearState();
    setState({
      version: STATE_VERSION,
      timestamp: Date.now(),
    });
  }, [manager]);

  return {
    state,
    isLoading,
    setSearchQuery,
    setFilters,
    setScrollPosition,
    updateState,
    clearState,
  };
}

