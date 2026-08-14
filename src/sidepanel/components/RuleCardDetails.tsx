/**
 * @module sidepanel/components/RuleCardDetails
 * @description The expandable detail panel {@link sidepanel/components/RuleCard} reveals.
 *
 * Split out of `RuleCard` unchanged: the condition expression (with inline
 * group-name badges), the referenced user attributes, the target groups, any
 * detected conflicts, the metadata line, and the action row
 * (activate/deactivate, preview impact, add target group, "View in Okta").
 *
 * It is handed to {@link sidepanel/components/shared/ListRow}'s `body` slot, so
 * it sits inside the card's border but outside the header's padding, and it owns
 * the whole disclosure wrapper — the element the header chevron's `aria-controls`
 * points at — rather than only its contents. `.disclose` animates
 * `grid-template-rows` between 0fr and 1fr, so the body collapses to zero height
 * with no JS measurement and stays mounted while closed (held out of the tab
 * order and accessible tree via `inert`) rather than unmounting — nothing here
 * fetches on demand, so staying mounted while collapsed has no behavioural cost.
 *
 * The props mirror `RuleCard`'s own — the unbound `onActivate(ruleId)` /
 * `onPreviewImpact(rule)` callbacks rather than pre-bound `() => void` handlers.
 * Two of them (`onPreviewImpact`, `onAddTargetGroup`) decide whether their button
 * renders at all, so passing the originals keeps that gate a property of the
 * callback itself instead of splitting it across a handler plus a boolean.
 */
import React, { useCallback } from 'react';
import type { FormattedRule } from '../../shared/types';
import { timeAgo } from '../../shared/ruleUtils';
import { Button } from './shared';

/**
 * Renders an Okta group-id token inside a rule condition expression, replacing
 * recognised 20-char group ids (`00g…`) with an inline group-name badge when a
 * name is available in `allGroupNamesMap`; other text is returned unchanged.
 *
 * @param expression - The raw condition expression to render.
 * @param allGroupNamesMap - Optional map of group id to display name for badge lookup.
 * @returns React nodes for the expression, with group-name badges interleaved.
 */
const renderConditionWithGroupBadges = (
  expression: string,
  allGroupNamesMap?: Record<string, string>,
): React.ReactNode => {
  // If no group names map is provided, return expression as-is
  if (!allGroupNamesMap || Object.keys(allGroupNamesMap).length === 0) {
    return expression;
  }

  // Find all group IDs in the expression (Okta group IDs are 20 characters alphanumeric)
  const groupIdPattern = /\b00g[a-zA-Z0-9]{17}\b/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = groupIdPattern.exec(expression)) !== null) {
    const groupId = match[0];
    const groupName = allGroupNamesMap[groupId];

    // Add text before the group ID
    if (match.index > lastIndex) {
      parts.push(expression.substring(lastIndex, match.index));
    }

    // Add the group ID with badge if name exists
    if (groupName && groupName !== groupId) {
      parts.push(
        <React.Fragment key={`${groupId}-${match.index}`}>
          <span className="font-mono text-xs text-neutral-600">{groupId}</span>
          <span
            className="ml-2 px-2 py-0.5 rounded-md bg-primary-light text-primary-text text-xs font-medium border border-primary-highlight"
            title={`Group: ${groupName}`}
          >
            {groupName}
          </span>
        </React.Fragment>,
      );
    } else {
      parts.push(groupId);
    }

    lastIndex = match.index + groupId.length;
  }

  // Add remaining text
  if (lastIndex < expression.length) {
    parts.push(expression.substring(lastIndex));
  }

  return parts.length > 0 ? parts : expression;
};

/** Props for {@link RuleCardDetails}. */
export interface RuleCardDetailsProps {
  /** The formatted rule whose detail is being shown. */
  rule: FormattedRule;
  /**
   * `id` of the disclosure region. Owned by the card, because the header
   * chevron's `aria-controls` has to point at it.
   */
  detailsId: string;
  /** Whether the card is expanded — drives `.disclose` and `inert`. */
  isExpanded: boolean;
  /** Okta org origin used to build the "View in Okta" rules-page link. */
  oktaOrigin?: string | null;
  /** Called with the rule id when the user activates an inactive rule. */
  onActivate?: (ruleId: string) => void;
  /** Called with the rule id when the user deactivates an active rule. */
  onDeactivate?: (ruleId: string) => void;
  /**
   * Called with the rule when the user opens its read-only impact preview.
   * Omitting it hides the button.
   */
  onPreviewImpact?: (rule: FormattedRule) => void;
  /**
   * Called with the rule to start the "add target group" consolidation (A4).
   * Omitting it hides the button.
   */
  onAddTargetGroup?: (rule: FormattedRule) => void;
}

/**
 * The detail panel below a {@link sidepanel/components/RuleCard} header.
 *
 * @param props - See {@link RuleCardDetailsProps}.
 */
