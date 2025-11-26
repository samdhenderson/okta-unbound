/**
 * Shared types for Apps tab components
 *
 * This file contains type definitions shared across the Apps tab sub-components.
 * Keep types here to avoid circular dependencies and maintain a single source of truth.
 */

import type {
  UserAppAssignment,
  GroupAppAssignment,
  AssignmentConversionResult,
  AppAssignmentSecurityAnalysis,
  AssignmentRecommenderResult,
} from '../../../shared/types';

// User entity for search/selection
export interface SelectedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  login: string;
  status: string;
}

// Group entity for search/selection
export interface SelectedGroup {
  id: string;
  name: string;
  description: string;
  type: string;
}

// Preview data for conversion
export interface ConversionPreviewData {
  appId: string;
  appName: string;
  userProfile: Record<string, any>;
  groupProfile: Record<string, any>;
  mergedProfile: Record<string, any>;
  differences: Array<{
    field: string;
    userValue: any;
    groupValue: any;
    mergedValue: any;
    fieldType: string;
  }>;
  warnings: string[];
}

// Merge strategy options
export type MergeStrategy = 'preserve_user' | 'prefer_user' | 'prefer_default';

// Sub-tab types
export type AppSubTab = 'viewer' | 'converter' | 'security' | 'bulk' | 'recommender';

// Common props passed to sub-components
export interface AppSubTabProps {
  groupId?: string;
  groupName?: string;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setResultMessage: (message: { text: string; type: 'info' | 'success' | 'warning' | 'error' } | null) => void;
}

// Re-export types from shared
export type {
  UserAppAssignment,
  GroupAppAssignment,
  AssignmentConversionResult,
  AppAssignmentSecurityAnalysis,
  AssignmentRecommenderResult,
};
