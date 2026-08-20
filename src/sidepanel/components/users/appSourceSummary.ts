/**
 * @module sidepanel/components/users/appSourceSummary
 * @description Pure derivation of the Apps pane: one display model per app row, and the pane's summary line.
 *
 * This module has no React and no I/O, which is the structural guarantee
 * `docs/components.md` §"List rows derive; they never fetch" asks for: scrolling
 * the Apps pane cannot start work, because there is nothing here that could.
 * Everything a row shows comes from (a) the assignments already walked by
 * `getUserApps` and (b) the memberships the detail rung already holds.
 *
 * ## The two facts a row must be able to state at once
 *
 * Okta reports **one** scope per app-user and prefers `'USER'` when a user is
 * both directly assigned and in an assigned group. So `scope: 'USER'` means
 * "there is a direct assignment" — never "direct only", never "not via a group".
 * A row that carries `scope: 'USER'` *and* a `grantGroupId` is therefore not a
 * contradiction: **both facts are true, and the row states both** — the `Direct`
 * badge and a `Through {group}` line together. That combination is the thing the
 * old comparison surface could not express, and the reason this pane exists.
 *
 * ## `undefined` is unknown, and stays unknown
 *
 * An absent `grantGroupId` is "Okta named no group here". It is never rendered as
 * "assigned directly" and never as "no group path exists" (ADR-0020: a silent or
 * failed lookup is not an attribution). The row keeps saying so in words.
 *
 * ## The wording is not ours
 *
 * The four states an app assignment can be in, and the exact caveat prose for
 * each, are owned by
 * {@link sidepanel/components/users/comparison/AppScopeIndicator}. This module
 * reuses three of them verbatim rather than inventing a second vocabulary for the
 * same facts; `appSourceSummary.test.ts` renders the real indicator and asserts
 * the strings still match, so the copy cannot drift apart silently.
 *
 * App labels and group names are end-user-controllable Okta data. Nothing here is
 * logged, and every consumer renders the result as escaped React text.
 */
import { membershipSourceLine, sourceLineLabel } from '../../../shared/membership/sourceLine';
import type { GroupMembership } from '../../../shared/types';
import type { AppAssignmentScope } from '../../../shared/schemas/okta';
import type { UserAppAssignment } from '../../hooks/useOktaApi/userOperations';
import type { AppScopeIndicatorState } from './comparison/AppScopeIndicator';
import type { BadgeVariant } from '../shared';

/**
 * The three states this pane can be in for one app.
 *
 * A strict subset of {@link AppScopeIndicatorState}: `'notCompared'` is a
 * comparison-only state (two users, one loaded scope) and has no meaning on a
 * single user's own pane, so it is excluded at the type level rather than left as
 * an unreachable branch.
 */
export type AppSourceState = Extract<AppScopeIndicatorState, AppAssignmentScope | 'unknown'>;

/**
 * The filter buckets the pane's pills toggle.
 *
 * One per {@link AppSourceState}, named for what a reader is looking for rather
 * than for Okta's enum — the raw `USER`/`GROUP` values never reach the screen.
 */
export type AppSourceBucket = 'direct' | 'viaGroup' | 'unknown';

/** Per-bucket totals across every row, including the buckets that are zero. */
export type AppSourceCounts = Record<AppSourceBucket, number>;

/**
 * Group id → the labels of the apps this user gets **through** that group.
 *
 * Only rows whose granting group is actually known appear. A row whose source is
 * unknown contributes to nothing, because guessing which group to file it under
 * is exactly the claim this module refuses to make.
 */
export type AppsByGroupId = Record<string, string[]>;

/**
 * Per-state label, caveat, badge treatment and bucket.
 *
 * The `label` and `caveat` strings are **copied verbatim** from
 * `AppScopeIndicator`'s own `stateStyles` table, which is module-private there.
 * They are re-stated rather than imported because that file is a comparison-view
 * component and this is a pure module; the drift that a copy invites is closed by
 * a test that renders the real indicator and compares, rather than by trust.
 *
 * The badge treatment is the one thing this pane chooses for itself.
 * `AppScopeIndicator` styles all four states neutrally because in a diff row no
 * scope is the interesting one; here the badge is the row's primary answer, so
 * the two answers Okta gave are colour-separated from the non-answer — and never
 * *only* by colour, since the three labels are three different words.
 */
export const APP_SOURCE_COPY: Record<
  AppSourceState,
  { label: string; caveat: string; variant: BadgeVariant; bucket: AppSourceBucket }
