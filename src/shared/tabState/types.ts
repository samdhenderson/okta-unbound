/**
 * Tab State Persistence Types
 *
 * Defines types for persisting and restoring UI state across tab navigation.
 */

export type TabName = 'overview' | 'rules' | 'users' | 'groups' | 'history';

export interface BaseTabState {
  lastVisited: number;
  scrollPosition: number;
}

export interface RulesTabState extends BaseTabState {
  searchQuery: string;
  activeFilter: 'all' | 'active' | 'conflicts' | 'current-group';
  cachedRules: any[] | null;
  cachedStats: any | null;
  lastFetchTime: string | null;
}

export interface UsersTabState extends BaseTabState {
  searchQuery: string;
  statusFilter: string;
  sortBy: 'name' | 'status' | 'email';
  sortDirection: 'asc' | 'desc';
  selectedUserIds: string[];
  expandedUserId: string | null;
}

export interface GroupsTabState extends BaseTabState {
  searchQuery: string;
  typeFilter: string;
  sizeFilter: string;
  sortBy: 'name' | 'memberCount' | 'lastUpdated';
  selectedGroupIds: string[];
  cachedGroups: any[] | null;
  cacheTimestamp: number | null;
}

export interface HistoryTabState extends BaseTabState {
  expandedEntryId: string | null;
}

export interface AllTabStates {
  overview: BaseTabState | null;
  rules: RulesTabState | null;
  users: UsersTabState | null;
  groups: GroupsTabState | null;
  history: HistoryTabState | null;
}

export interface StatePersistOptions {
  ttl?: number;
  skipCache?: boolean;
}

export interface StoredStateMetadata {
  version: number;
  lastUpdated: number;
  expiresAt: number | null;
}
