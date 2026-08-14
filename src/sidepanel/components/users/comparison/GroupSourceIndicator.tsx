/**
 * @module sidepanel/components/users/comparison/GroupSourceIndicator
 * @description The per-row detail on a group diff row: how that membership was granted, and how far the answer may be trusted.
 *
 * The sibling of {@link sidepanel/components/users/comparison/AppScopeIndicator}
 * and deliberately built in the same two visual registers: a **chip** is an
 * answer that was proven, and **muted italic text** is anything the reader must
 * not act on as proven — a deduction, or a classification that never happened.
 * That split is not invented here; it is
 * `shared/utils/membershipAnalysis.isDeducedAttribution` (`evidence: 'fact' |
 * 'deduction'`), whose own contract is that "a `deduction` must never be
 * rendered with the visual weight of an answer".
 *
 * ## The three things this component refuses to do
 *
 * 1. **Name one rule when the classifier has a candidate set.** With
 *    `attribution: 'ambiguous'`,
 *    `membershipAnalysis.attributionNamesRules` is `false`: the carried rules are
 *    candidates, so none of them may be *credited* as the source. The row still
 *    lists them — enumerating the whole set is how the user-detail surface
 *    ({@link sidepanel/components/users/GroupMembershipsList}) presents the same
 *    evidence — but under the same "Possible rule:" caption, and with the count
 *    spelled out as candidates rather than as an answer.
 * 2. **Collapse several rules into one.** Two rules really can both put the same
 *    user in the same group, so every attributed rule is named and a row with
 *    more than one says how many.
 * 3. **Turn a missing classification into "added by hand".** `UNKNOWN` exists
 *    precisely so a failed rules fetch cannot masquerade as a confident `DIRECT`
 *    (see `membershipAnalysis.unclassifiedMemberships`), and an *absent*
 *    membership — an app row, or a fixture built without one — renders nothing
 *    at all rather than the weakest of the three answers.
 *
 * The captions are the vocabulary already shipped by `GroupMembershipsList`
 * ("Added by Rule:" / "Likely added by rule:" / "Possible rule:"), verbatim: the
 * same evidence must not read two different ways on two screens.
 *
 * Rule and group names are end-user-controllable Okta data. They are rendered as
 * React text (escaped) and truncate rather than overflow their row; nothing here
 * is logged.
 */
import React from 'react';
import {
  attributionNamesRules,
  isDeducedAttribution,
} from '../../../../shared/utils/membershipAnalysis';
import type { GroupMembership, MembershipAttribution } from '../../../../shared/types';

/**
 * How a rule is introduced, by the evidence behind the attribution.
 *
 * Kept identical to `GroupMembershipsList`'s `attributionLabel` — the phrase a
 * reader learns on the user-detail screen must mean the same thing in the
 * comparison. `GroupSourceIndicator.test.tsx` renders both surfaces and pins
 * that they agree.
 */
const attributionCaption: Record<MembershipAttribution, string> = {
  exact: 'Added by Rule:',
  inferred: 'Likely added by rule:',
  ambiguous: 'Possible rule:',
};

/**
 * Which visual register a line belongs in.
 *
 * - `answer` — proven from the data; rendered as a chip.
 * - `nonAnswer` — a deduction, or an absence of classification; rendered muted
 *   and italic so it never carries the weight of an answer.
 */
type SourceTone = 'answer' | 'nonAnswer';

/** One rendered line: the visible words, the fuller caveat, and its register. */
interface GroupSourceLine {
  /** The visible text — also the accessible name, so no meaning rides on styling. */
  label: string;
  /** The hover caveat, spelling out what the label does and does not claim. */
  description: string;
  /** Chip (`answer`) or muted italic (`nonAnswer`). */
  tone: SourceTone;
}

/** The candidate/attributed rules, as a single escaped, comma-separated string. */
const ruleNames = (membership: GroupMembership): string =>
  membership.rules.map((rule) => rule.name).join(', ');

/**
 * What one membership can honestly say about how it was granted.
 *
 * Branch order matters: `UNKNOWN` is checked before anything else so a
 * membership that was never classified can never fall through into a
 * confident-sounding branch.
 */
