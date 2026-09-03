/**
 * @module sidepanel/components/rules/RuleDetailView
 * @description The rule detail rung: one rule's condition, the attributes it reads, the
 * groups it feeds, its conflicts and its provenance — under the rung's own `ActionBar`.
 *
 * ## Why a rung and not a bigger card
 *
 * All of this was the expanded body of `RuleCard`, and ADR-0030's inventory named that
 * body as one of the five layout dialects the app had for what is conceptually one thing —
 * eyebrow blocks on `bg-neutral-50`, `tracking-wider`, a hand-laid action row. It was the
 * last of the five never converted. Three things follow from converting it:
 *
 * - **The verbs get a strip.** Four of them were flex-wrapped at the bottom of a card
 *   body, which is exactly the "the page's main verb read as a section's property" failure
 *   ADR-0030 §2 exists to stop. They are now {@link RuleActionBar}, split by the
 *   consequence test rather than by what fitted.
 * - **The sections get the shared primitive.** `DetailSection`'s `tracking-wide` eyebrow
 *   is the survivor of the `tracking-wide`/`tracking-wider` split this body was on the
 *   wrong side of.
 * - **There is room.** Feature H — the clause-level rule explainer — names "a rule's card
 *   in the Rules tab" as its surface (`docs/features-plan.md` §H), and a per-clause pass /
 *   fail breakdown against a picked user does not fit in a list row's disclosure. It fits
 *   here.
 *
 * A `DetailSection` **stack**, not tabbed panes. `docs/components.md` reserves the tabbed
 * shape for a rung answering several questions about one entity — Groups and Users each
 * have five or more sections and two independent loads. A rule has one condition and
 * three facts about it, all already in hand, and splitting four short sections across tabs
 * would hide three of them to save a scroll that does not exist.
 *
 * ## What it does not do
 *
 * **It fetches nothing.** Everything here is already on the `FormattedRule` the list was
 * rendering; pushing the rung costs no API call. That is what lets `RulesTab` push it
 * straight from a row without a loading state.
 */
import React from 'react';
import { CopyableId, DetailSection, EntityLink } from '../shared';
import Icon from '../shared/Icon';
import RuleActionBar from './RuleActionBar';
import type { FormattedRule } from '../../../shared/types';

/** Props for {@link RuleDetailView}. */
export interface RuleDetailViewProps {
  /** The rule being browsed. */
  rule: FormattedRule;
  /** Okta org origin, for the Admin Console rules-page link. */
  oktaOrigin?: string | null;
  /** Open the read-only impact preview. Omitted when the rule targets no groups. */
  onPreviewImpact?: () => void;
  /** Whether the strip's disclosure tier is open. */
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
 * A target id the org has no group for — a rule assigning users into a group
 * that was deleted (D-061).
 *
 * Distinct from the id-only mode of {@link sidepanel/components/shared/EntityLink},
 * which is what an unresolved target renders as, and the distinction is the point:
 * one says *this view has not learned the name*, the other says *there is nothing
 * left to name*. The second is only ever rendered when the group walk finished,
 * so it is a proven answer and takes a warning's weight; the first is a
 * non-answer and keeps its muted, un-chipped register.
 */
const MissingGroupChip: React.FC<{ groupId: string }> = ({ groupId }) => (
  <span
    className="inline-flex max-w-full items-center gap-1 rounded-md border border-warning bg-warning-light px-2 py-0.5 text-xs"
    title="No group in this org has this id. The rule still lists it, and adds nobody to it."
  >
    <Icon type="alert" size="xs" className="shrink-0 text-warning-text" />
    <span className="shrink-0 text-warning-text">Group no longer exists</span>
    <CopyableId value={groupId} label={`Copy group id ${groupId}`} />
  </span>
);

/**
 * Render a condition expression, swapping recognised group ids for the shared
 * {@link EntityLink} badge where a name is known.
 *
 * Carried over from `RuleCard`. The badge *replaces* the literal it stood for and so
 * carries `copyId` — the same trade `RuleExpressionText` makes — and its copy control
 * names the **id**, not the group, because two groups in one condition can share a display
 * name and the derived default would collide (I-009). An id with no known name is left
 * verbatim: this is source text, and a bare id in mono inside a `<code>` already reads as
 * an id rather than as a name.
 *
 * @param expression - The raw condition expression.
 * @param allGroupNamesMap - Group id to display name, when the org snapshot resolved them.
 * @returns Nodes for the expression, with group-name badges interleaved.
 */
const renderConditionWithGroupBadges = (
  expression: string,
  allGroupNamesMap?: Record<string, string>,
): React.ReactNode => {
  if (!allGroupNamesMap || Object.keys(allGroupNamesMap).length === 0) return expression;

  const groupIdPattern = /\b00g[a-zA-Z0-9]{17}\b/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = groupIdPattern.exec(expression)) !== null) {
    const groupId = match[0];
    const groupName = allGroupNamesMap[groupId];

    if (match.index > lastIndex) parts.push(expression.substring(lastIndex, match.index));

    if (groupName && groupName !== groupId) {
      parts.push(
        <EntityLink
          key={`${groupId}-${match.index}`}
          type="group"
          id={groupId}
          name={groupName}
          copyId
          copyIdLabel={`Copy group id ${groupId}`}
          className="align-middle"
        />,
      );
    } else {
      parts.push(groupId);
    }

    lastIndex = match.index + groupId.length;
  }

  if (lastIndex < expression.length) parts.push(expression.substring(lastIndex));

  return parts.length > 0 ? parts : expression;
};

