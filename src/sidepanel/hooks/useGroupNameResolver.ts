/**
 * @module sidepanel/hooks/useGroupNameResolver
 * @description One resolver for "what is group `00g…` called?", with a bounded
 * fetch behind it — so a group id embedded in a rule condition is never read to
 * an admin as a bare id.
 *
 * ## Why a hook and not another map
 *
 * Four surfaces print rule condition text, and each had built its own id→name
 * lookup out of whatever it happened to be holding:
 *
 * - `ClauseChecklist` built one from **the user's own memberships**, so the one
 *   group the reader most needs named — a prerequisite they are *missing* — was
 *   the one group it could never name.
 * - `GroupRulesSection` read `FormattedRule.allGroupNamesMap`, which the group
 *   rung's own loader never populates, so the resolver there was always absent.
 * - `RuleDetailView` kept a private id-shaped tokeniser and the same map.
 * - `BlastRadiusRuleRow` printed the expression through a bare `<code>` with no
 *   resolver at all, while the hook rendering it held the whole org's names.
 *
 * Four lookups, four different answers to one question. This is the one.
 *
 * ## The ladder, cheapest first
 *
 * 1. **Names the caller already holds** — a user's memberships, a comparison's
 *    two membership lists. Passed in as `known`; always preferred, because they
 *    are live rows rather than a walked snapshot.
 * 2. **The org snapshot**, through `loadCachedGroupIndex`. One IndexedDB read,
 *    no API traffic, and it names every group the background has walked.
 * 3. **`GET /api/v1/groups/{id}`**, once per id, only for ids a surface has
 *    actually asked about. This is the rung that did not exist, and its absence
 *    is why a cold snapshot meant raw ids everywhere.
 *
 * ## The fetch is bounded by what is on screen
 *
 * Rung 3 fires from {@link GroupNameResolution.request}, which a rendering
 * surface calls for the ids it is about to print — never over a rule corpus.
 * `fetchGroupRulesRequest` warns against a per-referenced-group fan-out for
 * exactly the right reason: naming every id in every rule in the org is hundreds
 * of wasted calls. Naming the four ids in the condition an admin is reading is
 * four, once, for the session.
 *
 * In-flight requests are deduped by id and results are held in the entity cache
 * under {@link cacheKeys.groupName} at `TTL_LONG`, so two surfaces asking about
 * the same id cost one call between them.
 *
 * ## Security
 *
 * Group names are end-user-controllable Okta data. They are returned as plain
 * strings for React to escape and are **never logged**; only ids and counts
 * reach the logger. The id is interpolated into a path, so it is checked against
 * Okta's id shape first — a value from a tenant-authored rule expression must
 * not be able to steer a request.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadCachedGroupIndex } from './fetchGroupRulesRequest';
import { useOktaApi } from './useOktaApi';
import { peek, setEntry } from '../cache/entityCache';
import { cacheKeys, TTL_LONG } from '../cache/keys';
import { createLogger } from '../../shared/utils/logger';
import type { GroupNameResolver } from '../components/shared';

const log = createLogger('useGroupNameResolver');

/**
 * An Okta group id, in full.
 *
 * The value reaching {@link GroupNameResolution.request} comes out of a rule
 * expression — tenant-authored text — and goes into a request path. Anything
 * that is not shaped like a group id is not looked up, so a crafted literal
 * cannot reach an endpoint of its author's choosing. `fetchGroupRulesRequest`
 * applies the same shape when it scans expressions for ids.
 */
const GROUP_ID_SHAPE = /^00g[a-zA-Z0-9]{17}$/;

/** What {@link useGroupNameResolver} hands a rendering surface. */
export interface GroupNameResolution {
  /**
   * Names one group id, or returns `undefined` when nothing known names it yet.
   *
   * **Stable across renders** while the underlying names are unchanged, because
   * `RuleExpressionText` memoises its tokenisation on this function's identity —
   * a resolver rebuilt per render makes that memo decoration (`I-037`).
   */
  resolveGroupName: GroupNameResolver;
  /**
   * Ask for the ids a surface is about to print, so the ones nothing names yet
   * can be fetched. Safe to call on every render with the same ids: already
   * known, already cached, and already in-flight ids are all no-ops.
   */
  request: (groupIds: readonly string[]) => void;
}

