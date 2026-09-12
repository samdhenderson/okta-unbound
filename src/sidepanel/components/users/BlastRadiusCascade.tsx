/**
 * @module sidepanel/components/users/BlastRadiusCascade
 * @description The body of a blast-radius cascade disclosure: the rules that read
 * a group this edit moves, and what each of those rules assigns.
 *
 * One component serves **both** Blast Radius row types — a group row passes the
 * single group it is about, a rule row passes each affected group it assigns into
 * — so the copy has one source and the two views cannot drift into saying the
 * same thing two ways.
 *
 * ## It asserts structure and names one absence. It never predicts.
 *
 * Every line here is a fact about the rule inventory's text: this rule reads this
 * group, this is how it named it, these are the groups it assigns. None of it
 * claims the rule will fire — that is the second hop `docs/claims.md` forbids
 * chasing, and the footer says so in as many words rather than hedging each line
 * with a "may".
 *
 * ## No count, and no negative
 *
 * The trigger that opens this carries no tally and a group with no cascade renders
 * nothing at all. The scan under-reports by design (a negated connective and a
 * declined regex pattern both yield no group references), so a count or an
 * emptiness claim would be a completeness assertion the engine cannot back —
 * `docs/claims.md`'s "never bolt a disclaimer onto a number". Rendering only what
 * is present is what keeps the blind spots harmless.
 *
 * ## Security
 *
 * Rule names and group names are untrusted, end-user-controllable tenant data.
 * Rendered through React's escaping only; this module logs nothing.
 */

import React from 'react';
import Badge from '../shared/Badge';
import { isPatternMatch, type CascadeLine } from './cascadeLines';
import type { CascadeDirection } from '../../../shared/membership/blastRadiusTypes';

/** One affected group, and the rules that read it. */
export interface CascadeGroupBlock {
  /** The affected group's Okta id — the React key. */
  readonly groupId: string;
  /** Its display name, for the per-block caption. **Untrusted.** */
  readonly groupName: string;
  /** The rules that read it. Never empty. */
  readonly lines: readonly CascadeLine[];
}

/** Props for {@link BlastRadiusCascade}. */
export interface BlastRadiusCascadeProps {
  /**
   * One entry per affected group. A group row passes exactly one; a rule row
   * passes one per affected group it assigns into.
   *
   * With more than one, each block gains a caption naming its group — with
   * exactly one, the trigger that opened the panel already named it, so the
   * caption would be the duplication this component exists to avoid.
   */
  groups: readonly CascadeGroupBlock[];
}

/**
 * How each direction reads on a badge.
 *
 * The badge text is an assertion about the rule's condition, never about what the
 * rule will do: `Toward matching` says this edit answers the question the clause
 * asks, not that the answer carries the rule. `title` carries the full sentence
 * for the same reason the row cannot — there is no space for it inline.
 */
const directionPresentation: Record<CascadeDirection, { label: string; title: string }> = {
  'toward-match': {
    label: 'Toward matching',
    title: 'This edit satisfies the membership test this rule makes of this group.',
  },
  'away-from-match': {
    label: 'Away from matching',
    title: 'This edit stops satisfying the membership test this rule makes of this group.',
  },
  undetermined: {
    label: 'Uses it both ways',
    title:
      'This rule tests membership of this group in both directions, so this edit does not turn it one way.',
  },
};

/** One rule's line: its name, which way the edit turns it, and what it assigns. */
const CascadeRuleLine: React.FC<{ line: CascadeLine }> = ({ line }) => {
  const direction = directionPresentation[line.direction];

  return (
    <li className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-w-0 flex-wrap items-center gap-(--sp-inline)">
        <span className="min-w-0 text-xs font-medium break-words text-neutral-900">
          {line.ruleName}
        </span>
        <Badge variant="neutral" title={direction.title}>
          {direction.label}
        </Badge>
      </span>
      {line.targetGroupNames.length > 0 && (
        <span className="text-xs break-words text-neutral-600">
          <span className="font-medium">Assigns: </span>
          {line.targetGroupNames.join(', ')}
        </span>
      )}
      {/*
        Only for a pattern match. With a literal id or name the link to the group
        above is self-evident; with a prefix, substring or regex it is not, and the
        pattern itself is already on screen in the rule's own condition.
      */}
      {isPatternMatch(line) && (
        <span className="text-xs text-neutral-500">Matched by name pattern.</span>
      )}
    </li>
  );
};

/**
 * The rules that read the affected group(s) a disclosure was opened for.
 *
 * @param props - See {@link BlastRadiusCascadeProps}.
 */
const BlastRadiusCascade: React.FC<BlastRadiusCascadeProps> = ({ groups }) => {
  if (groups.length === 0) return null;
  const captioned = groups.length > 1;

  return (
    <div className="flex flex-col gap-(--sp-rung)">
      {groups.map((block) => (
        <div key={block.groupId} className="flex min-w-0 flex-col gap-1">
          {captioned && (
            <span className="text-xs font-medium break-words text-neutral-900">
              {block.groupName}
            </span>
          )}
          <ul className="flex flex-col gap-2">
            {block.lines.map((line) => (
              <CascadeRuleLine key={line.ruleId} line={line} />
            ))}
          </ul>
        </div>
      ))}
      {/*
        The named absence, stated once for the whole panel. `docs/claims.md`
        requires the panel to say plainly that prediction stops at one hop — not
        that it repeat the caveat against every line.
      */}
      <p className="text-xs text-neutral-600">
        Whether these rules flip is not predicted &mdash; prediction stops at one hop.
      </p>
    </div>
  );
};

export default BlastRadiusCascade;
