/**
 * @module sidepanel/components/users/BlastRadiusRuleRow
 * @description One rule in the blast-radius report: whether this profile edit
 * moves its verdict about the user, which groups that would touch, and the
 * condition it was judged on.
 *
 * The rule-centric mirror of {@link module:sidepanel/components/users/BlastRadiusGroupRow}.
 * The groups view answers "what access changes"; this one answers "what is
 * driving it", which is the view an admin needs to go and fix a rule rather than
 * a person.
 *
 * ## `undetermined` is neutral, and it is not a fifth shade of "unchanged"
 *
 * At least one of the two evaluations produced no answer, so the pair cannot be
 * compared — the row says exactly that, in the same words `ClauseChecklist`
 * uses, read from the shared `unevaluableReasonText` table rather than rewritten
 * here. Two surfaces giving different sentences for the same reason code is the
 * drift that table exists to prevent. It renders **neutral**: nothing failed,
 * and a `danger` palette would assert in colour what the sentence declines to
 * assert in words (ADR-0017, ADR-0020).
 *
 * ## "Not in force" is not one thing
 *
 * `effect.active` is `false` for both a rule an admin deactivated and one Okta
 * reports as `INVALID` (unevaluable, typically because a group it names was
 * deleted) — a boolean that cannot distinguish "paused on purpose" from
 * "broken" (D-085). `effect.status`, when present, resolves that: `INVALID`
 * gets the shared `ruleStatusBadge` mark — **Broken**, `danger` — the same
 * one every other rule surface uses, instead of the generic neutral "Not in
 * force" pill a deactivated rule keeps.
 *
 * ## The expression wraps; it never truncates
 *
 * A condition clipped at the row's edge and set beside a verdict is actively
 * misleading — the clause that decided the verdict is routinely the one past the
 * ellipsis. It renders in mono and takes whatever height it needs, the rule
 * `ComparisonAttributeRow` applies to a diffed value for the same reason.
 *
 * ## Security
 *
 * Rule names, group names and **condition expressions** are end-user-controllable
 * tenant data. They are rendered through React's escaping only — never
 * `dangerouslySetInnerHTML`, never a hand-built HTML string — and **nothing in
 * this module logs**.
 */
import React from 'react';
import { Badge, ListRow, type BadgeVariant } from '../shared';
import Icon, { type IconType } from '../shared/Icon';
import { unevaluableReasonText } from '../../../shared/rules/unevaluableReasonText';
import { ruleStatusBadge } from '../../../shared/ruleUtils';
import type { RuleEffect, RuleTransition } from '../../../shared/membership/blastRadiusTypes';

/** Props for {@link BlastRadiusRuleRow}. */
export interface BlastRadiusRuleRowProps {
  /**
   * One rule's before/after verdict, straight from `BlastRadiusReport.rules`.
   * Its `ruleName`, `expression` and `targetGroupNames` are untrusted — render
   * only.
   */
  effect: RuleEffect;
}

/** How one {@link RuleTransition} is presented: badge wording, treatment, glyph. */
interface TransitionPresentation {
  /** The badge's visible text. The verdict is never carried by colour alone. */
  readonly label: string;
  /** Badge treatment. `undetermined` is `neutral` — see the module header. */
  readonly variant: BadgeVariant;
  /** Decorative glyph beside the name, or `null` where no direction is claimed. */
  readonly icon: IconType | null;
  /** Glyph colour token. */
  readonly iconClass: string;
}

/** Transition → presentation. */
const transitionPresentation: Record<RuleTransition, TransitionPresentation> = {
  'starts-matching': {
    label: 'Starts matching',
    variant: 'success',
    icon: 'plus',
    iconClass: 'text-success',
  },
  'stops-matching': {
    label: 'Stops matching',
    variant: 'warning',
    icon: 'minus',
    iconClass: 'text-warning',
  },
  'unchanged-match': {
    label: 'Still matches',
    variant: 'neutral',
    icon: null,
    iconClass: 'text-neutral-500',
  },
  'unchanged-no-match': {
    label: 'Still does not match',
    variant: 'neutral',
    icon: null,
    iconClass: 'text-neutral-500',
  },
  undetermined: {
    label: 'Could not be evaluated',
    variant: 'neutral',
    icon: null,
    iconClass: 'text-neutral-500',
  },
};

/** A labelled, wrapping metadata line — "Targets", "Reads". */
const MetaLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <p className="text-xs break-words text-neutral-600">
    <span className="font-medium">{label}: </span>
    {value}
  </p>
);

/**
 * One rule's effect, as a bordered `<li>`.
 *
 * Sits in a `space-y-(--sp-rung)` list (ADR-0029's default separator pattern,
 * spaced through the ADR-0048 role), so the row owns its own border and adds no
 * divider of its own.
 *
 * @param props - See {@link BlastRadiusRuleRowProps}.
 */
const BlastRadiusRuleRow: React.FC<BlastRadiusRuleRowProps> = ({ effect }) => {
  const presentation = transitionPresentation[effect.transition];
  // Absorbed from either side, so report whichever side gave up — after first,
  // since that is the state the admin is about to create.
  const undeterminedReason =
    effect.transition === 'undetermined'
      ? unevaluableReasonText(effect.afterReason ?? effect.beforeReason)
      : null;
  const broken = effect.status === 'INVALID' ? ruleStatusBadge('INVALID') : null;

  return (
    <ListRow as="li" density="compact">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-(--sp-inline)">
          {presentation.icon && (
            // The badge beside it already says the direction in words.
            <Icon
              type={presentation.icon}
              size="xs"
              className={`shrink-0 ${presentation.iconClass}`}
            />
          )}
          <span className="min-w-0 text-sm font-semibold break-words text-neutral-900">
            {effect.ruleName}
          </span>
          <Badge variant={presentation.variant}>{presentation.label}</Badge>
          {/*
            `effect.status` is what makes the second badge specific rather than a
            shrug. It used to read only `effect.active` — a boolean that collapses
            a deactivated rule and an `INVALID` one into the same "Not in force"
            (D-085) — which is true of both but tells an admin nothing about which
            action to take. When Okta reports `INVALID` this now reuses the shared
            `ruleStatusBadge` mapping (the same **Broken**, `danger` mark every
            other rule surface uses) instead of the generic neutral pill; a
            genuinely deactivated rule, or an older fixture with no `status`,
            keeps the original neutral "Not in force" treatment.
          */}
          {broken ? (
            <Badge variant={broken.variant} title={broken.title}>
              {broken.text}
            </Badge>
          ) : (
            !effect.active && (
              <Badge
                variant="neutral"
                title="Okta is not applying this rule — it is deactivated — so it places nobody."
              >
                Not in force
              </Badge>
            )
          )}
        </div>

        {effect.targetGroupNames.length > 0 && (
          <MetaLine label="Targets" value={effect.targetGroupNames.join(', ')} />
        )}
        {effect.touchedAttributes.length > 0 && (
          <MetaLine label="Reads" value={effect.touchedAttributes.join(', ')} />
        )}
        {undeterminedReason && <p className="text-xs text-neutral-600">{undeterminedReason}</p>}

        {effect.expression !== '' && (
          <code className="rounded-md bg-neutral-50 px-2 py-1 font-mono text-xs break-words whitespace-pre-wrap text-neutral-700">
            {effect.expression}
          </code>
        )}
      </div>
    </ListRow>
  );
};

export default BlastRadiusRuleRow;
