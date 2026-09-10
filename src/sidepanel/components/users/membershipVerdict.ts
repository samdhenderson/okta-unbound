/**
 * @module sidepanel/components/users/membershipVerdict
 * @description One membership, one verdict: the short badge a Groups-pane row
 * wears, the bucket it is counted in, and the explanation it carries on hover.
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
 * ## A deduction and a fact differ by colour
 *
 * `primary`/`success` are for answers, `warning` for anything the classifier
 * deduced: the label states the source either way, and the badge treatment is
 * what carries the difference in weight. The one place that is not the
 * classifier's opinion is a membership carrying `provenance` — Okta's own
 * answer, asked for explicitly (ADR-0031) — which is checked first.
 *
 * That difference is **also published structurally**, as
 * {@link isMembershipAttributionDeduced}. Colour and wording are presentation
 * and are expected to be re-edited; a caller deciding whether it may assert a
 * consequence asks the predicate, never the badge.
 *
 * ## Labels are deliberately short
 *
 * At the 360px side-panel floor a long pill eats the group name beside it. The
 * candidate count behind `Rule · 3` is spelled out in full in the row's
 * disclosure, so the badge only has to name the source.
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
  /** Two words at most — `Rule`, `Rule · 3`, `Direct`, `App`, `Unresolved`. */
  label: string;
  /** Badge treatment: an answer is `primary`/`success`, a deduction is `warning`. */
  variant: BadgeVariant;
  /**
   * The full explanation, `membershipSourceLine(membership).description`
   * **verbatim** — never a rewrite. It is what the reader gets on hover, and it
   * is the only place the badge's one word is expanded on.
   */
  title: string;
}

/** A verdict plus the bucket it is counted in — the one classification, internally. */
interface ClassifiedMembership extends MembershipVerdict {
  bucket: MembershipBucket;
  /**
   * Whether the source this verdict states was **deduced** by the classifier
   * rather than established. This is the structural fact behind the `warning`
   * treatment, and it is deliberately its own field rather than something a
   * caller re-derives from `variant` or `label`: a badge's colour and wording
   * are presentation, and a correctness decision that reads either of them
   * moves the moment someone edits copy. See {@link isMembershipAttributionDeduced}.
   */
  deduced: boolean;
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
      ? { label: 'Rule', variant: 'primary', bucket: 'rule', title, deduced: false }
      : { label: 'Direct', variant: 'success', bucket: 'direct', title, deduced: false };
  }

  if (membershipType === 'UNKNOWN') {
    return { label: 'Unresolved', variant: 'warning', bucket: 'unresolved', title, deduced: true };
  }

  if (membershipType === 'DIRECT') {
    // Both cases say `Direct`; the deduced one is still marked `warning`, so a
    // deduction and a proven manual add differ by badge treatment rather than
    // by wording. Calling the deduced one `Unresolved` would contradict its own
    // source line and drop it out of the bucket the Direct pill is for.
    return isDeducedAttribution(attribution)
      ? { label: 'Direct', variant: 'warning', bucket: 'direct', title, deduced: true }
      : { label: 'Direct', variant: 'success', bucket: 'direct', title, deduced: false };
  }

  // RULE_BASED from here down.
  if (rules.length === 0) {
    // An app-mastered group is explained by *what it is*, which is why the row
    // no longer carries a separate group-type badge: `App` is that badge, doing
    // the only job it ever did honestly.
    if (group.type === 'APP_GROUP') {
      // Not a deduction: the group's own `type` says the application masters the
      // roster. Nothing was guessed, so `deduced` is false even though this
      // verdict names no rule.
      return { label: 'App', variant: 'neutral', bucket: 'app', title, deduced: false };
    }
    return { label: 'Unresolved', variant: 'warning', bucket: 'unresolved', title, deduced: true };
  }

  switch (attribution) {
    case 'exact':
      return { label: 'Rule', variant: 'primary', bucket: 'rule', title, deduced: false };
    case 'inferred':
      return { label: 'Rule', variant: 'warning', bucket: 'rule', title, deduced: true };
    case 'ambiguous':
      // The count is the candidate set. `attributionNamesRules(ambiguous)` is
      // false for the same reason the disclosure spells the set out rather
      // than naming one rule.
      return {
        label: `Rule · ${rules.length}`,
        variant: 'warning',
        bucket: 'rule',
        title,
        deduced: true,
      };
  }
}

/**
 * Whether this membership's stated source was **deduced by the classifier**
 * rather than established — the structural question behind the `warning` badge
 * treatment, asked without reading a badge.
 *
 * `false` only when something answered: a membership carrying `provenance`
 * (Okta's own answer, ADR-0031), an `exact` attribution, a non-deduced direct
 * add, or an `APP_GROUP` whose roster its application owns by definition.
 * `true` for `inferred`, `ambiguous`, a deduced direct add, and `UNKNOWN`.
 *
 * Exists because a caller that must withhold a claim when the cause is only a
 * deduction has to ask that question of *this* classifier — re-reading
 * `membershipType`/`attribution`/`provenance` is the second opinion this module
 * exists to prevent, and matching on {@link MembershipVerdict.label} or
 * `variant` couples a correctness decision to presentation. Gate 5 of
 * `shared/membership/blastRadius.removalEffect` did exactly that, and a copy
 * change that dropped the badges' question marks silently let an `inferred`
 * membership through it.
 *
 * @param membership - The membership to weigh.
 * @returns `true` when the source is a deduction, `false` when it is an answer.
 */
export function isMembershipAttributionDeduced(membership: GroupMembership): boolean {
  return classify(membership).deduced;
}

/**
 * The badge one membership wears.
 *
 * @param membership - The membership to describe.
 * @returns Its label, badge variant, and the full explanation for `title`.
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
