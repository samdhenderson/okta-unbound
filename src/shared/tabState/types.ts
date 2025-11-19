/**
 * Tab State Persistence Types
 *
 * Defines types for persisting and restoring UI state across tab navigation.
 * This prevents unnecessary re-fetching and maintains user context.
 */

export type TabName = 'dashboard' | 'operations' | 'rules' | 'users' | 'security' | 'groups' | 'undo';

/**
 * Base tab state - common to all tabs
 */
export interface BaseTabState {
  lastVisited: number; // Timestamp
  scrollPosition: number;
}

/**
 * Rules tab state
 */
export interface RulesTabState extends BaseTabState {
  searchQuery: string;
  activeFilter: 'all' | 'active' | 'conflicts' | 'current-group';
  cachedRules: any[] | null;
  cachedStats: any | null;
  lastFetchTime: string | null;
}

/**
 * Users tab state
 */
export interface UsersTabState extends BaseTabState {
  searchQuery: string;
  statusFilter: string;
  sortBy: 'name' | 'status' | 'email';
  sortDirection: 'asc' | 'desc';
  selectedUserIds: string[];
  expandedUserId: string | null;
}

/**
 * Groups tab state
 */
export interface GroupsTabState extends BaseTabState {
  viewMode: 'browse' | 'search' | 'bulk' | 'compare';
  searchQuery: string;
  typeFilter: string;
  sizeFilter: string;
  sortBy: 'name' | 'memberCount' | 'lastUpdated';
  selectedGroupIds: string[];
  cachedGroups: any[] | null;
  cacheTimestamp: number | null;
}

/**
 * Dashboard tab state
 */
export interface DashboardTabState extends BaseTabState {
  activeWidget: string | null;
  expandedSections: string[];
}

/**
 * Operations tab state
 */
export interface OperationsTabState extends BaseTabState {
  selectedOperation: string | null;
  lastOperation: string | null;
  outputLog: string[];
}

/**
 * Security tab state
 */
export interface SecurityTabState extends BaseTabState {
  activeView: 'findings' | 'orphaned' | 'stale';
  selectedFindings: string[];
  cachedFindings: any[] | null;
  cacheTimestamp: number | null;
}

/**
 * Undo tab state
 */
export interface UndoTabState extends BaseTabState {
  expandedEntryId: string | null;
}

/**
 * Complete tab state collection
 */
export interface AllTabStates {
  dashboard: DashboardTabState | null;
  operations: OperationsTabState | null;
  rules: RulesTabState | null;
  users: UsersTabState | null;
  security: SecurityTabState | null;
  groups: GroupsTabState | null;
  undo: UndoTabState | null;
}

/**
 * State persistence options
 */
export interface StatePersistOptions {
  ttl?: number; // How long state is valid (ms), null = forever
  skipCache?: boolean; // Don't persist cached data (rules, groups, etc.)
}

/**
 * Stored state metadata
 */
export interface StoredStateMetadata {
  version: number; // Schema version for migrations
  lastUpdated: number;
  expiresAt: number | null;
}