/** Options for {@link useGroupNameResolver}. */
export interface UseGroupNameResolverOptions {
  /**
   * The tab whose content script issues the fallback fetch. `null`/`undefined`
   * before one is attached, which disables rung 3 — the two lower rungs still
   * answer, so a warm snapshot names groups with no tab at all.
   */
  targetTabId: number | null | undefined;
  /** The connected org's origin — what the snapshot's group rows are scoped by. */
  oktaOrigin?: string | null;
  /**
   * Names the caller already holds, id → name. Preferred over every other rung:
   * these are live rows rather than walked ones. Rebuild it with `useMemo` — a
   * fresh object each render re-seeds the resolver each render.
   */
  known?: ReadonlyMap<string, string>;
  /**
   * Whether this surface is on screen. A hidden tab stays mounted (`isActive`
   * gating is the house rule), and a hidden tab must not read the snapshot or
   * issue a fetch.
   */
  enabled?: boolean;
}

/**
 * A resolver for the group ids one surface is about to render.
 *
 * @param options - See {@link UseGroupNameResolverOptions}.
 * @returns The resolver and the request function; see {@link GroupNameResolution}.
 *
 * @example
 * ```tsx
 * const { resolveGroupName, request } = useGroupNameResolver({ targetTabId, oktaOrigin });
 * useEffect(() => request(extractReferencedGroupIds(rule.conditionExpression)), [rule]);
 * return <RuleExpressionText text={expression} resolveGroupName={resolveGroupName} />;
 * ```
 */
export function useGroupNameResolver({
  targetTabId,
  oktaOrigin,
  known,
  enabled = true,
}: UseGroupNameResolverOptions): GroupNameResolution {
  const { getGroupById } = useOktaApi({ targetTabId: targetTabId ?? null, oktaOrigin });

  /** Names from the snapshot (rung 2) and from resolved fetches (rung 3). */
  const [resolved, setResolved] = useState<ReadonlyMap<string, string>>(new Map());
  /** Ids with a request in flight, so a re-render cannot double-fetch one. */
  const inFlight = useRef<Set<string>>(new Set());
  /** Ids a fetch has already answered `null` for, so a miss is asked once. */
  const unnameable = useRef<Set<string>>(new Set());

  // Rung 2: one IndexedDB read per origin. `loadCachedGroupIndex` logs and
  // swallows its own failures, so an unreadable store yields no names — the same
  // degrade as an org with none.
  useEffect(() => {
    if (!enabled || !oktaOrigin) return;
    let live = true;
    void loadCachedGroupIndex(oktaOrigin).then((index) => {
      if (!live || index.nameById.size === 0) return;
      setResolved((current) => {
        const next = new Map(current);
        // Never overwrite a fetched name with a snapshot one: a completed fetch
        // is the fresher of the two.
        for (const [id, name] of index.nameById) if (!next.has(id)) next.set(id, name);
        return next;
      });
    });
    return () => {
      live = false;
    };
  }, [enabled, oktaOrigin]);

  const request = useCallback(
    (groupIds: readonly string[]) => {
      if (!enabled || targetTabId === undefined || targetTabId === null) return;
      for (const groupId of groupIds) {
        if (!GROUP_ID_SHAPE.test(groupId)) continue;
        if (known?.has(groupId) || resolved.has(groupId)) continue;
        if (inFlight.current.has(groupId) || unnameable.current.has(groupId)) continue;

        // A name another surface already fetched this session costs nothing.
        const cached = peek<string>(cacheKeys.groupName(groupId));
        if (cached) {
          setResolved((current) => new Map(current).set(groupId, cached));
          continue;
        }

        inFlight.current.add(groupId);
        void getGroupById(groupId)
          .then((group) => {
            // `getGroupById` falls back to the id when a group carries no name,
            // which would badge an id as its own name. Nothing is better.
            if (!group || group.name === groupId) {
              unnameable.current.add(groupId);
              return;
            }
            setEntry(cacheKeys.groupName(groupId), group.name, { ttl: TTL_LONG });
            setResolved((current) => new Map(current).set(groupId, group.name));
          })
          .catch(() => {
            // `getGroupById` already swallows and logs its own failures; this is
            // the belt for a rejection it did not. A group that could not be
            // named is simply not named.
            unnameable.current.add(groupId);
          })
          .finally(() => {
            inFlight.current.delete(groupId);
          });
      }
      // Ids only, never names: names are tenant data.
      log.debug('Group-name lookup requested', { count: groupIds.length });
    },
    [enabled, targetTabId, getGroupById, known, resolved],
  );

  const resolveGroupName = useCallback<GroupNameResolver>(
    (groupId) => known?.get(groupId) ?? resolved.get(groupId),
    [known, resolved],
  );

  return useMemo(() => ({ resolveGroupName, request }), [resolveGroupName, request]);
}
