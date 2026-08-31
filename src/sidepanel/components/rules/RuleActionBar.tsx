/**
 * @module sidepanel/components/rules/RuleActionBar
 * @description The rule detail rung's verb strip — the ADR-0039 wrapper for a single rule.
 *
 * `UserActionBar` is the reference shape and this follows it exactly: the entity plus one
 * callback per verb in, the `ActionDescriptor[]` and the tier's contents out, and no
 * disclosure button of its own — `ActionBar` owns the **More** control, the region it
 * opens and that region's `aria-controls` target.
 *
 * ## The split, and why it is not the obvious one
 *
 * A rule looks like it has one reversible pair of verbs — activate and deactivate — and it
 * does not. Commit `f30add9` (D-052) pinned the fact that makes the difference:
 * **deactivating a rule removes nobody.** Okta's rule engine only ever adds, so activation
 * writes memberships that deactivation will not take back, and deactivation strands
 * memberships that reactivation will not re-attribute. Neither press undoes the other, so
 * both fail ADR-0039's consequence test and both start behind **More**, with the
 * consequence stated beside the control ({@link RuleLifecycleActions}).
 *
 * *Add target group* joins them there for the reason ADR-0051 §2 records learning the
 * hard way: **a wizard in front of a verb does not move that verb into the row.** The
 * consolidation wizard previews everything and still ends by creating a replacement rule
 * and retiring this one.
 *
 * What is left for the row is genuinely read-only: *Preview impact*, which computes who
 * would stop being attributed and writes nothing.
 *
 * ## `primary`
 *
 * This is a **detail** rung, so ADR-0059's list-rung rule does not apply and ADR-0051's
 * does not either — `primary` names the page's one main verb, as ADR-0030 always said.
 * Here that is *Preview impact*: the thing an admin opens a rule's page to do. A rule that
 * targets no groups has no population to compute a change for, so the verb is omitted and
 * the strip has no `primary` at all — a row of nothing but a **More** control, rather than
 * something promoted to fill the slot.
 *
 * ## What is not here
 *
 * **Delete rule.** `useOktaApi/ruleWrites.ts` implements `deleteGroupRule`, but it is
 * reachable only as the retire half of the consolidation sequence, which owns its own
 * preview and undo capture. There is no standalone delete hook to wire a descriptor to,
 * and ADR-0039 §3 is explicit that the fix for that is declaring the descriptor once a
 * live callback exists — not shipping a control with no path to firing.
 *
 * **Edit condition.** The app performs no in-place rule edit at all
 * (`docs/features-plan.md`), so there is nothing to wire.
 *
 * **View in Okta.** It stays a real `<a>` in the detail view's metadata row rather than
 * becoming a descriptor. A descriptor carries no `href`, so putting it here would mean a
 * `window.open` behind a `<button>` — losing middle-click, open-in-new-window, copy-link
 * and the `rel="noopener noreferrer"` the real anchor states. It is also not a per-rule
 * link (Okta has no per-rule route, see `ruleIdentity`), so the strip is the wrong place
 * to give it verb-level standing.
 */
import React from 'react';
import { ActionBar, type ActionDescriptor } from '../shared';
import RuleLifecycleActions from './RuleLifecycleActions';
import type { FormattedRule } from '../../../shared/types';

/** Props for {@link RuleActionBar}. */
export interface RuleActionBarProps {
  /** The rule being browsed. */
  rule: FormattedRule;
  /**
   * Open the read-only impact preview. Omitted when the rule targets no groups — there
   * is no population to compute a change for, so the verb has no object (ADR-0051 §3).
   */
  onPreviewImpact?: () => void;
  /** Whether the disclosure tier is open. Owned by the tab, so it collapses on a rung change. */
  tierOpen: boolean;
  onTierOpenChange: (open: boolean) => void;
  /** True while a confirmed lifecycle write is in flight. */
  isLifecycleLoading?: boolean;
  /** Whether the activation confirm is armed. */
  isConfirmingActivate: boolean;
  onRequestActivate: () => void;
  onCancelActivate: () => void;
  onConfirmActivate: () => void;
  /** Request deactivation — opens `RuleImpactModal`, which is this verb's confirm. */
  onRequestDeactivate: () => void;
  /** Start the consolidation wizard. Omitted when not wired. */
  onAddTargetGroup?: () => void;
  /** Defaults to `true`; pass `false` in a story, where there is nothing to scroll. */
  sticky?: boolean;
}

/**
 * The rule detail rung's action strip.
 *
 * @example
 * ```tsx
 * <RuleActionBar
 *   rule={rule}
 *   onPreviewImpact={() => impact.open(toImpactInput(rule), 'preview')}
 *   tierOpen={tierOpen}
 *   onTierOpenChange={setTierOpen}
 *   {...lifecycleHandlers}
 * />
 * ```
 */
const RuleActionBar: React.FC<RuleActionBarProps> = ({
  rule,
  onPreviewImpact,
  tierOpen,
  onTierOpenChange,
  isLifecycleLoading,
  isConfirmingActivate,
  onRequestActivate,
  onCancelActivate,
  onConfirmActivate,
  onRequestDeactivate,
  onAddTargetGroup,
  sticky = true,
}) => {
  const actions: ActionDescriptor[] = [
    ...(onPreviewImpact
      ? [
          {
            id: 'preview-impact',
            label: 'Preview impact',
            icon: 'users',
            variant: 'primary',
            onClick: onPreviewImpact,
            title: 'Work out who would stop being attributed to this rule. Writes nothing.',
          } satisfies ActionDescriptor,
        ]
      : []),
  ];

  return (
    <ActionBar
      ariaLabel={`Actions for ${rule.name}`}
      sticky={sticky}
      actions={actions}
      tierOpen={tierOpen}
      onTierOpenChange={onTierOpenChange}
      testId="rule-action-bar"
      expansion={
        /* Mounted whether or not it is open; `ActionBar` holds it out of the tab order
           and the accessible tree with `inert` while closed. */
        <RuleLifecycleActions
          rule={rule}
          isLifecycleLoading={isLifecycleLoading}
          isConfirmingActivate={isConfirmingActivate}
          onRequestActivate={onRequestActivate}
          onCancelActivate={onCancelActivate}
          onConfirmActivate={onConfirmActivate}
          onRequestDeactivate={onRequestDeactivate}
          onAddTargetGroup={onAddTargetGroup}
        />
      }
    />
  );
};

export default RuleActionBar;
