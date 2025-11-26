/**
 * Types and interfaces for useOktaApi hook
 *
 * This file contains all type definitions used across the useOktaApi modules.
 * Centralizing types here prevents circular dependencies and provides
 * a single source of truth.
 */

import type {
  MessageRequest,
  MessageResponse,
  OktaUser,
  UserStatus,
  OktaApp,
  UserAppAssignment,
  GroupAppAssignment,
  CreateAppAssignmentRequest,
  AssignmentConversionRequest,
  AssignmentConversionResult,
  BulkAppAssignmentRequest,
  BulkAppAssignmentResult,
  AppAssignmentSecurityAnalysis,
  AssignmentRecommenderResult,
  AppProfileSchema,
} from '../../../shared/types';

// Hook configuration options
export interface UseOktaApiOptions {
  targetTabId: number | null;
  onResult?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onProgress?: (current: number, total: number, message: string, apiCalls?: number) => void;
}

// API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  headers?: Record<string, string>;
}

// User search result
export interface UserSearchResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  login: string;
  status: string;
}

// Group search result
export interface GroupSearchResult {
  id: string;
  name: string;
  description: string;
  type: string;
}

// Bulk operation result
export interface BulkOperationResult {
  success: boolean;
  message: string;
  processed: number;
  failed: number;
  errors: string[];
}

// Group member with details
export interface GroupMemberDetails {
  id: string;
  status: string;
  profile: {
    email?: string;
    firstName?: string;
    lastName?: string;
    login?: string;
    [key: string]: any;
  };
}

// App assignment details
export interface AppAssignmentDetails {
  app: OktaApp;
  schema?: AppProfileSchema;
}

// Cross-group search result
export interface CrossGroupUserSearchResult {
  userId: string;
  email: string;
  displayName: string;
  status: string;
  groups: Array<{
    groupId: string;
    groupName: string;
  }>;
}

// Re-export shared types for convenience
export type {
  MessageRequest,
  MessageResponse,
  OktaUser,
  UserStatus,
  OktaApp,
  UserAppAssignment,
  GroupAppAssignment,
  CreateAppAssignmentRequest,
  AssignmentConversionRequest,
  AssignmentConversionResult,
  BulkAppAssignmentRequest,
  BulkAppAssignmentResult,
  AppAssignmentSecurityAnalysis,
  AssignmentRecommenderResult,
  AppProfileSchema,
};
