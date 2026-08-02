/**
 * @module hooks/useOktaApi/currentUserCache
 * @description Per-tab TTL cache for the signed-in admin identity resolved via
 * `/api/v1/users/me`.
 *
 * Every audited operation and export resolves the acting admin for audit
 * attribution; without a cache that is one `/users/me` round-trip per
 * operation. The admin identity of a connected Okta tab is effectively static
 * over minutes, so entries live for {@link CURRENT_USER_TTL_MS} and expire
 * naturally — there is no explicit invalidation. Keyed by tab id because
 * different tabs can hold different Okta sessions (different orgs/admins).
 *
 * Only the parsed identity (email + id) is stored — no tokens, no session
 * material, and nothing is persisted; the cache is module-level memory only.
 */

/** Parsed current-user identity used for audit attribution. */
export interface CurrentUserIdentity {
  /** Admin's email, or the `unknown@unknown.com` placeholder. */
  email: string;
  /** Admin's Okta user id, or the `unknown` placeholder. */
  id: string;
}

/** How long a cached current-user identity stays fresh (5 minutes). */
export const CURRENT_USER_TTL_MS = 5 * 60 * 1000;

const cache = new Map<number, { value: CurrentUserIdentity; expiresAt: number }>();

/**
 * Return the cached identity for `tabId` if present and fresh, else `null`.
 * An expired entry is evicted on read.
 */
export function getCachedCurrentUser(tabId: number): CurrentUserIdentity | null {
  const entry = cache.get(tabId);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(tabId);
    return null;
  }
  return entry.value;
}

/** Store a freshly resolved identity for `tabId`, valid for the TTL. */
export function cacheCurrentUser(tabId: number, value: CurrentUserIdentity): void {
  cache.set(tabId, { value, expiresAt: Date.now() + CURRENT_USER_TTL_MS });
}

/**
 * Empty the cache. The module-level Map would otherwise leak a cached admin
 * identity between tests — the global test setup calls this after each test
 * (same pattern as `resetEntityCache`).
 */
export function resetCurrentUserCache(): void {
  cache.clear();
}
