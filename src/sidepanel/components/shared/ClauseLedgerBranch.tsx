/**
 * @module sidepanel/components/shared/ClauseLedgerBranch
 * @description One
 * {@link module:shared/rules/explainExpression.ConnectiveNode} of a
 * {@link ClauseLedger} tree — an `&&`/`||` group, its children indented under a
 * rail, and — when the Kleene walk decided the group's outcome without waiting
 * on every child — the one sentence explaining why an unevaluated child cannot
 * change the answer.
 *
 * Also exports {@link ClauseTreeNodeView}, the leaf-or-branch dispatcher both
 * this component's recursion and {@link ClauseLedger}'s root use, so the two
 * callers cannot drift into different rules for "which component renders this
 * node".
 *
 * ## The Kleene note is read off structured fields, never re-derived from prose
 *
 * `docs/claims.md`: a correctness decision never reads a string written for a
 * human. The note's existence and wording come entirely from
 * {@link module:shared/rules/explainExpression.ConnectiveNode.verdict},
 * `.undecidedChildCount` and `.decidedByChildIndices` — never by counting
 * anything already rendered — and it is never shown when
 * `decidedByChildIndices` is empty, which is also true whenever the verdict
 * itself is `not-evaluated`.
 *
 * The truncation warning works the same way: which of the two sentences appears
 * is keyed off `ConnectiveNode.truncation`, a two-valued union, so the copy says
 * what was actually lost — nesting folded up, or clauses left off the list —
 * rather than one sentence covering both and being wrong half the time.
 *
 * ## Security
 *
 * This module renders only structural facts (a connective kind, counts, and
 * indices) plus its children's own untrusted content — it introduces no new
 * untrusted string of its own, and logs nothing.
 */
import React from 'react';
import Eyebrow from './Eyebrow';
import AlertMessage from './AlertMessage';
import ClauseLedgerClause from './ClauseLedgerClause';
import type { GroupNameResolver } from './RuleExpressionText';
import type {
  ClauseTreeNode,
  ClauseTruncation,
  ConnectiveNode,
} from '../../../shared/rules/explainExpression';

/** Props for {@link ClauseLedgerBranch}. */
export interface ClauseLedgerBranchProps {
  /** The connective group to render. */
  node: ConnectiveNode;
  /** Names group ids inside descendant clauses. */
  resolveGroupName?: GroupNameResolver;
}

/** Props for {@link ClauseTreeNodeView}. */
export interface ClauseTreeNodeViewProps {
  /** Either kind of tree node — dispatched to the matching component. */
  node: ClauseTreeNode;
  /** Names group ids inside descendant clauses. */
  resolveGroupName?: GroupNameResolver;
}

/** Connective kind → the eyebrow label naming both its meaning and its operator. */
const CONNECTIVE_LABEL: Record<ConnectiveNode['kind'], string> = {
  and: 'All must match · AND',
  or: 'Any satisfies · OR',
};

/**
 * Which bound dropped something → what the reader is actually not seeing.
 *
 * Two different losses, so two different sentences: a depth collapse still shows
 * the sub-expression and its verdict on one line and has only folded up the
 * structure beneath it, whereas the clause cap has left whole clauses off the
 * screen. Keyed off {@link module:shared/rules/explainExpression.ClauseTruncation}
 * — a structured field — so neither sentence can be rewritten into the other's
 * meaning by accident.
 */
const TRUNCATION_TEXT: Record<ClauseTruncation, string> = {
  depth:
    'Part of this condition is nested deeper than this view expands, so some of it is not shown.',
  'clause-cap':
    'This condition has more clauses than this view lists, so some of them are not shown.',
};

/**
 * The Kleene-shortcut sentence, or `undefined` when none applies.
 *
 * Fires only when there was something left unevaluated to shortcut
 * (`undecidedChildCount > 0`) and the group's own verdict is already decided by
 * at least one child (`decidedByChildIndices` non-empty) — an AND that fails on
 * two evaluated children with no unevaluated sibling has nothing to excuse, so
 * it gets no note even though `decidedByChildIndices` is non-empty for it too.
 * Only two combinations ever carry that non-empty list
 * (`explainExpression.ts`'s own `decidedByChildIndices`): a passing OR and a
 * failing AND. Every other combination, and every `not-evaluated` verdict,
 * returns `undefined` here.
 */
function kleeneNote(node: ConnectiveNode): string | undefined {
  if (node.verdict === 'not-evaluated') return undefined;
  if (node.undecidedChildCount === 0) return undefined;
  if (node.decidedByChildIndices.length === 0) return undefined;

  const decidedCount = node.decidedByChildIndices.length;
  const checkWord = node.undecidedChildCount === 1 ? 'check' : 'checks';

  if (node.kind === 'or' && node.verdict === 'pass') {
    const subject =
      decidedCount === 1 ? 'One alternative passes' : `${decidedCount} alternatives pass`;
    return `${subject}, so the OR passes — the unevaluated ${checkWord} cannot change it.`;
  }

  if (node.kind === 'and' && node.verdict === 'fail') {
    const subject =
      decidedCount === 1 ? 'One requirement fails' : `${decidedCount} requirements fail`;
    return `${subject}, so the AND fails — the unevaluated ${checkWord} cannot change it.`;
  }

  return undefined;
}

/**
 * Dispatch one tree node to {@link ClauseLedgerClause} or {@link ClauseLedgerBranch}.
 *
 * @param props - See {@link ClauseTreeNodeViewProps}.
 */
export const ClauseTreeNodeView: React.FC<ClauseTreeNodeViewProps> = ({
  node,
  resolveGroupName,
}) =>
  node.node === 'leaf' ? (
    <ClauseLedgerClause leaf={node} resolveGroupName={resolveGroupName} />
  ) : (
    <ClauseLedgerBranch node={node} resolveGroupName={resolveGroupName} />
  );

/**
 * One connective group: its label, its children indented under a rail, and the
 * Kleene-shortcut note when the structured fields say one applies.
 *
 * @param props - See {@link ClauseLedgerBranchProps}.
 */
const ClauseLedgerBranch: React.FC<ClauseLedgerBranchProps> = ({ node, resolveGroupName }) => {
  const note = kleeneNote(node);

  return (
    <div className="space-y-2">
      <Eyebrow>{CONNECTIVE_LABEL[node.kind]}</Eyebrow>

      <div className="space-y-2 border-l-2 border-neutral-200 pl-3">
        {node.children.map((child, index) => (
          <ClauseTreeNodeView
            // Tree nodes carry no stable id of their own; source order is stable
            // for a given explanation, and this list is never reordered.
            key={index}
            node={child}
            resolveGroupName={resolveGroupName}
          />
        ))}
      </div>

      {note && (
        <p className="mt-2 border-t border-neutral-100 pt-2 text-xs text-neutral-600">{note}</p>
      )}

      {node.truncation && (
        <AlertMessage message={{ text: TRUNCATION_TEXT[node.truncation], type: 'warning' }} />
      )}
    </div>
  );
};

export default ClauseLedgerBranch;
