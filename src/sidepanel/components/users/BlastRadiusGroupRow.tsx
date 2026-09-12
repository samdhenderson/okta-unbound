/**
 * @module sidepanel/components/users/BlastRadiusGroupRow
 * @description One group in the blast-radius report: what this profile edit is
 * predicted to do to the user's membership of it, and — with equal standing —
 * what it declines to predict, and why.
 *
 * ## Three kinds, three glyphs, three palettes, three sentences
 *
 * `added` is `success`, `removed` is `warning`, and
 * `not-predicted` is **neutral**. That last one is the load-bearing choice:
 * `ClauseLedger` already settled that a clause this panel declines to
 * evaluate is *not evaluated*, never *failed*, and painting a withheld
 * prediction `danger` would restate in colour exactly what
 * {@link withheldReasonText}'s sentences carefully avoid saying. A removal is
 * `warning` rather than `danger` for the neighbouring reason: losing access is a
 * consequence to flag, not a failure that has occurred.
 *
 * ## The label asserts the prediction
 *
 * The visible label is `Added` / `Removed`: the row states what the edit does to
 * the membership rather than qualifying it. `not-predicted` remains the one
 * place this component declines to say anything, and it always names why.
 *
 * ## The marker is a status, not a control
 *
 * A `role="img"` span with a label, borrowing the silhouette of a chip without
 * being interactive — the pattern `ComparisonAttributeRow`'s `=`/`≠` marker
 * established. It carries its own accessible name because it is the row's only
 * statement of the verdict: the `Eyebrow` above the block is a section label,
 * and a row read out of that context must still say what it means.
 * `not-predicted` wears the `?` that `membershipVerdict` uses for every hedged
 * badge, so a reader who has learned it on the Groups pane already knows it here.
 *
 * ## Security
 *
 * Group names and rule names are end-user-controllable tenant data. They are
 * rendered through React's escaping only, and **nothing in this module logs**.
 */
import React, { useId } from 'react';
import { Badge, Button, ListRow } from '../shared';
import BlastRadiusCascade from './BlastRadiusCascade';
import type { CascadeLine } from './cascadeLines';
import Icon, { type IconType } from '../shared/Icon';
import { BUCKET_PILL_LABELS, type MembershipBucket } from './membershipVerdict';
import type { GroupEffect, GroupEffectKind } from '../../../shared/membership/blastRadiusTypes';

/** Props for {@link BlastRadiusGroupRow}. */
export interface BlastRadiusGroupRowProps {
  /**
   * The predicted effect on one group, straight from
   * `BlastRadiusReport.groups`. Its `groupName`, `ruleName` and
   * `blockingRuleName` are untrusted — render only.
   */
  effect: GroupEffect;
  /**
   * The rules that read this group, when any do. Absent or empty renders **no
   * disclosure and no trigger at all** — never "nothing reads this group", which
   * the cascade scan cannot back (see {@link BlastRadiusCascade}).
   */
  cascade?: readonly CascadeLine[];
  /**
   * Whether the cascade panel is open.
   *
   * Owned by the report rather than this row: the groups/rules pill switch
   * unmounts every row, so local state would silently collapse an open panel on
   * a switch.
   */
  expanded?: boolean;
  /** Toggle the panel. Absent, no trigger renders — a verb with no handler is omitted. */
  onToggle?: (groupId: string) => void;
}

/** How one {@link GroupEffectKind} is presented: label, glyph, and token classes. */
interface KindPresentation {
  /** The marker's accessible name — the verdict in words, never colour alone. */
  readonly label: string;
  /** Glyph from the `Icon` registry, or `null` for the hedged `?` marker. */
  readonly icon: IconType | null;
  /** Marker surface/border/text tokens. */
  readonly markerClass: string;
}

/**
 * Effect kind → presentation. `not-predicted` is deliberately **neutral** — see
 * the module header.
 */
const kindPresentation: Record<GroupEffectKind, KindPresentation> = {
  added: {
    label: 'Added',
    icon: 'plus',
    markerClass: 'border-success-light bg-success-light text-success-text',
  },
  removed: {
    label: 'Removed',
    icon: 'minus',
    markerClass: 'border-warning-light bg-warning-light text-warning-text',
  },
  'not-predicted': {
    label: 'Not predicted',
    icon: null,
    markerClass: 'border-neutral-200 bg-neutral-100 text-neutral-700',
  },
};

/** How Okta currently credits the membership — the badge's full sentence. */
const bucketTitle: Record<MembershipBucket, string> = {
  rule: 'Okta currently credits this membership to a group rule.',
  direct: 'Okta currently credits this membership to a direct add.',
  app: "This group's roster is managed by its application.",
  unresolved: 'Which source grants this membership was never established.',
};

/**
 * Why a prediction was withheld — one complete sentence per reason, each naming
 * the honest cause rather than implying "nothing happens".
 *
 * The reason code is the engine's; the prose is the UI's, kept here because
 * `blastRadiusTypes` ships no copy on purpose. Module-private: a component file
 * that also exports a helper breaks fast refresh, and the sentences are asserted
 * through the rendered row rather than by importing the table.
 *
 * @param effect - The withheld effect. `blockingRuleName` is interpolated where
 *   the reason names a specific rule.
 * @returns A complete sentence, always — including for an effect that somehow
 *   arrives without a reason code.
 */
