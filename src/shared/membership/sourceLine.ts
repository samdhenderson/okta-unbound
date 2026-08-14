/**
 * @module shared/membership/sourceLine
 * @description What one membership can honestly say about how it was granted.
 *
 * The single source of the sentence two surfaces show for the same evidence: the
 * user-detail memberships list
 * ({@link sidepanel/components/users/GroupMembershipsList}) and the comparison's
 * group diff row
 * ({@link sidepanel/components/users/comparison/GroupSourceIndicator}). It used to
 * live inside the latter, which is why the former silently rendered **nothing** for
 * three of the six cases — `UNKNOWN`, an app-managed group, and a rule-managed
 * membership with no rule attributed. A reader on the detail page saw blank space
 * where the comparison had a full explanation.
 *
 * ## Why the caption is separate from the detail
 *
 * A rule line is a label and a value — "Added by Rule:" then the rule names — and
 * the two surfaces compose them differently: the diff row needs one flat string
 * that truncates as a unit, the detail page renders the caption as its own element
 * so it can sit beside a disclosure. Returning them joined would force one of the
 * two to split a string back apart.
 *
 * ## The four things this refuses to do
 *
 * 1. **Credit one rule when the classifier has a candidate set.** With
 *    `attribution: 'ambiguous'`, `attributionNamesRules` is `false`: the rules are
 *    candidates, so the count is spelled out as unresolved and none is credited.
 * 2. **Collapse several rules into one.** Two rules really can both put the same
 *    user in the same group, so every attributed rule is named.
 * 3. **Turn a missing classification into "added by hand".** `UNKNOWN` exists so a
 *    failed rules fetch cannot masquerade as a confident `DIRECT`.
 * 4. **Let a deduction wear the weight of a fact.** {@link MembershipSourceLine.proven}
 *    comes from `isDeducedAttribution`, whose own contract is that a deduction must
 *    never render as an answer.
 *
 * Rule and group names are end-user-controllable Okta data. Nothing here is logged,
 * and both consumers render the result as escaped React text.
 */
import { attributionNamesRules, isDeducedAttribution } from '../utils/membershipAnalysis';
import type { GroupMembership, MembershipAttribution } from '../types';

/**
 * How a rule is introduced, by the evidence behind the attribution.
 *
 * A candidate from a guess must never be captioned as the rule that added the
 * user, so the three attributions get three distinct phrases —
 * `GroupSourceIndicator.test.tsx` pins that they stay distinct, and that both
 * surfaces use the same ones.
 */
const attributionCaption: Record<MembershipAttribution, string> = {
  exact: 'Added by Rule:',
  inferred: 'Likely added by rule:',
  ambiguous: 'Possible rule:',
};

/** One membership's explanation, split so each surface can compose it its own way. */
export interface MembershipSourceLine {
  /**
   * The phrase that introduces the source. For a rule-attributed membership this
   * is a label expecting a value ("Added by Rule:"); for every other case it is
   * the whole statement ("Added directly", "Managed by app").
   */
  caption: string;
  /**
   * What follows the caption — the attributed rule names and, when there is more
   * than one, how many. Empty when {@link caption} says everything.
   */
  detail: string;
  /** The fuller caveat, spelling out what the line does and does not claim. */
  description: string;
  /**
   * True when the classification was proven from the data, false for a deduction
   * or an absent classification. A surface must not render these two the same
   * weight; it is free to choose *how* they differ.
   */
  proven: boolean;
}

/** Caption and detail joined — for a surface that renders one flat string. */
export function sourceLineLabel(line: MembershipSourceLine): string {
  return line.detail ? `${line.caption} ${line.detail}` : line.caption;
}

/**
 * The hover caveat for a rule-attributed line, kept separate so the three cases
 * read as three sentences rather than a nested ternary.
 *
 * @param namesRules - Whether the attribution licenses crediting the rules as the source.
 * @param deduced - Whether the classification was a deduction rather than a fact.
 * @returns The sentence explaining what the line does and does not claim.
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

/**
 * Explain one membership.
 *
 * Branch order matters: `UNKNOWN` is checked before anything else so a membership
 * that was never classified can never fall through into a confident-sounding
 * branch.
 *
 * @param membership - The membership to explain.
 * @returns Its caption, detail, caveat and evidence weight.
 */
export function membershipSourceLine(membership: GroupMembership): MembershipSourceLine {
  const { membershipType, rules, attribution, group } = membership;
  // A guess and a fact get different weights, from the shared table rather than
  // from a second opinion formed here.
  const deduced = isDeducedAttribution(attribution);

  if (membershipType === 'UNKNOWN') {
    return {
      caption: 'Source not determined',
      detail: '',
      description:
        'This membership was never classified — the group rules it would be checked against could not be loaded. It is not a manual add and not a rule grant; the answer is missing.',
      proven: false,
    };
  }

  if (membershipType === 'DIRECT') {
    return {
      caption: deduced ? 'Likely added directly' : 'Added directly',
      detail: '',
      description: deduced
        ? 'No rule was matched, but not every rule condition could be evaluated, so a manual add is the likely explanation rather than a confirmed one.'
        : 'No active group rule explains this membership, so the user was added to the group by hand.',
      proven: !deduced,
    };
  }

  // RULE_BASED from here down.
  if (rules.length === 0) {
    if (group.type === 'APP_GROUP') {
      return {
        caption: 'Managed by app',
        detail: '',
        description:
          'This group is mastered by an application, which manages its own members. No group rule explains the membership.',
        proven: !deduced,
      };
    }
    return {
      caption: 'Rule-managed, rule not identified',
      detail: '',
      description:
        'The membership is rule-managed, but no rule is attributed to it, so the granting rule cannot be named here.',
      proven: false,
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
    caption: attributionCaption[attribution],
    detail: `${rules.map((r) => r.name).join(', ')}${several}`,
    description: ruleDescription(namesRules, deduced),
    proven: !deduced,
  };
}