/**
 * The rule detail rung.
 *
 * The header is not here — `RulesTab` keeps one `PageHeader` and feeds it
 * {@link ruleIdentity}, per ADR-0032. So this opens on the strip and then on its first
 * real section, and never repeats the rule's name, status, id or counts.
 *
 * @param props - See {@link RuleDetailViewProps}.
 */
const RuleDetailView: React.FC<RuleDetailViewProps> = ({
  rule,
  oktaOrigin,
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
  const hasConflicts = Boolean(rule.conflicts && rule.conflicts.length > 0);
  const missingTargetCount = rule.missingGroupIds?.length ?? 0;

  return (
    <div className="space-y-(--sp-rung)">
      <RuleActionBar
        rule={rule}
        onPreviewImpact={onPreviewImpact}
        tierOpen={tierOpen}
        onTierOpenChange={onTierOpenChange}
        isLifecycleLoading={isLifecycleLoading}
        isConfirmingActivate={isConfirmingActivate}
        onRequestActivate={onRequestActivate}
        onCancelActivate={onCancelActivate}
        onConfirmActivate={onConfirmActivate}
        onRequestDeactivate={onRequestDeactivate}
        onAddTargetGroup={onAddTargetGroup}
        sticky={sticky}
      />

      <DetailSection
        title="When"
        description="The condition Okta evaluates against every user in the org."
      >
        <div className="rounded-md border border-neutral-200 bg-white p-(--sp-card)">
          <code className="block overflow-x-auto font-mono text-sm text-neutral-900">
            {renderConditionWithGroupBadges(
              rule.conditionExpression || rule.condition,
              rule.allGroupNamesMap,
            )}
          </code>
        </div>

        {rule.userAttributes.length > 0 && (
          <div className="mt-(--sp-card)">
            <p className="mb-2 text-xs text-neutral-600">Profile attributes it reads</p>
            <div className="flex flex-wrap gap-(--sp-inline)">
              {rule.userAttributes.map((attr) => (
                <span
                  key={attr}
                  className="rounded-md border border-primary-highlight bg-primary-light px-2.5 py-1 text-sm font-medium text-primary-text"
                >
                  {attr}
                </span>
              ))}
            </div>
          </div>
        )}
      </DetailSection>

      <DetailSection
        title="Then add to groups"
        description={
          rule.groupIds.length > 0
            ? missingTargetCount > 0
              ? `Everyone the condition matches is added to each of these. ${missingTargetCount === 1 ? 'One target no longer exists' : `${missingTargetCount} targets no longer exist`}, so that part of the rule does nothing.`
              : 'Everyone the condition matches is added to each of these.'
            : undefined
        }
      >
        {rule.groupIds.length > 0 ? (
          <div className="flex flex-wrap gap-(--sp-inline)">
            {rule.groupIds.map((groupId, index) => {
              const groupName = rule.groupNames?.[index];
              // A `groupNames` entry equal to the id is the upstream formatter's own
              // "unresolved" marker, not a name.
              const resolvedName = groupName !== groupId ? groupName : undefined;
              // Only the producer knows whether the group inventory was complete
              // enough to read an absence as a deletion, so this reads its verdict
              // rather than re-deriving one from a missing name (D-061).
              const isMissing = rule.missingGroupIds?.includes(groupId) ?? false;

              if (isMissing) return <MissingGroupChip key={groupId} groupId={groupId} />;

              return resolvedName ? (
                <EntityLink
                  key={groupId}
                  type="group"
                  id={groupId}
                  name={resolvedName}
                  copyId
                  copyIdLabel={`Copy group id ${groupId}`}
                />
              ) : (
                /*
                  Known only by id. `EntityLink` with no `name` states the absence in
                  the non-answer register, shows the id, and — unlike the local chip
                  this replaced (I-017) — still opens the group, since a valid id is a
                  valid destination whether or not this view learned its name.
                */
                <EntityLink
                  key={groupId}
                  type="group"
                  id={groupId}
                  unresolvedReason="This rule assigns to this group id. No name for it was loaded into this view."
                />
              );
            })}
          </div>
        ) : (
          /*
            Stated, not omitted. A rule with no target groups matches users and then does
            nothing with them, which is a finding — and it is why the strip omits
            *Preview impact* here, so without this sentence the page would be quietly
            missing both the fact and its consequence.
          */
          <p className="text-sm text-neutral-500">
            This rule assigns to no groups, so it adds nobody anywhere. Its condition is evaluated
            and the result is discarded.
          </p>
        )}
      </DetailSection>

      {hasConflicts && (
        <DetailSection
          title="Conflicts"
          description="Other loaded rules whose conditions overlap this one."
        >
          <div className="space-y-2">
            {rule.conflicts!.map((conflict, idx) => (
              <div
                key={idx}
                className="rounded-md border border-warning bg-warning-light p-(--sp-card)"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
                      conflict.severity === 'high'
                        ? 'border border-danger-light bg-danger-light text-danger-text'
                        : 'border border-warning bg-warning-light text-warning-text'
                    }`}
                  >
                    {conflict.severity}
                  </span>
                  <div className="flex-1">
                    <div className="mb-1 text-sm text-neutral-900">
                      Conflicts with: <span className="font-semibold">{conflict.rule2.name}</span>
                    </div>
                    <div className="text-xs text-neutral-600">{conflict.reason}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {oktaOrigin && (
        <DetailSection title="In Okta">
          {/*
            A real `<a>`, not an `OpenInOktaLink` and not a strip descriptor. Okta's Admin
            Console has **no per-rule route** — `OktaAdminEntityType` is group / user / app
            — so the honest target is the org's rules list, and the copy says so rather
            than implying this opens the rule. See `ruleIdentity` for why the header's own
            link slot is left empty instead of pointed here.
          */}
          <a
            href={`${oktaOrigin}/admin/groups#rules`}
            target="_blank"
            rel="noopener noreferrer"
            className="press inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 hover:border-neutral-500 hover:bg-neutral-50"
          >
            <span>Open the rules page</span>
            <Icon type="external-link" size="sm" />
          </a>
          <p className="mt-2 text-xs text-neutral-500">
            Okta has no direct link to a single rule, so this opens the org&rsquo;s rules list.
            Search it for <span className="font-medium text-neutral-700">{rule.name}</span>.
          </p>
        </DetailSection>
      )}
    </div>
  );
};

export default RuleDetailView;
