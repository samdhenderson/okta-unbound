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
 *
 * ## The one join that says something stronger
 *
 * {@link findDormantAccess} is the exception, and ADR-0067 is the reason it is
 * allowed to be. `lastMembershipUpdated` is the single field this app holds that
 * *does* see every write path named above — Workflows, SCIM, HR provisioning,
 * direct API writes and IdP sync all move it — so a group whose date has not
 * moved has genuinely had **nothing written to it**. That is a claim about the
 * org rather than about this app's visibility, and it is one an admin revokes
 * access on, so it comes with three obligations the other joins do not carry: a
 * clock anchored to the last complete read ({@link resolveDormantAnchor}), a
 * threshold of its own ({@link DORMANT_ACCESS_DAYS}), and a narrowed caveat
 * ({@link dormantAccessCaveat}) in place of {@link INVISIBLE_MAINTAINERS}.
 * Nothing here proposes an action: the findings navigate, and never mutate
 * (ADR-0067 §5).
 */
import { pluralize } from '../../../shared/utils/plural';
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
   *
   * {@link findDormantAccess} is the exception: it *labels* an `APP_GROUP`
   * rather than dropping it (ADR-0067 §2).
   */
  type?: string;
  /**
   * Okta's `lastMembershipUpdated`, as the ISO string the response carried.
   *
   * Kept as a string rather than a `Date` because that is what the boundary
   * schema validates it as (`oktaGroupSchema`, ADR-0006) and what the snapshot
   * stores. Optional in every sense: Okta documents it as neither required nor
   * dated in any particular form, so {@link findDormantAccess} parses it
   * defensively and treats anything unreadable as *no evidence* rather than as
   * silence.
   */
  lastMembershipUpdated?: string;
}

/** The minimum a rule row must expose: the groups it assigns users to. */
export interface RuleAssignment {
  /** Group ids the rule adds users to. May be empty. */
  groupIds: readonly string[];
}

/** A rule row for the missing-target join: its assignments, plus who to blame. */
export interface RuleTargets extends RuleAssignment {
  /** Okta rule id. */
  id: string;
  /** Rule name, for display. */
  name: string;
}