function withheldReasonText(effect: GroupEffect): string {
  switch (effect.withheldReason) {
    case 'another-active-rule-still-matches':
      return effect.blockingRuleName
        ? `Another active rule (“${effect.blockingRuleName}”) still matches this user, so the membership stays.`
        : 'Another active rule still matches this user, so the membership stays.';
    case 'membership-not-credited-to-rule':
      return 'Okta credits this membership to a direct add, not to a rule, so changing a rule will not remove it.';
    case 'membership-attribution-deduced':
      return 'Which rule grants this membership was never established, so the effect of this change cannot be predicted.';
    case 'rule-unevaluable-after':
      return 'Another rule targeting this group could not be evaluated here, so we cannot say the membership ends.';
    case 'rule-inactive':
      // Deliberately does not say "inactive": this reason fires whenever no
      // candidate rule is ACTIVE, and since D-085 that set includes INVALID —
      // a rule Okta can no longer evaluate, which nobody chose to pause. The
      // engine's `active` boolean collapses the two, so the honest sentence
      // names both. Distinguishing them needs a reason code of its own (D-101).
      return 'Okta is not applying this rule — it is deactivated or no longer evaluable — so it grants nothing either way.';
    case 'app-mastered-group':
      return 'This group is managed by its application, not by group rules.';
    default:
      return 'This effect was not predicted.';
  }
}

/**
 * The row's explanatory line: what moved, or why we declined to say.
 *
 * `ruleName` is set by the engine **iff** exactly one rule is implicated, so an
 * effect without one is a genuinely multi-rule (or rule-less) case and says so,
 * rather than naming whichever rule happened to sort first.
 */
function effectSentence(effect: GroupEffect): string {
  const count = effect.contributingRuleIds.length;
  switch (effect.kind) {
    case 'added':
      if (effect.ruleName) return `Rule “${effect.ruleName}” starts matching this user.`;
      return count > 1
        ? `${count} rules start matching this user.`
        : 'A group rule starts matching this user.';
    case 'removed':
      if (effect.ruleName) return `Rule “${effect.ruleName}” stops matching this user.`;
      return count > 1
        ? `All ${count} rules that place this user in the group stop matching.`
        : 'The rule that places this user in the group stops matching.';
    case 'not-predicted':
      return withheldReasonText(effect);
  }
}

/**
 * One group's predicted effect, as a bordered `<li>`.
 *
 * Sits in a `space-y-(--sp-rung)` list (ADR-0029's default separator pattern,
 * spaced through the ADR-0048 role), so the row owns its own border and adds no
 * divider of its own.
 *
 * @param props - See {@link BlastRadiusGroupRowProps}.
 */
const BlastRadiusGroupRow: React.FC<BlastRadiusGroupRowProps> = ({
  effect,
  cascade,
  expanded = false,
  onToggle,
}) => {
  const presentation = kindPresentation[effect.kind];
  // Only a withheld row shows how Okta credits the membership today: it is the
  // fact that makes "we are not predicting this" legible.
  const bucket = effect.kind === 'not-predicted' ? effect.currentBucket : undefined;

  // Never the group id: a DOM id built from untrusted Okta data is a selector
  // waiting to break, the reason `GroupMembershipRow` gives at its own.
  const disclosureId = useId();
  const discloses = Boolean(cascade?.length) && onToggle !== undefined;

  return (
    <ListRow
      as="li"
      density="compact"
      body={
        discloses ? (
          /*
            `.disclose` animates `grid-template-rows` between 0fr and 1fr, so the
            panel collapses to zero height with no JS measurement and stays
            mounted while closed — held out of the tab order and the
            accessibility tree by `inert`.
          */
          <div
            id={disclosureId}
            className="disclose"
            data-open={expanded}
            inert={!expanded || undefined}
          >
            <div>
              <div className="border-t border-neutral-200 px-(--sp-row-x) pt-2 pb-3">
                <BlastRadiusCascade
                  groups={[
                    {
                      groupId: effect.groupId,
                      groupName: effect.groupName,
                      lines: cascade ?? [],
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          role="img"
          aria-label={presentation.label}
          title={presentation.label}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${presentation.markerClass}`}
        >
          {presentation.icon ? (
            <Icon type={presentation.icon} size="xs" />
          ) : (
            <span aria-hidden="true" className="font-mono text-xs font-bold">
              ?
            </span>
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 flex-wrap items-center gap-(--sp-inline)">
            <span className="min-w-0 text-sm font-semibold break-words text-neutral-900">
              {effect.groupName}
            </span>
            {bucket && (
              <Badge variant="neutral" title={bucketTitle[bucket]}>
                {BUCKET_PILL_LABELS[bucket]}
              </Badge>
            )}
          </span>
          <span className="text-xs break-words text-neutral-600">{effectSentence(effect)}</span>
          {discloses && (
            <Button
              variant="ghost"
              size="xs"
              expanded={expanded}
              controls={disclosureId}
              onClick={() => onToggle?.(effect.groupId)}
              className="self-start"
            >
              Rules that use this group
              <Icon
                type="chevron-right"
                size="sm"
                className={`transition-transform duration-(--dur-quick) ${expanded ? 'rotate-90' : ''}`}
              />
            </Button>
          )}
        </div>
      </div>
    </ListRow>
  );
};

export default BlastRadiusGroupRow;
