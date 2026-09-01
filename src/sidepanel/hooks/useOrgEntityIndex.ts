/**
 * @module sidepanel/hooks/useOrgEntityIndex
 * @description The Home tab's one read of the background-owned org snapshot
 * (ADR-0040): an id → entity lookup over groups, rules and apps, plus the
 * app-group assignments the snapshot card joins against.
 *
 * Home asks the org two questions, and this hook is the single place either is
 * answered from:
 *
 * - **"What is `00gFAKE…`?"** — the jump bar resolving a pasted id. Groups,
 *   rules and apps are already stored locally, so the answer costs **zero
 *   requests**; only a miss falls through to Okta.
 * - **"How big is this org?"** — the snapshot card's counts, which are
 *   `rows.length` over the same three collections, plus the sub-counts joined
 *   from them and from `appGroups`.
 * - **"What is called `eng`?"** — {@link OrgEntityIndex.searchByName}, the same
 *   zero-request answer for a name that `lookup` gives for an id. Added for the
 *   ⌘K palette, which searches names rather than resolving pasted ids.
 *
 * `appGroups` is the one collection here that is not an entity kind: nothing
 * resolves to an app-group assignment, and {@link OrgEntityIndex.lookup} never
 * looks in it. It is mounted here anyway because it is read for the same reason
 * and at the same moment as the other three, and a second hook reading it would
 * open a second IndexedDB read and register a second broadcast listener for one
 * number.
 *
 * Both are served from one mount. Two hooks each calling `useOrgSnapshot` for
 * the same collection would open two IndexedDB reads and register two
 * `snapshotUpdated` listeners for one answer, so the collections are read here
 * and the consumers take what they need.
 *
 * ## `complete` is load-bearing, not decoration
 *
 * A walk that was interrupted leaves real rows behind, and an id that is simply
 * *not in them yet* is indistinguishable from one that does not exist. Serving
 * "no such group" from a partial snapshot is ADR-0040 §7's
 * partial-served-as-complete defect wearing a different hat, so
 * {@link OrgEntityIndex.isAuthoritative} gates every negative answer: a miss on
 * an incomplete collection is `'unknown'`, and the caller spends a request
 * rather than reporting an absence it cannot support.
 *
 * A *positive* hit needs no such gate — a row that is present was returned by
 * Okta, whether or not the walk that fetched it finished.
 */
import { useCallback, useMemo } from 'react';
import { useOrgSnapshot, type UseOrgSnapshotResult } from '../cache/useOrgSnapshot';
import type { OktaIdKind } from '../../shared/utils/oktaId';
import type { OktaGroupRule } from '../../shared/types';
import type { OktaAppGroupAssignment, OktaAppListItem } from '../../shared/schemas/okta';
import type { RawOktaGroup } from '../components/groups/groupSummary';

/** The collections this index covers. `user` is deliberately absent — see below. */
export type IndexedKind = Extract<OktaIdKind, 'group' | 'rule' | 'app'>;

/** A resolved entity, flattened to what a jump result row needs. */
export interface IndexedEntity {
  /** Which collection the row came from. */
  kind: IndexedKind;
  /** The Okta id. */
  id: string;
  /** Display name — a group's profile name, a rule's name, an app's label. */
  name: string;
  /**
   * One extra fact worth showing, when the collection cheaply carries one: a
   * rule's `ACTIVE`/`INACTIVE` status, an app's sign-on mode. `undefined` when
   * the row has nothing useful to add.
   */
  secondary?: string;
}

/**
 * The answer to a local lookup.
 *
 * `'unknown'` is a third state on purpose: it separates "this org has no such
 * entity" from "this snapshot cannot say", and only the first is safe to show a
 * reader.
 */
export type LocalLookup =
  { status: 'hit'; entity: IndexedEntity } | { status: 'miss' } | { status: 'unknown' };

/** What {@link useOrgEntityIndex} exposes. */
export interface OrgEntityIndex {
  /**
   * Resolve an id locally.
   *
   * @param kind - Which collection to look in. `user` is not indexed and always
   * answers `'unknown'`.
   * @param id - The Okta id.
   * @returns A hit, a supported miss, or `'unknown'` when the snapshot is not
   * authoritative enough to deny the id exists.
   */
  lookup: (kind: OktaIdKind, id: string) => LocalLookup;
  /**
   * Search one collection by name, locally.
   *
   * The zero-request half of a *name* search, the way {@link lookup} is the
   * zero-request half of an id resolution. It scans the same flattened
   * {@link IndexedEntity} rows `lookup` returns, so a group found by name and a
   * group found by id are the same row with the same fallbacks — there is no
   * second place that decides what an app is called.
   *
   * Deliberately returns rows and nothing else: it cannot report absence. A
   * collection whose walk never finished still matches what it has, and it is
   * the caller's job to say so — see {@link isAuthoritative}.
   *
   * @param kind - Which collection to scan.
   * @param query - Case-insensitive substring of the entity's name. Blank
   * returns `[]` rather than the whole org.
   * @param limit - Most rows to return. Defaults to 20, matching what Okta's own
   * type-ahead searches cap at, so a local section and a live one are the same size.
   */
  searchByName: (kind: IndexedKind, query: string, limit?: number) => IndexedEntity[];
  /**
   * Whether a collection's last walk finished, so a miss in it means "absent"
   * rather than "not fetched yet".
   */
  isAuthoritative: (kind: IndexedKind) => boolean;
  /** The raw snapshot handles, for consumers that need counts or freshness. */
  groups: UseOrgSnapshotResult<RawOktaGroup>;
  rules: UseOrgSnapshotResult<OktaGroupRule>;
  apps: UseOrgSnapshotResult<OktaAppListItem>;
  /**
   * App-group assignments, keyed `${appId}::${groupId}`. Read through
   * {@link UseOrgSnapshotResult.records}, never `rows` — Okta returns only the
   * group's id on an assignment, so which app it belongs to exists in the key
   * alone.
   */
  appGroups: UseOrgSnapshotResult<OktaAppGroupAssignment>;
}

