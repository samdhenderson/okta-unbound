/**
 * @module sidepanel/components/shared/useClauseLedger
 * @description Logic for {@link ClauseLedger}: memoises the tree explanation and
 * owns the tree/raw view toggle, so the component itself is pure layout.
 *
 * Extracted per `docs/state-management.md` — a component composes primitives and
 * a hook carries the state, rather than growing the JSX with `useMemo`/`useState`
 * calls of its own.
 */
import { useMemo, useState } from 'react';
import {
  explainRuleExpression,
  type RuleExplanation,
} from '../../../shared/rules/explainExpression';
import type { RuleGroupContext } from '../../../shared/ruleEvaluator';
import type { OktaUser } from '../../../shared/types';
import type { GroupNameResolver } from './RuleExpressionText';

/** Options for {@link useClauseLedger}. */
export interface UseClauseLedgerOptions {
  /** Cap on clause rows / tree leaves. See {@link module:shared/rules/explainExpression.ExplainRuleOptions.maxClauses}. */
  maxClauses?: number;
  /**
   * The user's **complete** group list — see
   * {@link module:sidepanel/components/groups/detail/ClauseChecklist}'s prop doc
   * for why a partial list must never be passed.
   */
  groupContext?: RuleGroupContext;
  /** Names group ids the {@link groupContext} cannot. Never fetches. */
  resolveGroupName?: GroupNameResolver;
  /** Initial state of the raw/tree toggle. Defaults to `false` (tree view). */
  defaultShowRaw?: boolean;
}

/** What {@link useClauseLedger} returns. */
export interface UseClauseLedgerResult {
  /** The explanation — `tree` is what `ClauseLedger` renders. */
  explanation: RuleExplanation;
  /**
   * The merged name resolver: `groupContext` entries first (Okta returned these
   * rows for this user), then the host's own resolver. `undefined` when neither
   * source can name anything, so callers keep the same raw-id fallback they had
   * before either existed.
   */
  resolveGroupName?: GroupNameResolver;
  /** Whether the raw-expression view is showing. */
  showRaw: boolean;
  /** Flips {@link showRaw}. */
  toggleRaw: () => void;
}

/**
 * Explain a rule condition against a user and own the ledger's view-toggle state.
 *
 * @param expression - The rule's condition expression (untrusted Okta data).
 * @param user - The user to explain the condition against.
 * @param options - See {@link UseClauseLedgerOptions}.
 */
export function useClauseLedger(
  expression: string,
  user: OktaUser,
  options: UseClauseLedgerOptions = {},
): UseClauseLedgerResult {
  const {
    maxClauses,
    groupContext,
    resolveGroupName: resolveFromHost,
    defaultShowRaw = false,
  } = options;

  const explanation = useMemo(
    () => explainRuleExpression(expression, user, { maxClauses, groups: groupContext }),
    [expression, user, maxClauses, groupContext],
  );

  // Same merge `ClauseChecklist` uses: membership names first (Okta returned
  // these rows for this user), the host's resolver second.
  const resolveGroupName = useMemo<GroupNameResolver | undefined>(() => {
    const namesById = new Map((groupContext ?? []).map((entry) => [entry.id, entry.name]));
    if (namesById.size === 0 && !resolveFromHost) return undefined;
    return (groupId) => namesById.get(groupId) ?? resolveFromHost?.(groupId);
  }, [groupContext, resolveFromHost]);

  const [showRaw, setShowRaw] = useState(defaultShowRaw);
  const toggleRaw = (): void => setShowRaw((previous) => !previous);

  return { explanation, resolveGroupName, showRaw, toggleRaw };
}
