/**
 * @module shared/tabState/types
 * @description Types for persisting and restoring per-tab UI state.
 *
 * Defines the {@link TabName} union, the {@link BaseTabState} common fields, each
 * tab's state shape, and the stored-metadata envelope. Consumed by
 * `TabStateManager`.
 */

import type { FormattedRule, RuleStats, GroupSummary } from '../types';

/** Identifiers for the side-panel tabs whose state is persisted. */
export type TabName = 'overview' | 'rules' | 'users' | 'groups' | 'history';

/** Fields common to every persisted tab state. */
export interface BaseTabState {
  lastVisited: number;
  scrollPosition: number;
}

/** Persisted state for the Rules tab (search, filter, and cached rules). */
export interface RulesTabState extends BaseTabState {
  searchQuery: string;
  activeFilter: 'all' | 'active' | 'conflicts' | 'current-group';
  cachedRules: FormattedRule[] | null;
  cachedStats: RuleStats | null;
  lastFetchTime: string | null;
}

/** Persisted state for the Users tab (search, sort, selection, expansion). */
export interface UsersTabState extends BaseTabState {
  searchQuery: string;
  statusFilter: string;
  sortBy: 'name' | 'status' | 'email';
  sortDirection: 'asc' | 'desc';
  selectedUserIds: string[];
  expandedUserId: string | null;
}

/** Persisted state for the Groups tab (filters, sort, selection, cached groups). */
export interface GroupsTabState extends BaseTabState {
  searchQuery: string;
  typeFilter: string;
  sizeFilter: string;
  sortBy: 'name' | 'memberCount' | 'lastUpdated';
  selectedGroupIds: string[];
  cachedGroups: GroupSummary[] | null;
  cacheTimestamp: number | null;
}

/** Persisted state for the History tab (which entry is expanded). */
export interface HistoryTabState extends BaseTabState {
  expandedEntryId: string | null;
}

/** Aggregate of every tab's persisted state, each `null` when absent. */
export interface AllTabStates {
  overview: BaseTabState | null;
  rules: RulesTabState | null;
  users: UsersTabState | null;
  groups: GroupsTabState | null;
  history: HistoryTabState | null;
}

/** Options controlling how tab state is persisted. */
export interface StatePersistOptions {
  /** Lifetime in ms before the state expires (default 30 min). */
  ttl?: number;
  skipCache?: boolean;
}

/** Metadata embedded alongside stored state for versioning and expiry. */
export interface StoredStateMetadata {
  /** Schema version; a mismatch invalidates the stored state. */
  version: number;
  /** Epoch millis of the last write. */
  lastUpdated: number;
  /** Epoch millis when the state expires, or `null` for no expiry. */
  expiresAt: number | null;
}