> = {
  USER: {
    label: 'Direct',
    caveat:
      'Okta reports a direct assignment to this app for this user. A group may grant the same app as well — Okta reports only one source per app, so this does not rule out a group path.',
    variant: 'success',
    bucket: 'direct',
  },
  GROUP: {
    label: 'Via group',
    caveat:
      'Okta reports this assignment as coming from a group rather than from a direct assignment. Which group is named only where Okta identified it; this never guesses.',
    variant: 'primary',
    bucket: 'viaGroup',
  },
  unknown: {
    label: 'Source unknown',
    caveat:
      'Okta reported no assignment source for this app, so the source is unknown — this is not a way of saying "via group", and not a way of saying "direct".',
    variant: 'warning',
    bucket: 'unknown',
  },
};

/**
 * Apps whose assignment is itself administrative access.
 *
 * Deliberately an **exact, normalized-label allow-list** rather than a substring
 * or keyword heuristic. "Privileged" is a claim about someone's access, and a
 * heuristic that matched `/admin/i` would mark "Admin Handbook (Confluence)" and
 * miss a renamed console — a false badge in both directions. Erring toward *not*
 * marking is the safe failure here: an unmarked privileged app reads as an
 * ordinary row, whereas a wrongly marked one manufactures a finding.
 *
 * Growing this list is adding a line to it. It is not a pattern.
 */
const PRIVILEGED_APP_LABELS: ReadonlySet<string> = new Set([
  'okta admin console',
  'aws account federation',
  'google cloud platform',
  'microsoft azure',
]);

/**
 * Whether an app grants administrative or infrastructure access.
 *
 * @param label - The app's display label, as Okta reported it.
 * @returns `true` only for an exact (case- and whitespace-insensitive) match in
 * {@link PRIVILEGED_APP_LABELS}.
 */
export function isPrivilegedApp(label: string): boolean {
  return PRIVILEGED_APP_LABELS.has(label.trim().toLowerCase());
}

/** One app row's whole rendered model. Every field is derived; none is fetched. */
export interface AppSourceRow {
  /** Okta app id — the row key, and the target of the "Open in Okta" link. */
  id: string;
  /** Display label, as `getUserApps` resolved it (label → name → id). */
  label: string;
  /** Which of the three things this row can say about its source. */
  state: AppSourceState;
  /** The filter bucket this row falls in — one per {@link AppSourceState}. */
  bucket: AppSourceBucket;
  /** Badge text: `Direct`, `Via group` or `Source unknown`. */
  badgeLabel: string;
  /** Badge treatment for {@link badgeLabel}. */
  badgeVariant: BadgeVariant;
  /**
   * The full caveat for this state, verbatim from `AppScopeIndicator`. Rides on
   * the badge's `title` and is spelled out in full inside the disclosure.
   */
  caveat: string;
  /**
   * The row's second line. `Through {group}` when the granting group is known;
   * otherwise {@link caveat} — the honest non-answer, not a blank.
   */
  sourceLine: string;
  /**
   * `true` when {@link sourceLine} names the granting group, `false` when it is
   * the non-answer. The pane renders the second case in italic so a stated
   * absence never reads as a stated fact.
   */
  sourceKnown: boolean;
  /** `true` for an admin-console / infrastructure app — see {@link isPrivilegedApp}. */
  isPrivileged: boolean;
  /**
   * Id of the group Okta credited for this assignment, when one is known — from
   * the zero-cost `expand=user/{id}` embed, or from the explicit fallback walk.
   * Absent means **unknown**, never "none".
   */
  grantGroupId?: string;
  /**
   * The granting group's name, when the user's memberships contain it. Falls back
   * to the group id, which is still a true identifier, rather than dropping a
   * source that is genuinely known.
   */
  grantGroupName?: string;
  /**
   * How the *granting group* was itself granted — `Added by Rule: …`, `Managed by
   * app`, `Rule-managed, rule not identified`, and the rest of
   * {@link module:shared/membership/sourceLine}'s vocabulary.
   *
   * Present only when that group is among the user's memberships, since it is the
   * membership that carries the classification. Reusing `sourceLine` here is what
   * keeps the Apps pane and the Groups pane saying the same thing about the same
   * group.
   */
  grantGroupSourceLine?: string;
  /**
   * Lowercased app label plus granting-group name, pre-joined for the pane's
   * filter. Kept on the row so filtering never rebuilds a haystack per keystroke.
   */
  filterText: string;
}

/** What {@link summarizeAppSources} returns: the rows, the totals, and the line above them. */
export interface AppSourceSummary {
  /** One model per assignment, in the order `getUserApps` returned them. */
  rows: AppSourceRow[];
  /** Totals per bucket, including zeros — the raw material for {@link summary}. */
  counts: AppSourceCounts;
  /** `"{n} direct · {n} via group · {n} unknown source"`; `''` when there are no rows. */
  summary: string;
}

/**
 * Bucket order and wording for the summary line.
 *
 * A list rather than an object so the order is the source's rather than a
 * property-enumeration accident, and so adding a bucket is one entry here plus
 * one compile error in {@link APP_SOURCE_COPY}.
 */
