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
import { membershipSourceLine, sourceLineLabel } from '../../../../shared/membership/sourceLine';
import type { GroupMembership } from '../../../../shared/types';

/**
 * Which visual register a line belongs in.
 *
 * - `answer` — proven from the data; rendered as a chip.
 * - `nonAnswer` — a deduction, or an absence of classification; rendered muted
 *   and italic so it never carries the weight of an answer.
 *
 * The *decision* of which one a membership earns is not made here: it is
 * `membershipSourceLine`'s `proven`, shared with the user-detail surface. Only
 * the rendering of that decision is local.
 */
type SourceTone = 'answer' | 'nonAnswer';

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

  const line = membershipSourceLine(membership);
  const label = sourceLineLabel(line);
  const tone: SourceTone = line.proven ? 'answer' : 'nonAnswer';
  return (
    <span
      className={`${baseClasses} ${toneClasses[tone]}`}
      title={`${label} — ${line.description}`}
    >
      {label}
    </span>
  );
};

export default GroupSourceIndicator;
