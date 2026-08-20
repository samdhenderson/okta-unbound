/**
 * @module sidepanel/components/users/membershipVerdict
 * @description One membership, one verdict: the short badge a Groups-pane row
 * wears, the bucket it is counted in, and the caveat it carries on hover.
 *
 * The row this feeds used to say four things about provenance at once — the raw
 * membership enum, a group-type badge, a hedged caption and a "Prove it" strip —
 * and left the reader to work out which to believe. This module is the single
 * answer they are collapsed into, so the badge, the summary line and the filter
 * pills cannot disagree about what a membership is.
 *
 * ## It never forms a second opinion
 *
 * Every branch here mirrors `shared/membership/sourceLine`'s branch order, and
 * {@link MembershipVerdict.title} is that module's `description` **verbatim**.
 * The badge is a two-word summary of a sentence someone else wrote; if the two
 * ever disagreed, the row would hedge in one place and assert in another.
 *
 * ## A deduction never wears a fact's badge
 *
 * `primary`/`success` are for answers, `warning` for anything the classifier
 * guessed at, and every hedged label carries a `?` so the weight is visible
 * without colour. The one place that is not the classifier's opinion is a
 * membership carrying `provenance` — Okta's own answer, asked for explicitly
 * (ADR-0031) — which is checked first and is the only way a row that was
 * previously hedged can end up with an unhedged badge.
 *
 * ## Labels are deliberately short
 *
 * At the 360px side-panel floor a long pill eats the group name beside it. The
 * candidate count behind `Rule · 3?` is spelled out in full in the row's
 * disclosure, so the badge only has to say *how much to trust this*.
 *
 * Group and rule names are end-user-controllable Okta data; nothing here is
 * logged, and every string it returns is rendered as escaped React text.
 */
import type { BadgeVariant } from '../shared';
import { membershipSourceLine, sourceLineLabel } from '../../../shared/membership/sourceLine';
import { isDeducedAttribution } from '../../../shared/utils/membershipAnalysis';
import type { GroupMembership } from '../../../shared/types';

/**
 * Which of the pane's four accounting categories a membership falls in.
 *
 * These are the summary line's terms and the filter pills' values, and they are
 * the same four so a reader can press the pill for a term they just read. A
 * membership is in exactly one — including a hedged one, which stays in the
 * bucket its source line describes rather than being swept into `unresolved`.
 */
export type MembershipBucket = 'rule' | 'direct' | 'app' | 'unresolved';

/** The pane's bucket filter: one bucket, or no filter at all. */
export type MembershipBucketFilter = 'all' | MembershipBucket;

/** The badge one membership wears. */
export interface MembershipVerdict {
  /** Two words at most — `Rule`, `Rule?`, `Rule · 3?`, `Direct`, `App`, `Unresolved`. */
  label: string;
  /** Badge treatment: an answer is `primary`/`success`, a deduction is `warning`. */
  variant: BadgeVariant;
  /**
   * The full caveat, `membershipSourceLine(membership).description` **verbatim**
   * — never a rewrite. It is what the reader gets on hover, and it is the only
   * place the badge's one word is qualified.
   */
  title: string;
}

/** A verdict plus the bucket it is counted in — the one classification, internally. */
interface ClassifiedMembership extends MembershipVerdict {
  bucket: MembershipBucket;
}

/**
 * The single classification pass. Its branch order mirrors
 * `membershipSourceLine` exactly: provenance first (Okta's own answer outranks
 * anything deduced), then `UNKNOWN` (so a membership that was never classified
 * cannot fall through into a confident branch), then the rest.
 *
 * @param membership - The membership to classify.
 * @returns Its badge and its bucket, derived once.
 */
function classify(membership: GroupMembership): ClassifiedMembership {
  const { membershipType, rules, attribution, group, provenance } = membership;
  const title = membershipSourceLine(membership).description;

  // Okta was asked about this exact membership and answered (ADR-0031). An
  // answer is never hedged, and an empty rule list is Okta positively asserting
  // a manual add rather than saying nothing.
  if (provenance) {
    return provenance.rules.length > 0
      ? { label: 'Rule', variant: 'primary', bucket: 'rule', title }
      : { label: 'Direct', variant: 'success', bucket: 'direct', title };
  }

  if (membershipType === 'UNKNOWN') {
    return { label: 'Unresolved', variant: 'warning', bucket: 'unresolved', title };
  }

  if (membershipType === 'DIRECT') {
    // `Direct?` is not in the design's table, but its `DIRECT, **not deduced**`
    // qualifier requires it: a membership the classifier only *likely* thinks
    // was added by hand may not wear the unhedged `Direct`, and calling it
    // `Unresolved` would contradict its own source line ("Likely added
    // directly") and drop it out of the bucket the Direct pill is for.
    return isDeducedAttribution(attribution)
      ? { label: 'Direct?', variant: 'warning', bucket: 'direct', title }
      : { label: 'Direct', variant: 'success', bucket: 'direct', title };
  }

  // RULE_BASED from here down.
  if (rules.length === 0) {
    // An app-mastered group is explained by *what it is*, which is why the row
    // no longer carries a separate group-type badge: `App` is that badge, doing
    // the only job it ever did honestly.
    if (group.type === 'APP_GROUP') {
      return { label: 'App', variant: 'neutral', bucket: 'app', title };
    }
    return { label: 'Unresolved', variant: 'warning', bucket: 'unresolved', title };
  }

  switch (attribution) {
    case 'exact':
      return { label: 'Rule', variant: 'primary', bucket: 'rule', title };
    case 'inferred':
      return { label: 'Rule?', variant: 'warning', bucket: 'rule', title };
    case 'ambiguous':
      // The count is the candidate set, and the `?` says none of them is
      // credited. `attributionNamesRules(ambiguous)` is false for the same
      // reason the disclosure spells the set out rather than naming one rule.
      return { label: `Rule · ${rules.length}?`, variant: 'warning', bucket: 'rule', title };
  }
}

