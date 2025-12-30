/**
 * @module hooks/useOktaApi/types
 * @description Shared types for the modular useOktaApi hook
 */

import type {
  MessageRequest,
  MessageResponse,
  OktaUser,
  UserStatus,
  AuditLogEntry,
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
  AppProfileSchema
} from '../../../shared/types';

export type {
  MessageRequest,
  MessageResponse,
  OktaUser,
  UserStatus,
  AuditLogEntry,
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
  AppProfileSchema
};

/**
 * Callback functions for operation feedback
 */
export interface OperationCallbacks {
  onResult?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onProgress?: (current: number, total: number, message: string, apiCalls?: number) => void;
}

/**
 * Options for the useOktaApi hook
 */
export interface UseOktaApiOptions {
  targetTabId: number | null;
  onResult?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onProgress?: (current: number, total: number, message: string, apiCalls?: number) => void;
}
