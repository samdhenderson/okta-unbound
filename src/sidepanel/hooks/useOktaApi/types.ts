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
  OktaFactor,
  MemberMfaResult,
  MfaScanStatus,
} from '../../../shared/types';

export type {
  MessageRequest,
  MessageResponse,
  OktaUser,
  UserStatus,
  AuditLogEntry,
  OktaApp,
  OktaFactor,
  MemberMfaResult,
  MfaScanStatus,
};

/**
 * Callbacks operations use to stream feedback to the UI as work proceeds.
 */
export interface OperationCallbacks {
  /** Emit a discrete status line (toast/log). `type` maps to the status vocabulary (note: `error`, not `danger`, at this layer). */
  onResult?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  /** Report progress toward completion; `apiCalls` optionally surfaces the running API-request count. */
  onProgress?: (current: number, total: number, message: string, apiCalls?: number) => void;
}

/**
 * Options accepted by the `useOktaApi` hook.
 *
 * @remarks Carries the target tab plus the same `onResult`/`onProgress` callbacks
 * that {@link OperationCallbacks} exposes to operations.
 */
export interface UseOktaApiOptions {
  /** Content-script tab connected to Okta, or `null` when no Okta page is attached. */
  targetTabId: number | null;
  /** See {@link OperationCallbacks.onResult}. */
  onResult?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  /** See {@link OperationCallbacks.onProgress}. */
  onProgress?: (current: number, total: number, message: string, apiCalls?: number) => void;
}
