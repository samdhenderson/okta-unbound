/**
 * @module sidepanel/components/shared/GroupReferenceChip
 * @description One group an `isMemberOf*` clause named, rendered as a small
 * primary-tinted chip — the group-reference unit {@link ClauseLedgerClause} rows
 * beneath a leaf clause.
 *
 * ## The tick is complete-or-absent, never a guess
 *
 * A chip only carries a satisfied/unsatisfied glyph when the caller says a
 * {@link module:shared/ruleEvaluator.RuleGroupContext} was actually supplied —
 * {@link GroupReferenceChipProps.hasContext}. Without one, `reference.satisfied`
 * would read as a definite yes/no about membership nobody checked, so the chip
 * shows no glyph at all rather than a misleading one. This mirrors
 * {@link ClauseLedgerClause}'s own rule for `not-evaluated` clauses: an
 * unanswered question is never dressed up as an answer.
 *
 * ## Security
 *
 * `reference.value` and `matchedGroupName` are untrusted, end-user-controllable
 * tenant data (a rule literal and an Okta group name). Rendered through React's
 * escaping only; this module logs nothing.
 */
import React from 'react';
import Icon from './Icon';
import CopyIconButton from './CopyIconButton';
import type { GroupNameResolver } from './RuleExpressionText';
import type { ClauseGroupReference } from '../../../shared/rules/explainExpression';

/** Props for {@link GroupReferenceChip}. */
export interface GroupReferenceChipProps {
  /** The group reference to render — one argument of an `isMemberOf*` call. */
  reference: ClauseGroupReference;
  /**
   * Whether a {@link module:shared/ruleEvaluator.RuleGroupContext} was supplied
   * for this explanation. Gates the satisfied/unsatisfied glyph — see the module
   * header.
   */
  hasContext: boolean;
  /**
   * Names a `match: 'id'` reference's raw group id. Omitted or returning
   * `undefined`, the chip falls back to the raw id in mono.
   */
  resolveGroupName?: GroupNameResolver;
}

/** One reference's label, and whether it should render in the mono pattern style. */
interface ChipLabel {
  readonly text: string;
  readonly mono: boolean;
}

/**
 * The chip's label for one reference.
 *
 * A group actually matched (`matchedGroupName`) always wins — it is the most
 * specific truth available, whichever `match` kind found it. Absent that, `id`
 * resolves through the host's resolver or falls back to the raw id; `name` is
 * already a human label; the three pattern kinds (`nameStartsWith`,
 * `nameContains`, `nameRegex`) never name a single group, so they stay
 * mono-quoted phrases naming the pattern instead — the same convention
 * `ClauseGroupList` uses for these three kinds.
 */
function chipLabel(
  reference: ClauseGroupReference,
  resolveGroupName?: GroupNameResolver,
): ChipLabel {
  if (reference.matchedGroupName) return { text: reference.matchedGroupName, mono: false };

  switch (reference.match) {
    case 'id': {
      const resolved = resolveGroupName?.(reference.value);
      return resolved ? { text: resolved, mono: false } : { text: reference.value, mono: true };
    }
    case 'name':
      return { text: reference.value, mono: false };
    case 'nameStartsWith':
      return { text: `startsWith "${reference.value}"`, mono: true };
    case 'nameContains':
      return { text: `contains "${reference.value}"`, mono: true };
    case 'nameRegex':
      return { text: `matches "${reference.value}"`, mono: true };
  }
}

/**
 * One group reference from an `isMemberOf*` clause, as a small chip.
 *
 * @example
 * ```tsx
 * <GroupReferenceChip reference={reference} hasContext resolveGroupName={resolveGroupName} />
 * ```
 */
const GroupReferenceChip: React.FC<GroupReferenceChipProps> = ({
  reference,
  hasContext,
  resolveGroupName,
}) => {
  const label = chipLabel(reference, resolveGroupName);

  return (
    <span className="border-primary-highlight bg-primary-light text-primary-text inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium">
      {hasContext &&
        (reference.satisfied ? (
          <Icon type="check" size="xs" className="text-success" />
        ) : (
          <Icon type="minus" size="xs" className="text-neutral-400" />
        ))}
      <span className={label.mono ? 'font-mono' : ''}>{label.text}</span>
      {reference.match === 'id' && (
        <CopyIconButton
          value={reference.value}
          label={`Copy group id ${reference.value}`}
          className="shrink-0"
        />
      )}
    </span>
  );
};

export default GroupReferenceChip;