/** One rule whose assignment list names a group the org no longer has. */
export interface MissingTargetFinding {
  /** Okta rule id. */
  id: string;
  /** Rule name. */
  name: string;
  /** The target ids with no group behind them, in the rule's own order. */
  missingGroupIds: string[];
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

/**
 * Rules that assign users into a group the org no longer has.
 *
 * `actions.assignUserToGroups.groupIds` is a list of ids Okta does not validate
 * against the group inventory on read, so a rule whose target was deleted still
 * lists it, still reports `ACTIVE`, and does nothing. Every input is a row the
 * snapshot already holds, so this costs **zero requests** — it is a set
 * difference.
 *
 * ## The completeness gate is the whole reason this is not a one-liner
 *
 * The group collection is read **negatively** here: the finding is an id that is
 * *absent*. An absence only means anything if the walk that would have supplied
 * it finished. Against a half-read inventory every rule in the org looks broken,
 * and "this rule is broken" is a strong enough claim that it must not be made
 * off a partial read (ADR-0040 §7). So an incomplete walk suppresses the join
 * entirely rather than softening its wording — the same shape
 * `resolveCount`'s `gates` give the Home reports.
 *
 * @param rules - Rule rows, each carrying its identity and its assignments.
 * @param knownGroupIds - Every group id the snapshot holds.
 * @param groupWalkComplete - Whether the group walk finished. When `false`, the
 * result is empty.
 * @returns One finding per rule with at least one missing target, in input
 * order.
 */
export function findRulesWithMissingTargets(
  rules: readonly RuleTargets[],
  knownGroupIds: ReadonlySet<string>,
  groupWalkComplete: boolean,
): MissingTargetFinding[] {
  if (!groupWalkComplete) return [];
  const findings: MissingTargetFinding[] = [];
  for (const rule of rules) {
    const missingGroupIds = rule.groupIds.filter((id) => !knownGroupIds.has(id));
    if (missingGroupIds.length > 0) {
      findings.push({ id: rule.id, name: rule.name, missingGroupIds });
    }
  }
  return findings;
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

/**
 * Replaces {@link INVISIBLE_MAINTAINERS} for the dormant report — narrower, and
 * true.
 *
 * Verbatim from ADR-0067 §1. `lastMembershipUpdated` is the one signal in this
 * app that *does* see the write paths {@link INVISIBLE_MAINTAINERS} warns
 * about: Workflows, SCIM, HR provisioning, direct API writes and IdP sync all
 * move it. Repeating "anything could be filling this invisibly" under a finding
 * that specifically rules that out would undersell the finding, so this sentence
 * names what the date genuinely cannot show instead.
 */
export const DORMANT_MAINTAINERS =
  'Okta Workflows, SCIM and HR provisioning, direct API writes and IdP group sync ' +
  'all move a group’s membership date, so none of them has written to this group ' +
  'either. What the date cannot show is a maintainer who reviewed the roster and ' +
  'correctly changed nothing.';

/**
 * Why an app-sourced row is a different fact.
 *
 * Verbatim from ADR-0067 §1. `APP_GROUP` rows are labelled rather than excluded
 * (§2): an app group granting access from a dead source directory is among the
 * more serious findings this report can make, and dropping them would silently
 * narrow the population relative to {@link findUnmaintainedAppAccess}.
 */
export const APP_SOURCED_NOTE =
  'Rows marked app-sourced are mastered by another directory: the quiet is that ' +
  'directory’s, not an administrator’s.';

/**
 * The anchor. `when` is the formatted date of the last complete group read.
 *
 * Verbatim from ADR-0067 §1. The claim is only ever true *as of the last full
 * walk* (§3), so the reader is told which clock it is measured on rather than
 * being left to assume "today".
 *
 * @param when - The formatted date of the last completed group walk.
 * @returns The sentence naming the clock.
 */
export const dormantClockNote = (when: string): string =>
  `Measured from the last complete read of your groups, ${when} — not from today. ` +
  `A membership change since then is not yet visible here.`;

/**
 * The caveat shown with the dormant-access report.
 *
 * Verbatim from ADR-0067 §1. {@link PUSH_APPS_ONLY} is kept unchanged: the
 * population still comes out of the `appGroups` collection, and that limit is
 * unaffected by the clock.
 *
 * @param when - The formatted date of the last completed group walk.
 * @returns The full caveat.
 */
export const dormantAccessCaveat = (when: string): string =>
  `${dormantClockNote(when)} ${DORMANT_MAINTAINERS} ${APP_SOURCED_NOTE} ${PUSH_APPS_ONLY}`;

/**
 * The caveat for the state where there is no anchor to name.
 *
 * Not a softening of {@link dormantAccessCaveat}: with no usable anchor the
 * report states no number and lists no names (ADR-0067 §3), so the clock
 * sentence would have no date to carry. Everything that is still true about the
 * population is kept.
 */
export const DORMANT_ACCESS_CAVEAT_UNANCHORED = `${DORMANT_MAINTAINERS} ${APP_SOURCED_NOTE} ${PUSH_APPS_ONLY}`;

/** One day, in milliseconds — the unit both clocks below are expressed in. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long a group's membership must have been silent before the silence is a
 * finding.
 *
 * **Deliberately not {@link module:sidepanel/components/groups/clutterAnalysis}'s
 * `STALE_AGE_DAYS`, and it must not become an import of it.** Sharing one
 * constant across two clocks is what produced `D-077`: `STALE_AGE_DAYS = 365`
 * was reasoned about the *profile* clock and has never been re-derived against
 * this one. The populations differ too — clutter scores every group, while this
 * report has already narrowed to groups that grant app access and that no rule
 * fills, a small, high-consequence set where a shorter window is affordable.
 *
 * The basis for 180 (ADR-0067 §4): an access-granting group in an org with any
 * joiner–mover–leaver flow takes a write roughly per HR cycle, so two
 * consecutive cycles of silence is the first point at which silence is
 * *evidence* rather than noise.
 *
 * **This is reasoning, not a measured distribution.** It inherits `D-077`'s
 * obligation to be re-derived against a real org, and is tightened or loosened
 * only on that evidence. The mitigation in the meantime is that every row shows
 * its *actual* age, so a reader judges the interval instead of trusting the
 * cutoff.
 */
export const DORMANT_ACCESS_DAYS = 180;

/**
 * How stale the anchor itself may be before the report is withheld entirely.
 *
 * Dormancy is measured from the last *complete* group walk, never from now
 * (ADR-0067 §3): `D-076` means a delta can leave a stored
 * `lastMembershipUpdated` frozen, and the error is inverted — every false
 * "dormant" would be a group that is actually churning. A full walk re-reads
 * every row, so every stored date is exact as of that walk, and any delta since
 * can only have made a row fresher.
 *
 * 30 days is an order of magnitude below {@link DORMANT_ACCESS_DAYS}, so the
 * anchor's own lag can never be a material fraction of the silence it certifies.
 */
export const DORMANT_ANCHOR_MAX_AGE_DAYS = 30;

/**
 * What the dormant report says instead of a number when it has never had an
 * anchor at all.
 *
 * Deliberately shaped like the sentences
 * {@link module:sidepanel/components/home/orgFigures} generates for an unread
 * collection: the report is withheld the same way, and the reader is pointed at
 * the read that would restore it.
 */
export const DORMANT_ANCHOR_UNREAD_NOTE =
  'Needs a complete read of your groups, which has not finished yet.';

/**
 * What the dormant report says when its anchor is too old to certify a silence.
 *
 * Names the date rather than only saying "too old", because the reader's next
 * move is to refresh the snapshot and the sentence should make clear how far
 * behind it is.
 *
 * @param when - The formatted date of the last completed group walk.
 * @returns The sentence shown in place of a number.
 */
export const dormantStaleAnchorNote = (when: string): string =>
  `Needs a complete read of your groups from the last ${DORMANT_ANCHOR_MAX_AGE_DAYS} days. ` +
  `The last one finished ${when}.`;

/** Why an anchor cannot be used: never walked at all, or walked too long ago. */
export type DormantAnchorReason = 'never-walked' | 'stale';

/**
 * The clock the dormant report is measured on, or why there is not one.
 *
 * A discriminated union rather than a nullable number, because the two failures
 * are told apart in the copy: "no complete read yet" points somewhere different
 * from "the last complete read is too old".
 */
export type DormantAnchor =
  | { usable: true; at: number; reason?: undefined }
  | { usable: false; at: number | null; reason: DormantAnchorReason };

/**
 * Decide whether the last full group walk can anchor a dormancy claim.
 *
 * `now` is a parameter rather than a `Date.now()` call so the rule is testable
 * and so the one place a wall clock enters this module is visible. Note what it
 * is used for: the *anchor's own* age, never a group's dormancy. A group's
 * silence is always measured against {@link DormantAnchor.at}.
 *
 * @param lastFullWalkAt - Epoch millis of the last completed group walk, or
 * `null` when the collection has never been fully read.
 * @param now - Current epoch millis.
 * @returns The anchor, or the reason there is not one.
 */
export function resolveDormantAnchor(lastFullWalkAt: number | null, now: number): DormantAnchor {
  if (lastFullWalkAt === null) return { usable: false, at: null, reason: 'never-walked' };
  if (now - lastFullWalkAt > DORMANT_ANCHOR_MAX_AGE_DAYS * DAY_MS) {
    return { usable: false, at: lastFullWalkAt, reason: 'stale' };
  }
  return { usable: true, at: lastFullWalkAt };
}

/**
 * The line the dormant report shows in place of a number, for an unusable
 * anchor.
 *
 * @param reason - From {@link DormantAnchor.reason}.
 * @param when - The formatted date of the last completed group walk. Unused for
 * `never-walked`, where there is no date to name.
 * @returns The sentence saying which read is missing.
 */
export function dormantAnchorNote(reason: DormantAnchorReason, when: string): string {
  return reason === 'never-walked' ? DORMANT_ANCHOR_UNREAD_NOTE : dormantStaleAnchorNote(when);
}

/**
 * A span of silence, in the coarsest unit that still reads as a fact.
 *
 * Coarse on purpose: "no membership change in 187 days" invites arithmetic,
 * where "6 months" invites the judgement the row actually wants from the reader.
 *
 * @param days - Whole or fractional days of silence.
 * @returns A phrase like `6 months` or `2 years`.
 */
export function describeDormancy(days: number): string {
  const years = Math.floor(days / 365);
  if (years >= 1) return pluralize(years, 'year');
  return pluralize(Math.max(1, Math.floor(days / 30)), 'month');
}

/**
 * The dormant report's row label, stating its own threshold.
 *
 * Derived from {@link DORMANT_ACCESS_DAYS} rather than written out, so the label
 * cannot drift from the cutoff it describes (ADR-0067 §1).
 *
 * @returns e.g. `App access with no membership change in 6 months`.
 */
export function dormantAccessLabel(): string {
  return `App access with no membership change in ${describeDormancy(DORMANT_ACCESS_DAYS)}`;
}

/**
 * Groups that grant app access, that no rule fills, and into which **no
 * membership write has landed** for {@link DORMANT_ACCESS_DAYS} days.
 *
 * The claim is a step stronger than every other report on the Home tab, and
 * ADR-0067 exists to bound it. `findUnmaintainedAppAccess` can only say *we see
 * nothing filling this*, because Workflows, SCIM, HR provisioning, direct API
 * writes and IdP sync leave no rule behind. All of them move
 * `lastMembershipUpdated`, so a silent date says *nothing filled it* — a fact
 * about the org rather than about this app's visibility.
 *
 * Three things keep that honest, and none of them is optional:
 *
 * - **The clock is the anchor, never `Date.now()`.** See
 *   {@link resolveDormantAnchor}; the caller passes `anchor.at`.
 * - **The threshold is this report's own.** See {@link DORMANT_ACCESS_DAYS}.
 * - **A silent roster is not an absent maintainer.** The field records writes,
 *   not attention, and {@link DORMANT_MAINTAINERS} says so on every row.
 *
 * A row with no `lastMembershipUpdated`, or one Okta sent in a form that does
 * not parse, is **excluded**: the field is end-user-adjacent data from an
 * untrusted response (ADR-0006 — the boundary schema types it as a string, which
 * is not the same as a date), and an unreadable date is not evidence of silence.
 * A date *after* the anchor is likewise no evidence, and falls out of the same
 * comparison.
 *
 * `APP_GROUP` rows stay in, carrying an `app-sourced` marker (ADR-0067 §2).
 * `findCleanupCandidates` excludes them because it is delete-adjacent; this
 * report proposes nothing, so that reason does not transfer.
 *
 * @param groups - Group rows from the snapshot.
 * @param filledGroupIds - From {@link groupIdsFilledByRules}.
 * @param appsByGroup - From {@link appNamesByGroup}.
 * @param anchorAt - Epoch millis of the last completed group walk, from a
 * {@link DormantAnchor} the caller has already found usable.
 * @returns The findings, longest silence first — the report's subject is the
 * silence, so the quietest row leads. (Its sibling sorts by member count
 * instead, because *its* subject is unmanaged reach.) Ties fall back to member
 * count and then to name, so the same org produces the same list twice running.
 */
export function findDormantAccess(
  groups: readonly OrphanCandidateGroup[],
  filledGroupIds: ReadonlySet<string>,
  appsByGroup: ReadonlyMap<string, readonly string[]>,
  anchorAt: number,
): GroupFinding[] {
  const threshold = DORMANT_ACCESS_DAYS * DAY_MS;
  return groups
    .filter(
      (group) =>
        group.memberCount > 0 && !filledGroupIds.has(group.id) && appsByGroup.has(group.id),
    )
    .map((group) => {
      const changedAt = group.lastMembershipUpdated
        ? Date.parse(group.lastMembershipUpdated)
        : Number.NaN;
      return { group, silentFor: anchorAt - changedAt };
    })
    .filter(({ silentFor }) => Number.isFinite(silentFor) && silentFor >= threshold)
    .sort(
      (a, b) =>
        b.silentFor - a.silentFor ||
        b.group.memberCount - a.group.memberCount ||
        a.group.name.localeCompare(b.group.name),
    )
    .map(({ group, silentFor }) => {
      const apps = appsByGroup.get(group.id) ?? [];
      const parts = [
        pluralize(group.memberCount, 'member'),
        apps.join(', '),
        `no membership change in ${describeDormancy(silentFor / DAY_MS)}`,
      ];
      if (group.type === 'APP_GROUP') parts.push('app-sourced');
      return { id: group.id, name: group.name, detail: parts.join(' · ') };
    });
}
