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
 * **Only a resolved identity is ever cached**: a lookup that could not name an
 * admin must not be pinned to the tab for the length of the TTL, because every
 * audited operation in that window would inherit the same non-answer.
 */

/** An admin the `/users/me` lookup positively identified. */
export interface ResolvedActor {
  /** Discriminant: this actor is known. */
  kind: 'resolved';
  /** Admin's email, as reported by their Okta profile. Audit attribution keys off this. */
  email: string;
  /** Admin's Okta user id; best-effort — empty string if the response omitted it. */
  id: string;
}

/**
 * The signed-in admin, or an explicit statement that we could not tell.
 *
 * Callers must switch on `kind` — there is deliberately no placeholder email,
 * so a failed lookup can never be mistaken for a real identity in an audit
 * entry, a CSV cell, or a log line. The `unavailable` variant records which
 * path produced the non-answer:
 *
 * - `threw` — the `/users/me` request itself failed (transport/cancellation).
 * - `failed` — Okta answered, but not with a successful payload.
 * - `no-email` — the response carried no email to attribute the operation to.
 */
export type Actor = ResolvedActor | { kind: 'unavailable'; reason: ActorUnavailableReason };

/** Why the acting admin could not be named. See {@link Actor}. */
type ActorUnavailableReason = 'threw' | 'failed' | 'no-email';

/** How long a cached current-user identity stays fresh (5 minutes). */
export const CURRENT_USER_TTL_MS = 5 * 60 * 1000;

const cache = new Map<number, { value: ResolvedActor; expiresAt: number }>();

/**
 * Return the cached resolved actor for `tabId` if present and fresh, else
 * `null`. An expired entry is evicted on read.
 */
export function getCachedCurrentUser(tabId: number): ResolvedActor | null {
  const entry = cache.get(tabId);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(tabId);
    return null;
  }
  return entry.value;
}

/**
 * Store a freshly resolved actor for `tabId`, valid for the TTL. Only a
 * {@link ResolvedActor} is accepted — an unavailable actor is never cached.
 */
export function cacheCurrentUser(tabId: number, value: ResolvedActor): void {
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