const RuleCardDetails: React.FC<RuleCardDetailsProps> = ({
  rule,
  detailsId,
  isExpanded,
  oktaOrigin,
  onActivate,
  onDeactivate,
  onPreviewImpact,
  onAddTargetGroup,
}) => {
  const handleActivate = useCallback(() => {
    onActivate?.(rule.id);
  }, [onActivate, rule.id]);

  const handleDeactivate = useCallback(() => {
    onDeactivate?.(rule.id);
  }, [onDeactivate, rule.id]);

  const handlePreviewImpact = useCallback(() => {
    onPreviewImpact?.(rule);
  }, [onPreviewImpact, rule]);

  const handleAddTargetGroup = useCallback(() => {
    onAddTargetGroup?.(rule);
  }, [onAddTargetGroup, rule]);

  const hasConflicts = rule.conflicts && rule.conflicts.length > 0;

  return (
    <div
      id={detailsId}
      className="disclose"
      data-open={isExpanded}
      inert={!isExpanded || undefined}
    >
      <div>
        <div className="px-4 pb-4 pt-2 space-y-4 bg-neutral-50 border-t border-neutral-100">
          {/* Condition */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
              WHEN
            </div>
            <div className="p-3 bg-white rounded-md border border-neutral-200">
              <code className="text-sm text-neutral-900 font-mono block overflow-x-auto">
                {renderConditionWithGroupBadges(
                  rule.conditionExpression || rule.condition,
                  rule.allGroupNamesMap,
                )}
              </code>
            </div>
          </div>

          {/* User Attributes */}
          {rule.userAttributes.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
                USES ATTRIBUTES
              </div>
              <div className="flex flex-wrap gap-2">
                {rule.userAttributes.map((attr) => (
                  <span
                    key={attr}
                    className="px-2.5 py-1 rounded-md bg-primary-light text-primary-text text-sm font-medium border border-primary-highlight"
                  >
                    {attr}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          {rule.groupIds.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
                THEN ADD TO GROUPS
              </div>
              <div className="flex flex-wrap gap-2">
                {rule.groupIds.map((groupId, index) => {
                  const groupName = rule.groupNames?.[index];
                  const isNameDifferent = groupName && groupName !== groupId;

                  return (
                    <span
                      key={groupId}
                      className="px-2.5 py-1 rounded-md bg-success-light text-success-text text-sm font-medium border border-success-light"
                    >
                      {isNameDifferent ? (
                        <>
                          <span className="font-semibold">{groupName}</span>
                          <span className="ml-1.5 text-xs font-mono opacity-75">
                            ({groupId.substring(0, 8)}...)
                          </span>
                        </>
                      ) : (
                        <span className="font-mono">{groupId}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conflicts */}
          {hasConflicts && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-warning-text mb-2">
                CONFLICTS DETECTED
              </div>
              <div className="space-y-2">
                {rule.conflicts!.map((conflict, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-warning-light rounded-md border border-warning-light"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`
                        px-2 py-0.5 rounded-md text-xs font-bold uppercase
                        ${conflict.severity === 'high' ? 'bg-danger-light text-danger-text border border-danger-light' : 'bg-warning-light text-warning-text border border-warning-light'}
                      `}
                      >
                        {conflict.severity}
                      </span>
                      <div className="flex-1">
                        <div className="text-sm text-neutral-900 mb-1">
                          Conflicts with:{' '}
                          <span className="font-semibold">{conflict.rule2.name}</span>
                        </div>
                        <div className="text-xs text-neutral-600">{conflict.reason}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-3 border-t border-neutral-200 flex flex-wrap gap-4 text-xs text-neutral-600">
            <div>
              <span className="font-semibold">Last updated:</span>{' '}
              <span>{timeAgo(rule.lastUpdated)}</span>
            </div>
            <div>
              <span className="font-semibold">Rule ID:</span>{' '}
              <span className="font-mono text-neutral-500">{rule.id}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {rule.status === 'ACTIVE' ? (
              <Button variant="secondary" size="sm" onClick={handleDeactivate}>
                Deactivate Rule
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={handleActivate}>
                Activate Rule
              </Button>
            )}
            {onPreviewImpact && rule.groupIds.length > 0 && (
              <Button variant="secondary" size="sm" icon="users" onClick={handlePreviewImpact}>
                Preview Impact
              </Button>
            )}
            {onAddTargetGroup && (
              <Button variant="secondary" size="sm" icon="plus" onClick={handleAddTargetGroup}>
                Add Target Group
              </Button>
            )}
            {oktaOrigin && (
              <a
                href={`${oktaOrigin}/admin/groups#rules`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white text-neutral-900 border border-neutral-200 rounded-md hover:bg-neutral-50 hover:border-neutral-500 transition-colors duration-(--dur-instant)"
                style={{ fontFamily: 'var(--font-heading)', minHeight: '36px' }}
                title="Open Rules page in Okta Admin Console (you can search for this rule by name)"
              >
                <span>View in Okta</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RuleCardDetails;
