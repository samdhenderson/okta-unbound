/**
 * @module sidepanel/hooks/useEntitySearchSources
 * @description The searchers and fetchers {@link module:sidepanel/hooks/useJumpResolver}
 * runs on — built once, in one place, for every surface that resolves an entity.
 *
 * Two surfaces ask the org the same question: the Home tab's jump bar and the
 * ⌘K palette. They ask it differently — Home is a landing affordance you type
 * into, the palette is a keyboard route you summon over whatever you were
 * doing — but "find me the group called `eng`" has exactly one right answer, and
 * a second implementation of it would drift on the details that matter: which
 * field is the display name, what a rule's status line says, whether a throttled
 * app lookup counts as an absence.
 *
 * ## The allow-list is the point
 *
 * {@link UseEntitySearchSourcesOptions.kinds} is not a convenience. Without it
 * this hook would hand every caller every leg, and the day the palette gained
 * apps, rules and policies, Home's jump bar would silently start fanning out
 * over five endpoints per settle instead of two — a cost nobody asked for, in a
 * file nobody edited. Each surface states what it searches, and only that.
 *
 * ## Local first, live only where it has to be
 *
 * Groups, rules and apps are already in the org snapshot (ADR-0040), so rules
 * and apps are matched by {@link OrgEntityIndex.searchByName} at **zero
 * requests**. Apps fall back to Okta's `q=` search when their collection's walk
 * has not finished, because a partial snapshot must never be read as an absence.
 * Users are deliberately not stored at all (ADR-0040 §5), so a user search is
 * always live. Policies are live too, but only once: the whole `ACCESS_POLICY`
 * list is walked behind the Policies tab's own cache key, so whichever surface
 * asks first pays, and every later search filters what is already in hand.
 *
 * ## Stability
 *
 * `searchers` is memoized because `useJumpResolver` depends on its identity —
 * see that module's contract. **Callers must pass a module-level constant for
 * `kinds`**; an inline array literal is a fresh reference every render and
 * defeats the memo, turning one search per settle into one search per render of
 * the host component. `fetchers` needs no such guarantee: it is only ever
 * reached from `submit`, an event handler.
 */
import { useMemo } from 'react';
import { useEntityNavigation } from '../contexts/NavigationContext';
import { navigationTarget } from '../components/home/jumpDestinations';
import { getOrFetch } from '../cache/entityCache';
import { AUTH_POLICY_TYPE, POLICIES_CACHE_KEY } from './usePoliciesData';
import { filterPolicies } from '../components/policies/policyFilters';
import type { JumpKind, JumpResult } from './useJumpResolver';
import type { OrgEntityIndex } from './useOrgEntityIndex';
import type { OktaIdKind } from '../../shared/utils/oktaId';
import type { OktaPolicyListItem } from '../../shared/schemas/okta';
import type { OktaPolicyType } from './useOktaApi/policyOperations';

/**
 * The slice of {@link module:sidepanel/hooks/useOktaApi} this hook reads.
 *
 * Declared structurally rather than as the facade's own type so a test can pass
 * eight functions instead of standing up the whole client, and so adding a
 * searcher is visibly a change to this contract.
 */
