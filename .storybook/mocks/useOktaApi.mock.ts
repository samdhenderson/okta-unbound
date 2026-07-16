/**
 * Storybook mock for the `useOktaApi` facade hook
 * (`src/sidepanel/hooks/useOktaApi.ts`).
 *
 * The real facade returns one flat, memoized object of run-state + ~40 operation
 * functions, each of which posts a message to the background ApiScheduler. None of
 * that exists in Storybook, so this module replaces the facade via a `$`-anchored
 * Vite alias in `.storybook/main.ts` (the anchor keeps the `useOktaApi/` directory
 * barrel untouched).
 *
 * Usage in a story:
 *   import { useOktaApi, makeUseOktaApiValue } from '<path>/.storybook/mocks/useOktaApi.mock';
 *   // Default variant: nothing to do — the spy returns a benign value.
 *   // Loading variant:
 *   beforeEach(() => { useOktaApi.mockReturnValue(makeUseOktaApiValue({ isLoading: true })); });
 *
 * This file lives outside `src`, so it is not linted by ESLint; it is, however,
 * pulled into `tsc` when a story imports it, so it must stay type-clean. `any` is
 * used deliberately to avoid re-deriving the ~40 real operation signatures.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { fn } from 'storybook/test';

/** A spy that resolves to `value` when awaited (the default shape for reads/writes). */
const asyncFn = (value?: any) => fn(async () => value);

/** Overridable slice of the flat `useOktaApi` return object. */
export type UseOktaApiValue = Record<string, any>;

/**
 * Build a complete, benign `useOktaApi` return value. Every operation is a fresh
 * spy so calls are observable in the Actions panel and reset between stories.
 * Pass `overrides` to tailor a variant (e.g. `{ isLoading: true }`, or an op that
 * `mockRejectedValue`s). Enrich the per-op defaults here as container stories need
 * richer fixture data — this is the single source of truth for the mock shape.
 */
export function makeUseOktaApiValue(overrides: UseOktaApiValue = {}): UseOktaApiValue {
  return {
    // Run state
    isLoading: false,
    isCancelled: false,
    cancelOperation: fn(),

    // Core
    makeApiRequest: asyncFn({}),

    // Group operations
    getAllGroupMembers: asyncFn([]),
    removeUserFromGroup: asyncFn(),
    addUserToGroup: asyncFn(),
    removeDeprovisioned: asyncFn(),
    getAllGroups: asyncFn([]),
    getGroupMemberCount: asyncFn(0),
    getGroupRulesForGroup: asyncFn([]),
    executeBulkOperation: asyncFn(),
    searchGroups: asyncFn([]),
    getGroupById: asyncFn(null),

    // User operations
    getUserLastLogin: asyncFn(null),
    getUserAppAssignments: asyncFn([]),
    getUserApps: asyncFn([]),
    batchGetUserDetails: asyncFn([]),
    scanGroupMfa: asyncFn([]),
    getUserGroupMemberships: asyncFn([]),
    searchUsers: asyncFn([]),
    getUserById: asyncFn(null),
    suspendUser: asyncFn(),
    unsuspendUser: asyncFn(),
    resetPassword: asyncFn(),

    // Export operations
    exportMembers: asyncFn(),

    // Push group operations
    getAppPushGroupMappings: asyncFn([]),
    applyPushGroupMappings: asyncFn(),

    // Group analysis operations
    compareGroups: asyncFn(null),
    searchUserAcrossGroups: asyncFn([]),
    calculateStaleness: asyncFn(null),

    // Rule impact preview (read-only)
    captureRuleImpact: asyncFn(null),

    // Rule consolidation writes
    getRawGroupRule: asyncFn(null),
    createGroupRule: asyncFn(),
    deleteGroupRule: asyncFn(),
    activateGroupRule: asyncFn(),
    deactivateGroupRule: asyncFn(),

    ...overrides,
  };
}

/**
 * The mocked `useOktaApi` hook. Aliased in over the real facade. Returns the
 * benign default value; override per-story with
 * `useOktaApi.mockReturnValue(makeUseOktaApiValue({ ... }))`.
 */
export const useOktaApi = fn((_options?: unknown) => makeUseOktaApiValue()).mockName('useOktaApi');
