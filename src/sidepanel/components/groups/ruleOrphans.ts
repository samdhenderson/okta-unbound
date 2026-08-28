/**
 * @module sidepanel/components/groups/ruleOrphans
 * @description The joins that need the *rules* payload: which groups nothing
 * fills, and which app access nothing maintains.
 *
 * A deliberate sibling to {@link module:sidepanel/components/groups/clutterAnalysis}
 * rather than an extension of it. That module's documented contract is "only
 * what is reliably knowable from a group list alone", and it names this exact
 * gap — *it does not infer rule-orphan status, which needs the rules payload*.
 * The org snapshot (ADR-0040) now holds that payload, so the gap can be closed
 * without widening a contract that has its own tests.
 *
 * Pure and React-free. Every input is a row the snapshot already holds, so
 * every answer here costs zero requests.
 *
 * ## What "no rule fills it" means, exactly
 *
 * A group is *filled* by a rule when some rule **assigns** users to it —
 * `actions.assignUserToGroups.groupIds`. A group merely named in another rule's
 * condition (`isMemberOfGroupName(...)`) is not filled by that rule; it is read
 * by it. The two are counted separately everywhere in this repo (see
 * `shared/rules/groupRuleIndex`), and conflating them here would report a group
 * that half the org depends on as unmaintained.
 *
 * ## What this cannot see, and why the copy says so
 *
 * Okta group membership can be maintained by things this extension never
 * observes: Okta Workflows, SCIM or HR-driven provisioning, direct API writes,
 * an IdP's group sync, and app assignments on apps outside the snapshot's
 * app-group walk. So these functions answer *"no group rule fills this"* and
 * nothing stronger. They must never be presented as "safe to delete", and the
 * surfaces that render them carry {@link CLEANUP_CAVEAT} or
 * {@link APP_ACCESS_CAVEAT} verbatim.
 */
import { splitShardedId } from '../../../shared/snapshot/types';

/**
 * The sentence every surface built on this module shows before a reader acts on
 * it.
 *
 * Kept here, beside the joins, rather than in the component: the limitation is a
 * property of the data these functions can see, so a second surface consuming
 * them inherits the caveat instead of having to remember to re-write it.
 */
export const INVISIBLE_MAINTAINERS =
  'Okta Workflows, SCIM and HR provisioning, direct API writes, and IdP group sync ' +
  'can all fill a group without leaving anything here to see.';

/**
 * The population limit on everything drawn from the `appGroups` collection.
 *
 * The snapshot walks `/api/v1/apps/{id}/groups` only for apps that report the
 * group-push feature (`APP_GROUPS_SPEC.shards`), so for any other app an absent
 * assignment means *nobody asked*, not *nothing is assigned*. Saying that out
 * loud is the difference between a narrow true answer and a wide false one.
 */
export const PUSH_APPS_ONLY =
  'Covers the apps this extension reads group assignments for — those with group ' +
  'push enabled. An app outside that set contributes nothing here.';

/** The caveat shown with the empty-groups report. */
export const CLEANUP_CAVEAT = `Findings, not a delete list. ${INVISIBLE_MAINTAINERS} ${PUSH_APPS_ONLY}`;

/** The caveat shown with the unmaintained-app-access report. */
export const APP_ACCESS_CAVEAT = `${PUSH_APPS_ONLY} ${INVISIBLE_MAINTAINERS}`;

/** The minimum a group row must expose for these joins. */
export interface OrphanCandidateGroup {
  /** Okta group id. */
  id: string;
  /** Group name, for display. */
  name: string;
  /** Members Okta reports for the group. */
  memberCount: number;
  /**
   * Okta's source classification. An `APP_GROUP` is mastered by the app that
   * sources it, and a `BUILT_IN` (Everyone) is mastered by Okta itself — neither
   * is waiting for a rule, so neither is a finding.
   */
  type?: string;
}

/** The minimum a rule row must expose: the groups it assigns users to. */
export interface RuleAssignment {
  /** Group ids the rule adds users to. May be empty. */
  groupIds: readonly string[];
}

/** One group a report lists, with the line shown under its name. */
export interface GroupFinding {
  /** Okta group id — the navigation target. */
  id: string;
  /** Group name. */
  name: string;
  /** The one-line explanation under the name. */
  detail: string;
}

/**
 * The set of group ids some rule assigns users to.
 *
 * @param rules - Rule rows, each reduced to the groups it assigns to.
 * @returns Group ids that at least one rule fills.
 */
export function groupIdsFilledByRules(rules: readonly RuleAssignment[]): Set<string> {
  const filled = new Set<string>();
  for (const rule of rules) {
    for (const groupId of rule.groupIds) filled.add(groupId);
  }
  return filled;
}