export interface EntitySearchApi {
  /** Type-ahead group search (`q=`). */
  searchGroups: (
    query: string,
  ) => Promise<Array<{ id: string; name: string; description?: string }>>;
  /** Type-ahead user search (`q=`). */
  searchUsers: (query: string) => Promise<
    Array<{
      id: string;
      firstName?: string;
      lastName?: string;
      login: string;
      email?: string;
    }>
  >;
  /** Type-ahead app search (`q=`), used only when the snapshot cannot answer. */
  searchApps: (query: string) => Promise<Array<{ id: string; label: string }>>;
  /** Whole-list policy walk; `/api/v1/policies` has no name search of its own. */
  listPolicies: (type?: OktaPolicyType) => Promise<OktaPolicyListItem[]>;
  /** By-id group lookup, for a snapshot miss. */
  getGroupById: (id: string) => Promise<{ id: string; name: string; description?: string } | null>;
  /** By-id user lookup; users are never in the snapshot, so this always runs. */
  getUserById: (id: string) => Promise<{
    id: string;
    firstName?: string;
    lastName?: string;
    login: string;
    email?: string;
  } | null>;
  /** By-id app lookup, whose four-way result separates "no such app" from "no answer". */
  getAppById: (
    id: string,
  ) => Promise<
    | { kind: 'found'; app: { id: string; label?: string; name?: string } }
    | { kind: 'missing' }
    | { kind: 'session-expired' }
    | { kind: 'failed'; status: number }
  >;
  /** By-id rule lookup. */
  getRawGroupRule: (id: string) => Promise<{ id: string; name?: string; status?: string } | null>;
}

/** Options for {@link useEntitySearchSources}. */
export interface UseEntitySearchSourcesOptions {
  /** The Okta client slice. See {@link EntitySearchApi}. */
  api: EntitySearchApi;
  /** The local org snapshot index — the zero-request half of every answer. */
  index: OrgEntityIndex;
  /**
   * Which kinds this surface searches. **Must be a module-level constant**, or
   * the `searchers` memo is defeated — see the module header.
   */
  kinds: ReadonlyArray<JumpKind>;
}

/** What {@link useEntitySearchSources} returns. */
export interface EntitySearchSources {
  /** Name searchers, keyed by kind. Ready to hand to `useJumpResolver`. */
  searchers: Partial<Record<JumpKind, (query: string) => Promise<JumpResult[]>>>;
  /** By-id fetchers, keyed by kind, for a snapshot miss. */
  fetchers: Partial<Record<OktaIdKind, (id: string) => Promise<JumpResult | null>>>;
}

/**
 * Most policy rows one search returns.
 *
 * The same 20 the live `q=` searches cap at, applied here by hand because the
 * filtering is local: without it a one-letter-over-the-floor query could return
 * every policy in the org and bury the other sections.
 */
const POLICY_RESULT_LIMIT = 20;

/** A user's display name, falling back to the login rather than to blank. */
function userName(user: { firstName?: string; lastName?: string; login: string }): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.login;
}

/**
 * Build the searchers and fetchers for one entity-resolving surface.
 *
 * @param options - See {@link UseEntitySearchSourcesOptions}.
 * @returns See {@link EntitySearchSources}.
 *
 * @example
 * ```ts
 * // Module scope — an inline literal here would defeat the memo.
 * const HOME_JUMP_KINDS = ['group', 'user'] as const;
 *
 * const { searchers, fetchers } = useEntitySearchSources({ api, index, kinds: HOME_JUMP_KINDS });
 * const jump = useJumpResolver({ index, searchers, fetchers, enabled: isActive });
 * ```
 */
