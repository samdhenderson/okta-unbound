/**
 * @module sidepanel/components/rules/RuleLifecycleActions
 * @description The rule strip's disclosure tier: the verbs that change what the rule does
 * to real memberships, and the confirm each one asks for.
 *
 * The `UserLifecycleActions` shape, applied to a rule. All state lives in the tab
 * (`useRuleLifecycle`, `useRuleConsolidation`, `useRuleImpact`); this renders it and
 * forwards intent.
 *
 * ## Why *both* lifecycle verbs are in here
 *
 * On the user rung the asymmetry is obvious — *Add group* is reversible, *Suspend* is not.
 * A rule looks symmetric and is not, and the reason is the fact commit `f30add9` (D-052)
 * pinned:
 *
 * > **Deactivating a rule removes nobody.**
 *
 * Okta's rule engine only ever *adds*. So activating a rule writes memberships into every
 * target group, and deactivating it later leaves every one of those people exactly where
 * they are — now unattributed, indistinguishable from a manual add. Neither press undoes
 * the other. Both fail ADR-0039's consequence test, so both start in the tier, behind a
 * confirm, with what they cost stated beside the control rather than only inside the
 * modal it opens.
 *
 * That is a change in behaviour, not only in placement: *Activate Rule* used to fire
 * immediately from the rule card, with no gate at all.
 *
 * **Deactivate keeps its existing gate rather than gaining a second one.** `RuleImpactModal`
 * already computes and shows who stops being attributed to the rule before the write
 * happens (Feature B) — a confirm that names the actual blast radius, which is strictly
 * better than the generic sentence a `Modal` here could offer. Adding another dialog in
 * front of it would be two confirms for one verb.
 *
 * ## Add target group is here too, and a wizard is not a reason for the row
 *
 * *Add target group* opens the consolidation wizard, which previews everything before
 * writing — and still belongs in the tier, because ADR-0051 §2 records getting exactly
 * this wrong once: **a wizard in front of a verb does not move that verb into the row.**
 * The test asks what the verb does, and what this one does is create a replacement rule
 * and retire the original.
 *
 * Security: this component issues nothing and logs nothing.
 */
import React from 'react';
import { Button, Eyebrow, Modal } from '../shared';
import type { FormattedRule } from '../../../shared/types';

/** Props for {@link RuleLifecycleActions}. */
export interface RuleLifecycleActionsProps {
  /** The rule these verbs act on. */
  rule: FormattedRule;
  /** True while a confirmed write is in flight (disables the triggers). */
  isLifecycleLoading?: boolean;
  /**
   * Whether the activation confirm is armed. Owned by the tab so it survives nothing —
   * it is deliberately transient — and so the modal cannot outlive the rung.
   */
  isConfirmingActivate: boolean;
  /** Arm the activation confirm. */
  onRequestActivate: () => void;
  /** Dismiss the activation confirm without writing. */
  onCancelActivate: () => void;
  /** Run the armed activation. */
  onConfirmActivate: () => void;
  /**
   * Request deactivation. Opens `RuleImpactModal` in its gating mode, which is this
   * verb's confirm — so there is no second dialog in this component for it.
   */
  onRequestDeactivate: () => void;
  /** Start the "add a target group" consolidation wizard. Omitted when not wired. */
  onAddTargetGroup?: () => void;
}

/** How many groups this rule feeds, said in words, for the consequence sentences. */
const targetPhrase = (rule: FormattedRule): string => {
  const n = rule.groupIds.length;
  if (n === 0) return 'no groups';
  return n === 1 ? '1 group' : `${n} groups`;
};

/**
 * The tier body: the lifecycle verb valid for this rule's status, the consolidation
 * entry point, and the activation confirm.
 *
 * @param props - See {@link RuleLifecycleActionsProps}.
 */
const RuleLifecycleActions: React.FC<RuleLifecycleActionsProps> = ({
  rule,
  isLifecycleLoading = false,
  isConfirmingActivate,
  onRequestActivate,
  onCancelActivate,
  onConfirmActivate,
  onRequestDeactivate,
  onAddTargetGroup,
}) => {
  const isActive = rule.status === 'ACTIVE';

  return (
    <>
      <div className="space-y-(--sp-field)">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow>Rule state</Eyebrow>
          {/*
            Stated once for the band, as on the user rung. Repeating it per button
            would read as a warning about one verb rather than a property of all.
          */}
          <span className="text-xs text-neutral-600">Each asks to confirm</span>
        </div>

        {onAddTargetGroup && (
          <div className="flex flex-wrap items-center justify-between gap-(--sp-field)">
            <span className="text-xs text-neutral-600">
              Creates a replacement rule and retires this one
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              disabled={isLifecycleLoading}
              onClick={onAddTargetGroup}
            >
              Add target group
            </Button>
          </div>
        )}

        {onAddTargetGroup && <div className="h-px bg-neutral-200" />}

        {/*
          The lifecycle verb, alone on its row, with what it costs beside it. Only one of
          the two is ever offered — the other is not a thing you can do to a rule in this
          state, and a disabled button offering it would be a control with no path to
          firing (ADR-0039 §3).
        */}
        <div className="flex flex-wrap items-center justify-between gap-(--sp-field)">
          <span className="text-xs text-danger-text">
            {isActive
              ? 'Stops adding members. Everyone it already added stays where they are.'
              : `Adds every matching user to ${targetPhrase(rule)}. Pausing it again removes nobody.`}
          </span>
          {isActive ? (
            <Button
              variant="danger"
              size="sm"
              icon="pause"
              disabled={isLifecycleLoading}
              onClick={onRequestDeactivate}
            >
              Deactivate rule
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon="bolt"
              disabled={isLifecycleLoading}
              onClick={onRequestActivate}
            >
              Activate rule
            </Button>
          )}
        </div>
      </div>

      {/*
        Activation's confirm. Deactivation has no modal here on purpose: it opens
        `RuleImpactModal`, which names who is affected instead of describing it.
      */}
      <Modal
        isOpen={isConfirmingActivate}
        onClose={onCancelActivate}
        title="Activate rule"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={onCancelActivate}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={onConfirmActivate}>
              Activate
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          <span className="font-semibold">{rule.name}</span> will start adding every user its
          condition matches to {targetPhrase(rule)}.
        </p>
        <p className="mt-2 text-sm text-neutral-700">
          Pausing the rule afterwards does <span className="font-semibold">not</span> remove anyone
          it added — Okta&rsquo;s rule engine only ever adds members. Those people stay in the
          groups, no longer attributed to any rule.
        </p>
      </Modal>
    </>
  );
};

export default RuleLifecycleActions;
