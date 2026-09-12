/**
 * @module sidepanel/components/shared/ClauseLedgerClause
 * @description One {@link module:shared/rules/explainExpression.LeafClauseNode} of
 * a {@link ClauseLedger} tree: the clause text (or, for a group-membership
 * clause, a plain-language label), its outcome chip, the group references it
 * named, and the profile evidence that drove it.
 *
 * ## `not-evaluated` is never a failure
 *
 * Exactly the rule `ClauseChecklist` states for its own rows: a clause the
 * evaluator could not resolve renders neutrally, with a reason sentence sourced
 * from {@link UNEVALUABLE_REASON_TEXT} — never the `danger` treatment reserved
 * for a clause that genuinely resolved to `false`.
 *
 * ## The four attribute states
 *
 * Each {@link module:shared/rules/explainExpression.AttributeRead} is one of
 * four distinct facts (`docs/claims.md`): a present value, an explicit `null`,
 * an absent attribute (rendered as the words "not set", never a dash or `0`),
 * or — silently, because it is omitted from `reads` entirely — a read that
 * failed for any other reason. This component only ever sees the first three.
 *
 * ## Security
 *
 * `leaf.expressionText`, `leaf.resolvedValue`, group reference values/names, and
 * every `AttributeRead.value` are untrusted, end-user-controllable tenant data
 * (rule text and Okta profile attributes). Rendered through React's escaping —
 * never `dangerouslySetInnerHTML` — and never logged; this module logs nothing.
 */
import React from 'react';
import Icon, { type IconType } from './Icon';
import RuleExpressionText, { type GroupNameResolver } from './RuleExpressionText';
import StableWidth from './StableWidth';
import GroupReferenceChip from './GroupReferenceChip';
import { UNEVALUABLE_REASON_TEXT } from '../../../shared/rules/unevaluableReasonText';
import {
  ATTRIBUTE_ABSENT,
  type AttributeRead,
  type ClauseStatus,
  type LeafClauseNode,
} from '../../../shared/rules/explainExpression';
import type { RuleExprValue } from '../../../shared/ruleEvaluator';

/** Props for {@link ClauseLedgerClause}. */
export interface ClauseLedgerClauseProps {
  /** The leaf clause to render. */
  leaf: LeafClauseNode;
  /** Names the group ids inside the clause text and its group references. */
  resolveGroupName?: GroupNameResolver;
}

/** How one {@link ClauseStatus} is presented — copied verbatim from `ClauseChecklist`. */
interface StatusPresentation {
  readonly label: string;
  readonly icon: IconType;
  readonly chipClass: string;
  readonly iconClass: string;
}

/**
 * Clause status → presentation. `not-evaluated` is the neutral palette on
 * purpose — see the module header.
 */
const statusPresentation: Record<ClauseStatus, StatusPresentation> = {
  pass: {
    label: 'Pass',
    icon: 'check',
    chipClass: 'border-success-light bg-success-light text-success-text',
    iconClass: 'text-success',
  },
  fail: {
    label: 'Fail',
    icon: 'alert',
    chipClass: 'border-danger-light bg-danger-light text-danger-text',
    iconClass: 'text-danger',
  },
  'not-evaluated': {
    label: 'Not evaluated',
    icon: 'minus',
    chipClass: 'border-neutral-200 bg-neutral-100 text-neutral-700',
    iconClass: 'text-neutral-500',
  },
};

/** The widest label the chip track has to hold — derives from the table, never re-typed. */
const WIDEST_STATUS = Object.values(statusPresentation).reduce((a, b) =>
  b.label.length > a.label.length ? b : a,
);

/** One clause's outcome chip. */
const StatusChip: React.FC<{ presentation: StatusPresentation }> = ({ presentation }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${presentation.chipClass}`}
  >
    <span aria-hidden="true" className="inline-flex">
      <Icon type={presentation.icon} size="sm" className={presentation.iconClass} />
    </span>
    {presentation.label}
  </span>
);

/**
 * Plain-language label for a group-membership clause, in place of its raw EL
 * text: an admin reads "Member of any of these groups" faster than
 * `isMemberOfAnyGroup("00g1", "00g2")`. Polarity is stated in words — `Not` is
 * the only thing that changes between the two readings of the same call.
 */
const GroupClauseLabel: React.FC<{ leaf: LeafClauseNode }> = ({ leaf }) => {
  const count = leaf.groupReferences?.length ?? 0;
  const noun = count === 1 ? 'this group' : 'any of these groups';

  return (
    <span className="min-w-0 text-xs text-neutral-900">
      {leaf.groupRequirement === 'non-member' ? (
        <>
          <strong>Not</strong> a member of {noun}
        </>
      ) : (
        <>Member of {noun}</>
      )}
    </span>
  );
};

/**
 * Render one attribute value: strings keep their quotes, `null` prints as
 * `null`, and a multi-valued attribute joins its entries — never through
 * `String(value)`, which would make `["a","b"]` indistinguishable from the
 * single string `"a,b"`.
 */
function formatAttributeValue(value: RuleExprValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return value.map(formatAttributeValue).join(', ');
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

/** One `path → value` evidence line. Absent is never zero — see the module header. */
const AttributeReadLine: React.FC<{ read: AttributeRead }> = ({ read }) => (
  <p className="text-xs text-neutral-500">
    <span className="font-mono">{read.path}</span> →{' '}
    {read.value === ATTRIBUTE_ABSENT ? (
      <span>not set</span>
    ) : (
      <span className="font-mono text-xs text-neutral-700">{formatAttributeValue(read.value)}</span>
    )}
  </p>
);

/**
 * One leaf clause: its text (or plain-language group-membership label), outcome
 * chip, group references, evidence, and reason sentence.
 *
 * @param props - See {@link ClauseLedgerClauseProps}.
 */
const ClauseLedgerClause: React.FC<ClauseLedgerClauseProps> = ({ leaf, resolveGroupName }) => {
  const presentation = statusPresentation[leaf.status];
  const isGroupClause = leaf.groupRequirement !== undefined;

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-(--sp-card)">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        {isGroupClause ? (
          <GroupClauseLabel leaf={leaf} />
        ) : (
          <RuleExpressionText
            text={leaf.expressionText}
            resolveGroupName={resolveGroupName}
            className="min-w-0"
          />
        )}
        <StableWidth reserve={<StatusChip presentation={WIDEST_STATUS} />} align="end">
          <StatusChip presentation={presentation} />
        </StableWidth>
      </div>

      {/*
        `groupReferences` is only ever populated when the explanation was given a
        `RuleGroupContext` (`explainExpression.ts`'s `groupClauseFactsOf` returns
        early without one), so a reference row rendered here always has a real
        satisfied/unsatisfied verdict behind it.
      */}
      {leaf.groupReferences && leaf.groupReferences.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {leaf.groupReferences.map((reference) => (
            <GroupReferenceChip
              key={`${reference.match}-${reference.value}`}
              reference={reference}
              hasContext
              resolveGroupName={resolveGroupName}
            />
          ))}
        </div>
      )}

      {leaf.reads.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {leaf.reads.map((read) => (
            <AttributeReadLine key={read.path} read={read} />
          ))}
        </div>
      )}

      {leaf.reasonCode && (
        <p className="mt-1 text-xs text-neutral-600">{UNEVALUABLE_REASON_TEXT[leaf.reasonCode]}</p>
      )}
    </div>
  );
};

export default ClauseLedgerClause;