/**
 * The badge one membership wears.
 *
 * @param membership - The membership to describe.
 * @returns Its label, badge variant, and the full caveat for `title`.
 */
export function membershipVerdict(membership: GroupMembership): MembershipVerdict {
  return classify(membership);
}

/**
 * Which accounting bucket one membership is counted in.
 *
 * Deliberately the same pass as {@link membershipVerdict} rather than a second
 * switch — a badge saying `App` while the summary counted the row as
 * `unresolved` is precisely the drift one classifier prevents.
 *
 * @param membership - The membership to bucket.
 * @returns Its bucket.
 */
export function membershipBucket(membership: GroupMembership): MembershipBucket {
  return classify(membership).bucket;
}

/** Bucket → its term in the summary line, in the order the line reads. */
const BUCKET_TERMS: readonly (readonly [MembershipBucket, string])[] = [
  ['rule', 'by rule'],
  ['direct', 'direct'],
  ['app', 'app-mastered'],
  ['unresolved', 'unresolved'],
];

/** Bucket → the filter pill's label. */
export const BUCKET_PILL_LABELS: Record<MembershipBucket, string> = {
  rule: 'Rule',
  direct: 'Direct',
  app: 'App',
  unresolved: 'Unresolved',
};

/**
 * How many memberships fall in each bucket.
 *
 * @param memberships - The memberships to count.
 * @returns A count per bucket; every bucket is present, including at zero.
 */
export function membershipBucketCounts(
  memberships: readonly GroupMembership[],
): Record<MembershipBucket, number> {
  const counts: Record<MembershipBucket, number> = {
    rule: 0,
    direct: 0,
    app: 0,
    unresolved: 0,
  };
  for (const membership of memberships) counts[membershipBucket(membership)] += 1;
  return counts;
}

/**
 * The pane's accounting line — `"3 by rule · 1 direct · 2 unresolved"`.
 *
 * A zero term is omitted because a row of zeros is noise, but **every non-zero
 * bucket appears**: an accounting surface that silently drops a category is
 * worse than no summary at all, since a reader who trusts it would conclude the
 * dropped rows do not exist.
 *
 * @param memberships - The memberships to summarise.
 * @returns The line, or an empty string when there is nothing to count.
 */
export function membershipSummaryLine(memberships: readonly GroupMembership[]): string {
  const counts = membershipBucketCounts(memberships);
  return BUCKET_TERMS.filter(([bucket]) => counts[bucket] > 0)
    .map(([bucket, term]) => `${counts[bucket]} ${term}`)
    .join(' · ');
}

/**
 * The text one membership is searched by: its group name and the source sentence
 * shown on the row, which is what carries the rule names.
 *
 * Searching the rendered sentence rather than the rule array is deliberate — the
 * reader is filtering what they can see, so "engineering" must match a row whose
 * only visible mention of it is the rule that granted it.
 *
 * @param membership - The membership to describe.
 * @returns Group name and source sentence, joined.
 */
function searchableText(membership: GroupMembership): string {
  const line = membershipSourceLine(membership);
  return `${membership.group.profile.name} ${sourceLineLabel(line)}`.toLowerCase();
}

/**
 * Narrow a membership list to what the pane's filter and bucket pill select.
 *
 * @param memberships - Every membership the user has.
 * @param query - The free-text filter; blank matches everything.
 * @param bucket - The selected pill; `all` matches everything.
 * @returns The matching memberships, in their original order.
 */
export function filterMemberships(
  memberships: readonly GroupMembership[],
  query: string,
  bucket: MembershipBucketFilter,
): GroupMembership[] {
  const needle = query.trim().toLowerCase();
  return memberships.filter((membership) => {
    if (bucket !== 'all' && membershipBucket(membership) !== bucket) return false;
    return needle === '' || searchableText(membership).includes(needle);
  });
}
