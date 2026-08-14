/**
 * @module sidepanel/hooks/usePoliciesData
 * @description Owns the Auth Policies tab's policy list and its load/cache pipeline.
 *
 * The read-only sibling of {@link module:sidepanel/hooks/useRulesData}: it holds the
 * loaded `ACCESS_POLICY` list, the loading flag and the last-fetch timestamp, and
 * exposes a single stable `loadPolicies(force)` that routes through the scheduler
 * path (side panel → background `ApiScheduler` → content script).
 *
 * Caching is delegated to the session-scoped
 * {@link module:sidepanel/cache/entityCache} under a module-level key, so switching
 * away from the tab and back re-renders the list with no refetch, and concurrent
 * loads coalesce onto one request. `force` bypasses both the cache and the
 * de-duplication (the header's Refresh action).
 *
 * @remarks There are deliberately **no writes here** — nothing in the Auth Policies
 * feature mutates a policy or a rule.
 */

import { useCallback, useState } from 'react';
import { getOrFetch, peek, peekFetchedAt, type EntityKey } from '../cache/entityCache';
import { cacheKeys } from '../cache/keys';
import { useOktaApi } from './useOktaApi';
import type { OktaPolicyType } from './useOktaApi/index';
import { createLogger } from '../../shared/utils/logger';
import type { OktaPolicyListItem } from '../../shared/schemas/okta';

const log = createLogger('usePoliciesData');

/**
 * The only policy type the Auth Policies tab reads this release: app
 * authentication (sign-on) policies.
 */
export const AUTH_POLICY_TYPE: OktaPolicyType = 'ACCESS_POLICY';

/** Entity-cache key holding the fetched {@link AUTH_POLICY_TYPE} list. */
export const POLICIES_CACHE_KEY: EntityKey = cacheKeys.policies(AUTH_POLICY_TYPE);

/** Options for {@link usePoliciesData}. */
export interface UsePoliciesDataOptions {
  /** Connected Okta tab id; loading reports an error when absent. */
  targetTabId?: number;
  /** Surface a message in the tab's banner; `''` clears it. */
  onError: (message: string) => void;
}

/** Return shape of {@link usePoliciesData}. */
export interface UsePoliciesDataReturn {
  /** The loaded policies (validated `ACCESS_POLICY` rows). */
  policies: OktaPolicyListItem[];
  /** `true` while a load is in flight. */
  isLoading: boolean;
  /** ISO timestamp of the last completed load, or `null`. */
  lastFetchTime: string | null;
  /** Load the policy list; `force` bypasses the cache (manual refresh). */
  loadPolicies: (force?: boolean) => Promise<void>;
}

/**
 * Manage the Auth Policies tab's data: the app authentication policy list, its
 * loading flag, the last-fetch timestamp, and the cache-first `loadPolicies`.
 *
 * @param options - See {@link UsePoliciesDataOptions}.
 * @returns The policy data plus a stable `loadPolicies`.
 *
 * @remarks `listPolicies` never throws — it degrades to `[]`, and a `403` for an
 * admin role without policy read access is indistinguishable from an empty org.
 * The caller's empty state must say so; this hook does not invent an error.
 */
/**
 * The cache's own write time for a key, as an ISO string.
 *
 * Reads through {@link peekFetchedAt} rather than stamping `new Date()` at the
 * call site: the question a "last updated" line answers is when the data was
 * fetched, which may have been by a different consumer sharing the same key.
 */
function isoFetchedAt(key: EntityKey): string | null {
  const at = peekFetchedAt(key);
  return at === null ? null : new Date(at).toISOString();
}

export function usePoliciesData({
  targetTabId,
  onError,
}: UsePoliciesDataOptions): UsePoliciesDataReturn {
  // Seed from the session cache so returning to the tab paints instantly.
  const [policies, setPolicies] = useState<OktaPolicyListItem[]>(
    () => peek<OktaPolicyListItem[]>(POLICIES_CACHE_KEY) ?? [],
  );
  const [isLoading, setIsLoading] = useState(false);
  // Seeded from the cache, like `policies` above. Previously this started `null`
  // regardless, so a cache hit painted real policies under "never fetched".
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(() =>
    isoFetchedAt(POLICIES_CACHE_KEY),
  );

  // Own a useOktaApi slice so the read routes through the scheduler, mirroring
  // useRulesData. No `onResult` — errors are surfaced through `onError` below.
  const { listPolicies } = useOktaApi({ targetTabId: targetTabId ?? null });

  const loadPolicies = useCallback(
    async (force: boolean = false) => {
      if (!targetTabId) {
        onError('No Okta tab connected');
        return;
      }

      setIsLoading(true);
      onError('');

      try {
        const loaded = await getOrFetch<OktaPolicyListItem[]>(
          POLICIES_CACHE_KEY,
          () => listPolicies(AUTH_POLICY_TYPE),
          { force },
        );
        setPolicies(loaded);
        setLastFetchTime(isoFetchedAt(POLICIES_CACHE_KEY));
        // Outcome + count only — never policy names or descriptions.
        log.debug('Loaded auth policies', { type: AUTH_POLICY_TYPE, count: loaded.length });
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to load auth policies');
        log.error('loadPolicies failed', { code: 'load_policies_failed', type: AUTH_POLICY_TYPE });
      } finally {
        setIsLoading(false);
      }
    },
    [targetTabId, onError, listPolicies],
  );

  return { policies, isLoading, lastFetchTime, loadPolicies };
}
