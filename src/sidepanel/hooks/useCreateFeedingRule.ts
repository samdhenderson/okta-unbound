/**
 * @module sidepanel/hooks/useCreateFeedingRule
 * @description The Group Detail rung's create-a-feeding-rule state machine.
 *
 * The group-side answer to the Rules pane's own empty state: *"No rule assigns
 * users to this group."* Creating one used to mean leaving the group, opening
 * the Rules tab and rebuilding the context by hand. This hook owns the draft
 * (name + match expression), the confirm step, and the single
 * `POST /api/v1/groups/rules` that already exists in
 * {@link module:hooks/useOktaApi/ruleWrites} — no new API path, and the write
 * still goes through the scheduler like every other call.
 *
 * ## Why the write is behind a confirm at all
 *
 * A rule is the one thing on this rung that cannot be undone by pressing the
 * opposite button: a rule **grants** memberships as it matches, and deleting it
 * afterwards does not take those memberships back. That asymmetry is what puts
 * the verb in the action strip's disclosure tier and behind a `Modal`
 * (ADR-0039), not its importance.
 *
 * The one real mitigation is structural and is stated rather than assumed:
 * Okta creates a rule **`INACTIVE`**, so nothing is granted until somebody
 * activates it. That is why the success step hands the reader the created rule
 * in the Rules tab instead of quietly closing.
 *
 * ## The expression is checked, never gated on
 *
 * `parseRuleExpression` is the same real parser (ADR-0017) every other surface
 * reads tenant expressions with, and it implements a documented **subset** of
 * Okta EL. So a parse failure is reported as a notice — "this panel could not
 * read that" — and never blocks the write: refusing a valid Okta expression
 * because our subset cannot parse it would be the same error ADR-0017 forbids
 * in the other direction, a local `unevaluable` rendered as a verdict.
 *
 * ## What it deliberately does not predict
 *
 * Nothing here counts the people the rule will place in the group. This rung
 * holds no user inventory to evaluate against, and inventing a number from one
 * would be the assertion ADR-0036 exists to forbid; the confirm says
 * *not predicted*, with the reason, which is a peer of an answer rather than
 * its absence. The consequence copy lives in the modal.
 *
 * ## Cache, and the one thing it does not refresh
 *
 * A successful create drops the org-wide rules snapshot — a 5-minute TTL copy of
 * every group rule that would otherwise hide the new one from every surface that
 * reads it. This hook does not make that call: it belongs to the write itself and
 * lives in {@link module:hooks/useOktaApi/ruleWrites} (ADR-0064), so no rule
 * write can skip it. The open Rules pane's own list is
 * **not** re-fetched in place — `useGroupSource.open` is the only reload it has
 * and it resets the member-source analysis with it, which would silently throw
 * away a walk the admin already paid for. The created rule is reachable from
 * the success step instead.
 *
 * Security: the draft is tenant data (a rule name and an EL expression over
 * profile attributes), so nothing here logs either one — outcomes and the
 * created rule id only.
 */

import { useCallback, useMemo, useState } from 'react';
import { useOktaApi } from './useOktaApi';
import { parseRuleExpression } from '../../shared/ruleEvaluator';
import { unevaluableReasonText } from '../../shared/rules/unevaluableReasonText';
import { MAX_RULE_NAME_LENGTH } from '../../shared/rules/consolidation';
import { createLogger } from '../../shared/utils/logger';
import type { GroupSummary } from '../../shared/types';

const log = createLogger('useCreateFeedingRule');

/** Okta's discriminator for a group rule's condition expression. */
const OKTA_EXPRESSION_TYPE = 'urn:okta:expression:1.0';

/** Okta's rule `type` for a group rule. */
const OKTA_GROUP_RULE_TYPE = 'group_rule';

/** Options for {@link useCreateFeedingRule}. */
export interface UseCreateFeedingRuleOptions {
  /** Tab whose scheduler runs the create. The verb is disabled without one. */
  targetTabId: number | null;
  /** The group the new rule assigns users into — the rule's one target. */
  group: GroupSummary;
}

