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

/** Fixture user returned for a single-user scheduler read (mirrors the chrome fake). */
const sampleUser = {
  id: 'user1',
  status: 'ACTIVE',
  profile: {
    login: 'ada.lovelace@example.com',
    email: 'ada.lovelace@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
    title: 'Principal Engineer',
  },
};

/** Fixture groups returned for a user's group-membership read (mirrors the chrome fake). */
const sampleGroups = [
  {
    id: 'g-eng',
    type: 'OKTA_GROUP',
    profile: { name: 'Engineering', description: 'All engineers' },
  },
  {
    id: 'g-admins',
    type: 'APP_GROUP',
    profile: { name: 'Okta Admins', description: 'Admin console' },
  },
];

/**
 * Endpoint-aware `makeApiRequest` spy. Returns a well-formed `RequestResult`
 * (`{ success, data }`) so §8-migrated reads render a populated state instead of
 * the "failed to load" branch: a single-user read (`GET /api/v1/users/{id}`)
 * yields the fixture user, a user's groups read (`GET /api/v1/users/{id}/groups`)
 * yields the raw fixture groups (the hook wraps + classifies them), and every other
 * endpoint yields a benign empty success.
 */
const makeApiRequestFn = () =>
  fn(async (endpoint?: string) => {
    if (typeof endpoint === 'string') {
      if (/^\/api\/v1\/users\/[^/?]+\/groups/.test(endpoint)) {
        return { success: true, data: sampleGroups };
      }
      if (/^\/api\/v1\/users\/[^/?]+$/.test(endpoint)) {
        return { success: true, data: sampleUser };
      }
    }
    return { success: true, data: [] };
  });

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
    makeApiRequest: makeApiRequestFn(),
    // The "many calls, one tracked operation" wiring (ADR-0009). Consumers pass
    // it a body; the benign default just runs it, so a story exercises the
    // caller's own logic rather than the scheduler's bookkeeping.
    runOperation: fn(async (_name?: unknown, body?: unknown) =>
      typeof body === 'function' ? (body as () => unknown)() : undefined,
    ),
    // Audit attribution. `null` is the honest default — a story has no signed-in
    // admin — and callers must never substitute a placeholder identity (D-013b).
    getCurrentUser: asyncFn(null),

    // Group operations
    getAllGroupMembers: asyncFn([]),
    removeUserFromGroup: asyncFn(),
    // Benign empty BatchOutcome — consumers iterate `results`.
    removeUserFromGroups: asyncFn({
      results: [],
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      stoppedByError: false,
      cancelled: false,
    }),
    addUserToGroup: asyncFn(),
    removeDeprovisioned: asyncFn(),
    getAllGroups: asyncFn([]),
    getGroupMemberCount: asyncFn(0),
    ensureGroupRulesLoaded: asyncFn(null),
    getGroupRulesForGroup: asyncFn([]),
    executeBulkOperation: asyncFn(),
    searchGroups: asyncFn([]),
    getGroupById: asyncFn(null),
    // One membership, one call, asked only when a reader presses "Prove it"
    // (ADR-0031). `null` means "no proof was obtained", which the UI renders as
    // unproven — never as "assigned directly" (ADR-0020).
    getMembershipRuleProof: asyncFn(null),

    // User operations
    getUserLastLogin: asyncFn(null),
    getUserAppAssignments: asyncFn([]),
    getUserApps: asyncFn([]),
    batchGetUserDetails: asyncFn([]),
    scanGroupMfa: asyncFn([]),
    getUserGroupMemberships: asyncFn([]),
    searchUsers: asyncFn([]),
    getUserById: asyncFn(null),
    searchApps: asyncFn([]),
    suspendUser: asyncFn(),
    unsuspendUser: asyncFn(),
    resetPassword: asyncFn(),
    // Org-wide profile-attribute definitions. `useUserComparison` destructures
    // this, so the comparison surface cannot render its Attributes tab without it.
    getUserProfileSchema: asyncFn(null),
    // The whole validated user, profile included — what an editor needs, and
    // what `getUserById`'s six-field projection deliberately is not.
    getUserRaw: asyncFn(null),
    // The extension's one profile write. Three-state by design: an 'unknown'
    // MAY have applied and must never render as a plain failure.
    updateUserProfile: asyncFn({ outcome: 'saved' }),

    // App inventory operations (read-only: Apps tab + app Overview enrichment)
    getAppById: asyncFn(null),
    getAppAssignmentCounts: asyncFn(null),
    // Fallback for naming an app's granting group when the `expand=user/{id}`
    // embed named none. Linear in app count, so it is gated behind an explicit
    // per-row action rather than a list load (ADR-0031).
    getAppGroupAssignments: asyncFn([]),

    // Auth policy operations (read-only: Auth Policies tab)
    listPolicies: asyncFn([]),
    getPolicyRules: asyncFn([]),
    getAppAccessPolicyId: asyncFn(null),

    // Export operations
    exportMembers: asyncFn(),

    // Descriptor-driven Export Engine (Export tab)
    fetchExportRows: asyncFn({ rows: [], fetched: 0, dropped: 0, capped: false }),
    countExportRows: asyncFn({ count: 0, hasMore: false }),
    runExport: asyncFn(),

    // Push group operations

    // Group analysis operations
    compareGroups: asyncFn(null),
    searchUserAcrossGroups: asyncFn([]),

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
 * A single benign default value, built once. The real `useOktaApi` facade returns
 * one *memoized* object whose operation identities are STABLE across renders; the
 * mock must honour that contract. If the default implementation instead built a
 * fresh object on every call, every op (e.g. `searchGroups`) would get a new
 * identity each render — and any consumer effect that lists an op in its dependency
 * array (e.g. `useAddToGroup`'s debounced group search) would re-run + setState on
 * every render, looping until React throws "Maximum update depth exceeded" and the
 * story canvas crashes. Returning this singleton keeps identities constant.
 */
const defaultValue = makeUseOktaApiValue();

/**
 * The mocked `useOktaApi` hook. Aliased in over the real facade. Returns the
 * stable benign default value; override per-story with
 * `useOktaApi.mockReturnValue(makeUseOktaApiValue({ ... }))` (`mockReturnValue`
 * hands back one object, so overrides keep stable identities too).
 */
export const useOktaApi = fn((_options?: unknown) => defaultValue).mockName('useOktaApi');