/** Options for {@link useOrgEntityIndex}. */
export interface UseOrgEntityIndexOptions {
  /** Connected org origin; `null` reads nothing rather than another org's rows. */
  oktaOrigin: string | null | undefined;
  /** Live Okta tab the background routes through; `null` disables syncing. */
  targetTabId: number | null;
  /**
   * When `false` the store is still read and broadcasts still tracked, but no
   * sync is issued — a hidden tab must not drive org-wide traffic (ADR-0018).
   */
  enabled?: boolean;
}

/**
 * Most rows {@link OrgEntityIndex.searchByName} returns when the caller does not
 * say. 20, the same cap Okta's own `q=` type-ahead searches use, so a local
 * section and a live one in the same list are the same length.
 */
const DEFAULT_NAME_SEARCH_LIMIT = 20;

/** Reads a group's display name, falling back to its id rather than to blank. */
function groupName(group: RawOktaGroup): string {
  return group.profile?.name || group.id;
}

/** Reads an app's display label, preferring the human label over the API name. */
function appName(app: OktaAppListItem): string {
  return app.label || app.name || app.id;
}

/**
 * Index one org's groups, rules and apps from the local snapshot.
 *
 * @param options - See {@link UseOrgEntityIndexOptions}.
 * @returns See {@link OrgEntityIndex}.
 *
 * @example
 * ```ts
 * const index = useOrgEntityIndex({ oktaOrigin, targetTabId, enabled: isActive });
 * const found = index.lookup('group', '00gFAKE0000000000001');
 * if (found.status === 'hit') showRow(found.entity);          // zero requests
 * else if (found.status !== 'miss') await fetchFromOkta();    // 'unknown'
 * ```
 */
export function useOrgEntityIndex({
  oktaOrigin,
  targetTabId,
  enabled = true,
}: UseOrgEntityIndexOptions): OrgEntityIndex {
  const groups = useOrgSnapshot<RawOktaGroup>('groups', oktaOrigin, targetTabId, { enabled });
  const rules = useOrgSnapshot<OktaGroupRule>('rules', oktaOrigin, targetTabId, { enabled });
  const apps = useOrgSnapshot<OktaAppListItem>('apps', oktaOrigin, targetTabId, { enabled });
  const appGroups = useOrgSnapshot<OktaAppGroupAssignment>('appGroups', oktaOrigin, targetTabId, {
    enabled,
  });

  // One pass per collection per change, rather than a linear scan per keystroke.
  // The jump bar resolves on Enter, so this is not hot — but the Maps are also
  // what the report launchers will join over, and a scan there would be.
  const groupsById = useMemo(() => {
    const byId = new Map<string, IndexedEntity>();
    for (const group of groups.rows) {
      if (group.id) byId.set(group.id, { kind: 'group', id: group.id, name: groupName(group) });
    }
    return byId;
  }, [groups.rows]);

  const rulesById = useMemo(() => {
    const byId = new Map<string, IndexedEntity>();
    for (const rule of rules.rows) {
      if (!rule.id) continue;
      byId.set(rule.id, {
        kind: 'rule',
        id: rule.id,
        name: rule.name || rule.id,
        // The one fact a rule row can state for free, and the one an admin
        // looking up a rule most often wants: is it actually running?
        secondary: rule.status === 'INACTIVE' ? 'Paused' : 'Active',
      });
    }
    return byId;
  }, [rules.rows]);

  const appsById = useMemo(() => {
    const byId = new Map<string, IndexedEntity>();
    for (const app of apps.rows) {
      if (app.id) byId.set(app.id, { kind: 'app', id: app.id, name: appName(app) });
    }
    return byId;
  }, [apps.rows]);

  const isAuthoritative = useCallback(
    (kind: IndexedKind): boolean => {
      switch (kind) {
        case 'group':
          return groups.complete;
        case 'rule':
          return rules.complete;
        case 'app':
          return apps.complete;
      }
    },
    [groups.complete, rules.complete, apps.complete],
  );

  const searchByName = useCallback(
    (kind: IndexedKind, query: string, limit: number = DEFAULT_NAME_SEARCH_LIMIT) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return [];
      const byId = kind === 'group' ? groupsById : kind === 'rule' ? rulesById : appsById;
      const found: IndexedEntity[] = [];
      for (const entity of byId.values()) {
        if (!entity.name.toLowerCase().includes(needle)) continue;
        found.push(entity);
        if (found.length >= limit) break;
      }
      return found;
    },
    [groupsById, rulesById, appsById],
  );

  const lookup = useCallback(
    (kind: OktaIdKind, id: string): LocalLookup => {
      // Users are deliberately not in the snapshot: ADR-0040 §5 keeps the
      // largest and most personal collection in the org out of local storage.
      // So a user id is always 'unknown' here and always costs one request —
      // stated rather than silently returning a miss.
      if (kind === 'user') return { status: 'unknown' };

      const byId = kind === 'group' ? groupsById : kind === 'rule' ? rulesById : appsById;
      const entity = byId.get(id.trim());
      if (entity) return { status: 'hit', entity };
      return isAuthoritative(kind) ? { status: 'miss' } : { status: 'unknown' };
    },
    [groupsById, rulesById, appsById, isAuthoritative],
  );

  return { lookup, searchByName, isAuthoritative, groups, rules, apps, appGroups };
}