function sourceLine(membership: GroupMembership): GroupSourceLine {
  const { membershipType, rules, attribution, group } = membership;
  // A guess and a fact get different registers, from the shared table rather
  // than from a second opinion formed here.
  const deduced = isDeducedAttribution(attribution);
  const tone: SourceTone = deduced ? 'nonAnswer' : 'answer';

  if (membershipType === 'UNKNOWN') {
    return {
      label: 'Source not determined',
      description:
        'This membership was never classified — the group rules it would be checked against could not be loaded. It is not a manual add and not a rule grant; the answer is missing.',
      tone: 'nonAnswer',
    };
  }

  if (membershipType === 'DIRECT') {
    return {
      label: deduced ? 'Likely added directly' : 'Added directly',
      description: deduced
        ? 'No rule was matched, but not every rule condition could be evaluated, so a manual add is the likely explanation rather than a confirmed one.'
        : 'No active group rule explains this membership, so the user was added to the group by hand.',
      tone,
    };
  }

  // RULE_BASED from here down.
  if (rules.length === 0) {
    if (group.type === 'APP_GROUP') {
      return {
        label: 'Managed by app',
        description:
          'This group is mastered by an application, which manages its own members. No group rule explains the membership.',
        tone,
      };
    }
    return {
      label: 'Rule-managed, rule not identified',
      description:
        'The membership is rule-managed, but no rule is attributed to it, so the granting rule cannot be named here.',
      tone: 'nonAnswer',
    };
  }

  // `attributionNamesRules` decides whether the listed rules may be credited as
  // the source at all. When it is false the same rules are still shown — hiding
  // the candidate set would answer even less — but as candidates, never as one
  // rule that did it.
  const namesRules = attributionNamesRules(attribution);
  const several =
    rules.length > 1 ? ` (${rules.length} ${namesRules ? 'rules' : 'candidates, unresolved'})` : '';

  return {
    label: `${attributionCaption[attribution]} ${ruleNames(membership)}${several}`,
    description: ruleDescription(namesRules, deduced),
    tone,
  };
}

/**
 * The hover caveat for a rule-attributed row, kept out of {@link sourceLine} so
 * the three cases read as three sentences rather than a nested ternary.
 *
 * @param namesRules - Whether the attribution licenses crediting the rules as the source.
 * @param deduced - Whether the classification was a deduction rather than a fact.
 * @returns The sentence explaining what the row's caption does and does not claim.
 */
function ruleDescription(namesRules: boolean, deduced: boolean): string {
  if (!namesRules) {
    return 'The classifier could not resolve which rule granted this membership, so everything listed is a candidate rather than the answer, and none of them is credited.';
  }
  if (deduced) {
    return 'Not every rule condition could be evaluated against this user, so the rules listed are the plausible source rather than a confirmed one. Okta does not record which rule added a member.';
  }
  return 'Every rule listed provably matches this user. Okta does not record which rule added a member, so this is the classifier evaluating rule conditions, not an Okta assertion.';
}

/** Classes shared by both registers; the rule text truncates instead of overflowing the row. */
const baseClasses = 'min-w-0 truncate text-xs';

/**
 * The neutral chip recipe for a proven answer — a rule grant is not a problem, so
 * no status colour.
 *
 * Deliberately border-less: with one of these on every row of a long diff, the
 * outline read as a grid of boxes rather than as annotation. The neutral fill is
 * what carries "this is a proven answer" (and is pinned by
 * `GroupSourceIndicator.test.tsx`, which is also why it stays).
 */
const chipClasses = 'rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-700';

/** Muted, un-chipped treatment for a deduction or a missing classification. */
const nonAnswerClasses = 'italic text-neutral-400';

/** Per-tone styling, keyed by {@link SourceTone}. */
const toneClasses: Record<SourceTone, string> = {
  answer: chipClasses,
  nonAnswer: nonAnswerClasses,
};

/** Props for {@link GroupSourceIndicator}. */
interface GroupSourceIndicatorProps {
  /**
   * The membership behind this row, carried whole on `DiffItem.membership`.
   *
   * Optional because `ComparisonDiffTab` is shared with the Apps tab, whose rows
   * have no membership. Absent renders **nothing** — it is not a synonym for a
   * manual add, and must never be shown as one.
   */
  membership?: GroupMembership;
}

/**
 * Renders one group row's source marker: a neutral chip naming the rule (or the
 * manual add) when the classification was proven, muted italic text when it was a
 * deduction or never happened, and nothing at all when no membership was supplied.
 *
 * The visible words are the accessible name — no state is distinguished by colour
 * alone — and the fuller caveat rides on `title`, which also recovers a rule name
 * that had to truncate.
 *
 * @param props - See {@link GroupSourceIndicatorProps}.
 */
const GroupSourceIndicator: React.FC<GroupSourceIndicatorProps> = ({ membership }) => {
  if (!membership) return null;

  const { label, description, tone } = sourceLine(membership);
  return (
    <span className={`${baseClasses} ${toneClasses[tone]}`} title={`${label} — ${description}`}>
      {label}
    </span>
  );
};

export default GroupSourceIndicator;