const SUMMARY_TERMS: ReadonlyArray<readonly [AppSourceBucket, string]> = [
  ['direct', 'direct'],
  ['viaGroup', 'via group'],
  ['unknown', 'unknown source'],
];

/**
 * The pane's one-line accounting of where this user's apps come from.
 *
 * A zero term is omitted because "0 unknown source" is noise, but a **non-zero
 * bucket is never dropped**: an accounting surface that silently loses a category
 * is worse than no summary at all, since the reader has no way to tell that the
 * numbers no longer add up to the list beneath them.
 *
 * @param counts - Per-bucket totals.
 * @returns The joined line, or `''` when every bucket is zero.
 */
export function appSourceSummaryLine(counts: AppSourceCounts): string {
  return SUMMARY_TERMS.filter(([bucket]) => counts[bucket] > 0)
    .map(([bucket, word]) => `${counts[bucket]} ${word}`)
    .join(' · ');
}

/**
 * Derive one row's display model.
 *
 * @param app - The assignment as `getUserApps` reported it.
 * @param byGroupId - The user's memberships, indexed by group id.
 * @returns The row model — see {@link AppSourceRow}.
 */
function toRow(app: UserAppAssignment, byGroupId: Map<string, GroupMembership>): AppSourceRow {
  // `scope ?? 'unknown'`: a missing scope is its own state and must never be
  // collapsed into 'GROUP' (AppScopeIndicator's own contract).
  const state: AppSourceState = app.scope ?? 'unknown';
  const copy = APP_SOURCE_COPY[state];

  const membership = app.grantGroupId ? byGroupId.get(app.grantGroupId) : undefined;
  // Falls back to the id rather than to nothing: Okta named a group, and the id
  // is a true (if unfriendly) name for it. Dropping the source because we lack a
  // display name would turn a known answer back into "unknown".
  const grantGroupName = app.grantGroupId
    ? (membership?.group.profile.name ?? app.grantGroupId)
    : undefined;

  const sourceKnown = grantGroupName !== undefined;

  return {
    id: app.id,
    label: app.label,
    state,
    bucket: copy.bucket,
    badgeLabel: copy.label,
    badgeVariant: copy.variant,
    caveat: copy.caveat,
    // The badge says which scope Okta reported; this line says which group, when
    // one is known. A 'USER'-scope row with a known group legitimately shows both.
    sourceLine: sourceKnown ? `Through ${grantGroupName}` : copy.caveat,
    sourceKnown,
    isPrivileged: isPrivilegedApp(app.label),
    grantGroupId: app.grantGroupId,
    grantGroupName,
    grantGroupSourceLine: membership
      ? sourceLineLabel(membershipSourceLine(membership))
      : undefined,
    filterText: `${app.label} ${grantGroupName ?? ''}`.toLowerCase(),
  };
}

/**
 * Derive the whole Apps pane from one user's assignments and memberships.
 *
 * @param apps - Assignments from `getUserApps`, with `grantGroupId` already
 * filled in wherever it is known (embed first, explicit fallback second).
 * @param memberships - The user's group memberships, used only to *name* a group
 * Okta already credited and to explain how that group was itself granted. It is
 * never used to guess a source Okta did not report.
 * @returns The rows, the per-bucket counts, and the summary line.
 */
export function summarizeAppSources(
  apps: UserAppAssignment[],
  memberships: GroupMembership[],
): AppSourceSummary {
  const byGroupId = new Map(memberships.map((m) => [m.group.id, m]));
  const rows = apps.map((app) => toRow(app, byGroupId));

  const counts: AppSourceCounts = { direct: 0, viaGroup: 0, unknown: 0 };
  for (const row of rows) counts[row.bucket] += 1;

  return { rows, counts, summary: appSourceSummaryLine(counts) };
}

/**
 * Invert the rows into "which apps does this group grant this user?".
 *
 * The Groups pane's `Also grants:` line reads this, which is why it is derived
 * here rather than in either pane: both surfaces then describe the same
 * assignment with the same evidence, and neither can drift into a second answer.
 *
 * A row with no known granting group contributes nothing. Filing it under a
 * plausible group would be inventing an attribution, which is the one thing this
 * module will not do.
 *
 * @param rows - Rows from {@link summarizeAppSources}.
 * @returns Group id → app labels, in row order, with duplicates preserved only
 * insofar as Okta reported the same app twice.
 */
export function indexAppsByGroup(rows: AppSourceRow[]): AppsByGroupId {
  const index: AppsByGroupId = {};
  for (const row of rows) {
    if (!row.grantGroupId) continue;
    (index[row.grantGroupId] ??= []).push(row.label);
  }
  return index;
}