/**
 * Invert the stored app-group assignments: which apps each group carries access
 * to.
 *
 * Reads the **record ids**, not the entities. Okta returns the assigned group's
 * id as the assignment's own `id`, so the app is recoverable only from the
 * snapshot's compound key (`${appId}::${groupId}`) — see `APP_GROUPS_SPEC`.
 *
 * @param recordIds - Snapshot record ids from the `appGroups` collection.
 * @param appNames - App id → display name, for the lines these findings show.
 * @returns Group id → the names of the apps assigned to it, in stored order. An
 * app the inventory does not name falls back to its id rather than being
 * dropped: the finding is about the group, and a missing label is not a reason
 * to hide one of its apps.
 */
export function appNamesByGroup(
  recordIds: readonly string[],
  appNames: ReadonlyMap<string, string>,
): Map<string, string[]> {
  const byGroup = new Map<string, string[]>();
  for (const recordId of recordIds) {
    const split = splitShardedId(recordId);
    if (!split) continue;
    const names = byGroup.get(split.entityId);
    const name = appNames.get(split.shardKey) ?? split.shardKey;
    if (names) names.push(name);
    else byGroup.set(split.entityId, [name]);
  }
  return byGroup;
}

/** Sort findings by name, so the same org produces the same list twice running. */
function byName(a: GroupFinding, b: GroupFinding): number {
  return a.name.localeCompare(b.name);
}

/**
 * Groups with nothing in them and nothing filling them.
 *
 * Three conditions, all necessary:
 *
 * - **Empty.** A group with members is doing something, whatever put them there.
 * - **No rule fills it.** See the module header for why this reads assignments
 *   rather than references.
 * - **Not app-sourced, and carrying no app access.** An `APP_GROUP` is mastered
 *   by its app, and a group assigned to an app is load-bearing even while empty
 *   — deleting it would revoke the access it is holding open.
 *
 * @param groups - Group rows from the snapshot.
 * @param filledGroupIds - From {@link groupIdsFilledByRules}.
 * @param appLinkedGroupIds - Group ids with a stored app assignment.
 * @returns The findings, sorted by name.
 */
export function findCleanupCandidates(
  groups: readonly OrphanCandidateGroup[],
  filledGroupIds: ReadonlySet<string>,
  appLinkedGroupIds: ReadonlySet<string>,
): GroupFinding[] {
  return groups
    .filter(
      (group) =>
        group.memberCount === 0 &&
        group.type !== 'APP_GROUP' &&
        group.type !== 'BUILT_IN' &&
        !filledGroupIds.has(group.id) &&
        !appLinkedGroupIds.has(group.id),
    )
    .map((group) => ({
      id: group.id,
      name: group.name,
      detail: 'No members · no rule fills it · no app assigned',
    }))
    .sort(byName);
}

/**
 * Groups that grant app access and that no rule fills.
 *
 * Whoever is in one of these is in it because a person put them there, and
 * nothing will take them out again when they change teams. That is the finding —
 * not that the group is wrong, but that its membership is unmanaged while it is
 * holding an app open.
 *
 * Empty groups are left out: they are the cleanup report's subject, and listing
 * a group with nobody in it as "access nothing maintains" would put a finding
 * with no consequence at the top of a list sorted by consequence.
 *
 * @param groups - Group rows from the snapshot.
 * @param filledGroupIds - From {@link groupIdsFilledByRules}.
 * @param appsByGroup - From {@link appNamesByGroup}.
 * @returns The findings, largest membership first — the biggest unmanaged
 * blast radius is the one worth reading.
 */
export function findUnmaintainedAppAccess(
  groups: readonly OrphanCandidateGroup[],
  filledGroupIds: ReadonlySet<string>,
  appsByGroup: ReadonlyMap<string, readonly string[]>,
): GroupFinding[] {
  return groups
    .filter(
      (group) =>
        group.memberCount > 0 && !filledGroupIds.has(group.id) && appsByGroup.has(group.id),
    )
    .map((group) => {
      const apps = appsByGroup.get(group.id) ?? [];
      const members = `${group.memberCount.toLocaleString()} ${group.memberCount === 1 ? 'member' : 'members'}`;
      return {
        id: group.id,
        name: group.name,
        detail: `${members} · ${apps.join(', ')}`,
        memberCount: group.memberCount,
      };
    })
    .sort((a, b) => b.memberCount - a.memberCount || byName(a, b))
    .map(({ id, name, detail }) => ({ id, name, detail }));
}