export function useEntitySearchSources({
  api,
  index,
  kinds,
}: UseEntitySearchSourcesOptions): EntitySearchSources {
  const nav = useEntityNavigation();
  const { searchGroups, searchUsers, searchApps, listPolicies } = api;
  const { getGroupById, getUserById, getAppById, getRawGroupRule } = api;
  const { searchByName, isAuthoritative } = index;

  const searchers = useMemo(() => {
    const built: Partial<Record<JumpKind, (query: string) => Promise<JumpResult[]>>> = {};

    // Both gates, ANDed: the surface has to want the kind, and the build has to
    // be able to open it. Searching for something that cannot be pressed
    // produces a row that only refuses — ADR-0039's "no verb without a wire".
    const wants = (kind: JumpKind) =>
      kinds.includes(kind) && nav.canNavigateTo(navigationTarget(kind));

    if (wants('group')) {
      built.group = async (query) =>
        (await searchGroups(query)).map((group) => ({
          kind: 'group' as const,
          id: group.id,
          name: group.name,
          secondary: group.description || undefined,
        }));
    }

    if (wants('user')) {
      built.user = async (query) =>
        (await searchUsers(query)).map((user) => ({
          kind: 'user' as const,
          id: user.id,
          name: userName(user),
          secondary: user.email || user.login,
        }));
    }

    if (wants('rule')) {
      // Zero requests, always: there is no rule-name endpoint on Okta, and the
      // whole rules collection is in the snapshot anyway.
      built.rule = async (query) => searchByName('rule', query);
    }

    if (wants('app')) {
      built.app = async (query) => {
        const local = searchByName('app', query);
        // A finished walk is the whole app inventory, so asking Okta as well
        // would spend a request to be told what is already on screen. An
        // unfinished one cannot be trusted to be missing nothing, so it is
        // topped up rather than presented as the answer.
        if (isAuthoritative('app')) return local;
        const seen = new Set(local.map((row) => row.id));
        const live = (await searchApps(query))
          .filter((app) => !seen.has(app.id))
          .map((app) => ({ kind: 'app' as const, id: app.id, name: app.label }));
        return [...local, ...live];
      };
    }

    if (wants('policy')) {
      built.policy = async (query) => {
        // `/api/v1/policies` takes no `q=`, so the only way to search a policy
        // name is to hold the list. Read through the Policies tab's own cache
        // key so the walk is paid at most once a session by whichever surface
        // asks first, and `getOrFetch` coalesces two surfaces asking at once.
        const policies = await getOrFetch<OktaPolicyListItem[]>(POLICIES_CACHE_KEY, () =>
          listPolicies(AUTH_POLICY_TYPE),
        );
        return filterPolicies(policies, query)
          .slice(0, POLICY_RESULT_LIMIT)
          .map((policy) => ({
            kind: 'policy' as const,
            id: policy.id,
            name: policy.name || policy.id,
            secondary: policy.description || undefined,
          }));
      };
    }

    return built;
  }, [
    kinds,
    nav,
    searchGroups,
    searchUsers,
    searchApps,
    listPolicies,
    searchByName,
    isAuthoritative,
  ]);

  // Needs no memoization — only ever reached from `submit`, an event handler.
  const fetchers: Partial<Record<OktaIdKind, (id: string) => Promise<JumpResult | null>>> = {
    group: async (id) => {
      const group = await getGroupById(id);
      return group
        ? {
            kind: 'group',
            id: group.id,
            name: group.name,
            secondary: group.description || undefined,
          }
        : null;
    },
    user: async (id) => {
      const user = await getUserById(id);
      return user
        ? { kind: 'user', id: user.id, name: userName(user), secondary: user.email || user.login }
        : null;
    },
    // The only fetcher that can tell "Okta says no such app" apart from "we
    // never got an answer" (`AppLookup`, D-007a). `null` here means the caller
    // reports an authoritative absence, so only a real 404 may return it —
    // a throttled or unauthenticated lookup throws instead, and `useJumpResolver`
    // renders it as the error it is rather than as a missing app.
    app: async (id) => {
      const lookup = await getAppById(id);
      switch (lookup.kind) {
        case 'found':
          return {
            kind: 'app',
            id: lookup.app.id,
            name: lookup.app.label || lookup.app.name || lookup.app.id,
          };
        case 'missing':
          return null;
        case 'session-expired':
          throw new Error('Your Okta session has expired. Sign in again on the Okta tab.');
        case 'failed':
          // Deliberately not "could not reach Okta": this arm also covers 403 and
          // 429, where Okta answered and the answer was no. Say only what is true
          // of every arm — the lookup did not complete — rather than asserting a
          // connectivity failure that did not happen.
          throw new Error('Could not look that app up. Try again.');
      }
    },
    rule: async (id) => {
      const rule = await getRawGroupRule(id);
      return rule
        ? {
            kind: 'rule',
            id: rule.id,
            name: rule.name || rule.id,
            secondary: rule.status === 'INACTIVE' ? 'Paused' : 'Active',
          }
        : null;
    },
  };

  return { searchers, fetchers };
}
