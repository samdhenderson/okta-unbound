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
  ResultType,
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
  ResultType,
};

/**
 * One user-facing status line emitted by an operation.
 *
 * @remarks
 * Deliberately an **object**, not a positional `(message, type)` pair. TypeScript
 * lets a function ignore trailing parameters, so a one-argument
 * `(message: string) => void` was assignable to the old positional signature: the
 * `type` was silently dropped and every line rendered as a danger banner (live in
 * `RulesTab`, where `captureRuleImpact`'s `'info'` pagination lines showed as
 * errors; fixed at the three call sites in `a2f17a4`). With a single object
 * parameter `string` is not assignable to {@link OperationResult}, so `tsc`
 * rejects the mistake instead of the UI absorbing it.
 */
export interface OperationResult {
  /** The line to show the user. */
  message: string;
  /** Severity, in this layer's vocabulary (note: `error`, not `danger`). */
  type: ResultType;
}

/**
 * Callbacks operations use to stream feedback to the UI as work proceeds.
 */
export interface OperationCallbacks {
  /** Emit a discrete status line (toast/log). See {@link OperationResult}. */
  onResult?: (result: OperationResult) => void;
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
  onResult?: (result: OperationResult) => void;
  /** See {@link OperationCallbacks.onProgress}. */
  onProgress?: (current: number, total: number, message: string, apiCalls?: number) => void;
}