/** Return shape of {@link useCreateFeedingRule}. */
export interface UseCreateFeedingRuleReturn {
  /** Whether the confirm modal is open. */
  isOpen: boolean;
  /** Open the modal on a fresh draft. */
  open: () => void;
  /** Close the modal and discard the draft (Cancel, Escape, overlay, header close). */
  close: () => void;
  /** Controlled rule-name draft. */
  name: string;
  /** Called with the new rule name on each keystroke. */
  setName: (value: string) => void;
  /**
   * Why the drafted name is not acceptable, or `null`. Only ever length —
   * emptiness disables the confirm without shouting at a field nobody has
   * filled in yet.
   */
  nameError: string | null;
  /** Controlled match-expression draft. */
  expression: string;
  /** Called with the new expression on each keystroke. */
  setExpression: (value: string) => void;
  /**
   * A non-blocking notice about the drafted expression: this panel parses a
   * documented subset of Okta EL, so "we could not read that" is reported and
   * never enforced. `null` when it parsed, or while the field is empty.
   */
  expressionNotice: string | null;
  /** Whether the confirm button may fire (a name, an expression, a tab, nothing in flight). */
  canSubmit: boolean;
  /** True while the create request is in flight. */
  isCreating: boolean;
  /** Message from a failed create, or `null`. */
  error: string | null;
  /** The created rule's name once the write landed, or `null`. Drives the success step. */
  createdRuleName: string | null;
  /** The created rule's id once the write landed, or `null` — the deep link's argument. */
  createdRuleId: string | null;
  /** Run the create (the modal's confirm button). */
  confirm: () => Promise<void>;
}

/**
 * Drive the Group Detail rung's *Create feeding rule* verb: the draft, its
 * checks, the confirmed `POST`, and the created rule.
 *
 * @param options - See {@link UseCreateFeedingRuleOptions}.
 * @returns Draft state plus the open/close/confirm controls.
 *
 * @example
 * ```tsx
 * const createRule = useCreateFeedingRule({ targetTabId, group });
 * <GroupActionBar onCreateFeedingRule={createRule.open} … />
 * <CreateFeedingRuleModal {...createRule} groupName={group.name} />
 * ```
 */
export function useCreateFeedingRule({
  targetTabId,
  group,
}: UseCreateFeedingRuleOptions): UseCreateFeedingRuleReturn {
  const { createGroupRule } = useOktaApi({ targetTabId });

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [expression, setExpression] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRuleName, setCreatedRuleName] = useState<string | null>(null);
  const [createdRuleId, setCreatedRuleId] = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedExpression = expression.trim();

  const nameError =
    trimmedName.length > MAX_RULE_NAME_LENGTH
      ? `Okta allows ${MAX_RULE_NAME_LENGTH} characters; this is ${trimmedName.length}.`
      : null;

  // Parsed on each keystroke, which is free: `parseRuleExpression` goes through
  // the evaluator's own bounded parse memo rather than re-parsing.
  const expressionNotice = useMemo(() => {
    if (!trimmedExpression) return null;
    const parsed = parseRuleExpression(trimmedExpression);
    if (parsed.ok) return null;
    return `${unevaluableReasonText(parsed.reasonCode)} Okta is the authority on its own expression language — this panel reads a subset of it, so the rule may still be valid.`;
  }, [trimmedExpression]);

  const canSubmit =
    targetTabId !== null &&
    trimmedName.length > 0 &&
    nameError === null &&
    trimmedExpression.length > 0 &&
    !isCreating &&
    createdRuleName === null;

  const reset = useCallback(() => {
    setName('');
    setExpression('');
    setError(null);
    setIsCreating(false);
    setCreatedRuleName(null);
    setCreatedRuleId(null);
  }, []);

  const open = useCallback(() => {
    reset();
    setIsOpen(true);
  }, [reset]);

  const close = useCallback(() => {
    setIsOpen(false);
    reset();
  }, [reset]);

  const confirm = useCallback(async () => {
    if (!canSubmit) return;
    setIsCreating(true);
    setError(null);

    try {
      const created = await createGroupRule({
        type: OKTA_GROUP_RULE_TYPE,
        name: trimmedName,
        conditions: { expression: { value: trimmedExpression, type: OKTA_EXPRESSION_TYPE } },
        actions: { assignUserToGroups: { groupIds: [group.id] } },
      });

      if (!created.success || !created.rule) {
        setError(created.error || 'Failed to create the rule');
        return;
      }

      // The org-wide rule snapshot was dropped by the write layer itself
      // (ADR-0064); nothing to invalidate here.
      log.info('Created group rule', { ruleId: created.rule.id, groupId: group.id });
      setCreatedRuleName(created.rule.name);
      setCreatedRuleId(created.rule.id);
    } catch (err) {
      log.error('Failed to create group rule', err);
      setError(err instanceof Error ? err.message : 'Failed to create the rule');
    } finally {
      setIsCreating(false);
    }
  }, [canSubmit, createGroupRule, trimmedName, trimmedExpression, group.id]);

  return {
    isOpen,
    open,
    close,
    name,
    setName,
    nameError,
    expression,
    setExpression,
    expressionNotice,
    canSubmit,
    isCreating,
    error,
    createdRuleName,
    createdRuleId,
    confirm,
  };
}
