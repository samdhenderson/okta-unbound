/**
 * @module sidepanel/components/RuleCard
 * @description Expandable card summarising a single Okta group rule.
 *
 * Collapsed view shows the rule name, an ACTIVE/INACTIVE status badge,
 * current-group/conflict badges, and the condition; the expanded view adds the condition expression (with group-name
 * badges), referenced user attributes, target groups, conflict details, metadata,
 * and activate/deactivate plus "View in Okta" actions. Memoised for list rendering.
 *
 * **The status is stated in text, not hue.** It was a coloured dot — green ring
 * for `ACTIVE`, grey for anything else — with no accompanying label, so the one
 * fact the card most needed to carry was available only to a reader who could
 * see the colour *and* knew the convention. The Group Detail Rules tab printed
 * it as words (`RuleStatusPill`) before adopting this card, so keeping the dot
 * would have quietly dropped a stated fact on the way in.
 *
 * **Every action is gated on its handler.** A surface that cannot perform a verb
 * renders no control for it rather than one that swallows the click (ADR-0039) —
 * which matters now that the card has a second consumer (the Group Detail Rules
 * tab) that wires none of the writes.
 *
 * **A target group is named, or it is stated as un-named.** Every group this card
 * shows goes through the shared {@link sidepanel/components/shared/EntityLink}
 * when a name is in hand, and through `UnnamedGroupChip` — a muted "Group name
 * not loaded" beside the copyable raw id — when only the id is. Both pills were
 * hand-rolled `<span>`s that printed the bare id in the *name's own slot*, so an
 * unresolved group read as though its id were its name (I-003).
 *
 * The card is {@link sidepanel/components/shared/ListRow} (ADR-0029): the header
 * is `children`, the expandable detail is the `body` slot, and the arrival flash
 * is the shared `flash` prop rather than a hand-applied `animate-affirm-flash`.
 * `affectsCurrentGroup` maps onto the shared `selected` state — it had its own
 * `border-primary` before, which was the same idea spelled differently.
 */
import React, { useState, useCallback, useEffect, useId, useRef, memo } from 'react';
import type { FormattedRule } from '../../shared/types';
import { timeAgo } from '../../shared/ruleUtils';
import { Badge, Button, CopyableId, EntityLink, IconButton, ListRow } from './shared';
import Icon from './overview/shared/Icon';

/**
 * Upper bound on the arrival-flash hold, in milliseconds. Mirrors `--dur-tell`
 * (500ms), the duration of the `animate-affirm-flash` keyframes defined in
 * `tailwind.css` — keep the two in step if that token moves.
 *
 * The flash class is removed on its own `animationend`, or this timeout,
 * whichever lands first. The fallback matters because `animationend` never
 * fires in jsdom (no CSS animations run there) and, per the reduced-motion
 * rule in `tailwind.css`, the animation only lasts ~1ms anyway when the user
 * has requested reduced motion — either way the flash must not outlive the
 * highlight window it decorates.
 */
const FLASH_MS = 500;

interface RuleCardProps {
  /** The formatted rule to display. */
  rule: FormattedRule;
  /** Called with the rule id when the user activates an inactive rule. */
  onActivate?: (ruleId: string) => void;
  /** Called with the rule id when the user deactivates an active rule. */
  onDeactivate?: (ruleId: string) => void;
  /** Called with the rule when the user opens its read-only impact preview. */
  onPreviewImpact?: (rule: FormattedRule) => void;
  /** Called with the rule to start the "add target group" consolidation (A4). */
  onAddTargetGroup?: (rule: FormattedRule) => void;
  /**
   * Jumps to this rule on the Rules tab. Supplied by surfaces that show a rule
   * somewhere *else* — the Group Detail Rules tab — and omitted by the Rules tab
   * itself, where the destination is where the reader already is.
   *
   * It is a secondary affordance inside the expanded card, not the only way to
   * see the rule: that was the whole defect of the link row this card replaced
   * there.
   */
  onOpenInRulesTab?: (ruleId: string) => void;
  /** Okta org origin used to build the "View in Okta" rules-page link. */
  oktaOrigin?: string | null;
  /** When true, the card auto-expands and flashes on arrival (deep-link target). */
  isHighlighted?: boolean;
}

/**
 * A target group this card knows only by id.
 *
 * Deliberately **not** an {@link sidepanel/components/shared/EntityLink}: that chip
 * needs a name, and passing the id in as the name is exactly the defect this
 * replaces — an id sitting in the name's slot, indistinguishable from a resolved
 * one. Instead the missing name is *stated*, in the muted-italic non-answer
 * register the comparison views use, and the id is rendered through
 * {@link sidepanel/components/shared/CopyableId} so it reads as an identifier
 * (mono, its own colour) and can still be pasted into a search.
 *
 * The chip does not open the group. Nothing here fetches, so nothing can turn the
 * id into a name at render time (I-003 is a render-time fix).
 */
const UnnamedGroupChip: React.FC<{
  /** The Okta group id the rule assigns to. */
  groupId: string;
}> = ({ groupId }) => (
  <span
    className="inline-flex max-w-full items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2 py-0.5 text-xs"
    title="This rule assigns to this group id. No name for it was loaded into this view."
  >
    <Icon type="users" size="xs" className="shrink-0 text-neutral-500" />
    <span className="shrink-0 italic text-neutral-600">Group name not loaded</span>
    <CopyableId value={groupId} label={`Copy group id ${groupId}`} />
  </span>
);

/**
 * Renders an Okta group-id token inside a rule condition expression, replacing
 * recognised 20-char group ids (`00g…`) with the shared `EntityLink` badge when a
 * name is available in `allGroupNamesMap`; other text is returned unchanged.
 *
 * The badge *replaces* the literal it stood for and therefore carries `copyId` —
 * the same trade `RuleExpressionText` makes for reconstructed clause text, so the
 * app's two renderers of rule conditions read alike. An id with no known name is
 * left verbatim: this is source text, and a bare id in mono inside a `<code>`
 * block already reads as an id rather than as a name.
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
        <EntityLink
          key={`${groupId}-${match.index}`}
          type="group"
          id={groupId}
          name={groupName}
          copyId
          // The id is no longer on screen once the badge stands in for it, so the
          // copy control names the id rather than the group: two groups in one
          // condition can share a display name, and the derived default would
          // then collide (I-009).
          copyIdLabel={`Copy group id ${groupId}`}
          className="align-middle"
        />,
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

/**
 * Memoised card displaying a single group rule with an expandable detail view.
 *
 * **Default shallow compare, deliberately — no custom comparator.** There was one,
 * and it listed eight rule fields; the render reads roughly twice that
 * (`conditionExpression`, `allGroupNamesMap`, `userAttributes`, `groupIds`,
 * `groupNames`, `lastUpdated`, each conflict's severity/reason/`rule2.name`) plus
 * five handler props that each gate a control. Group names resolve *after* the
 * first paint — `fetchGroupRulesRequest` fills `groupNames`/`allGroupNamesMap`
 * from the org snapshot — so the omission left a card rendering "Group name not
 * loaded" for a group it had since learned the name of (D-039). A list of fields
 * that has to be re-derived every time the body changes is a comparator that will
 * drift again; the compiler cannot check it, and being wrong costs correctness
 * while being over-broad costs only a re-render.
 *
 * Shallow compare still has something to bite on here: `rule` keeps its identity
 * across parent renders at both call sites — `RulesTab` maps rules through a
 * `useMemo` that returns the *same* object when `affectsCurrentGroup` is
 * unchanged, and `GroupRulesSection` passes its hook's array straight down — and
 * `allGroupNamesMap` is rebuilt only when that rule object is, so comparing it by
 * reference (which is what shallow does) is right rather than self-defeating.
 * `RulesTab` does re-create some of its handler props each render, which blunts
 * the memo on that surface; the fix for that is stabilising them at the caller,
 * not compensating for it here with a comparator that ignores them.
 */
const RuleCard: React.FC<RuleCardProps> = memo(
  ({
    rule,
    onActivate,
    onDeactivate,
    onPreviewImpact,
    onAddTargetGroup,
    onOpenInRulesTab,
    oktaOrigin,
    isHighlighted = false,
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const detailsId = useId();
    // One-shot arrival flash, decoupled from `isHighlighted` itself: `RulesTab`
    // holds `isHighlighted` true for ~2s (long enough to scroll + read), but the
    // flash should decay on its own `--dur-tell` beat rather than leaving the
    // card's border/background pinned to the animation's end state for the rest
    // of that window.
    const [isFlashing, setIsFlashing] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    // Auto-expand and flash on arrival.
    React.useEffect(() => {
      if (isHighlighted) {
        setIsExpanded(true);
        setIsFlashing(true);
      }
    }, [isHighlighted]);

    // Clear the flash on its own animation end, or the fallback timeout.
    useEffect(() => {
      if (!isFlashing) return;
      const card = cardRef.current;
      const finish = (event?: { target: unknown }) => {
        if (event && event.target !== card) return;
        setIsFlashing(false);
      };
      const timer = window.setTimeout(finish, FLASH_MS);
      card?.addEventListener('animationend', finish);
      return () => {
        window.clearTimeout(timer);
        card?.removeEventListener('animationend', finish);
      };
    }, [isFlashing]);

    const toggleExpanded = useCallback(() => {
      setIsExpanded((prev) => !prev);
    }, []);

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

    const handleOpenInRulesTab = useCallback(() => {
      onOpenInRulesTab?.(rule.id);
    }, [onOpenInRulesTab, rule.id]);

    const hasConflicts = rule.conflicts && rule.conflicts.length > 0;

    /*
      Expanded content, handed to `ListRow`'s `body` slot so it sits inside the
      card's border but outside the header's padding. `.disclose` animates
      `grid-template-rows` between 0fr and 1fr, so the body collapses to zero
      height with no JS measurement and stays mounted while closed (held out of
      the tab order and accessible tree via `inert`) rather than unmounting —
      nothing here fetches on demand, so staying mounted while collapsed has no
      behavioural cost.
    */
    const expandedBody = (
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
                    // A `groupNames` entry equal to the id is the upstream
                    // formatter's own "unresolved" marker, not a name.
                    const resolvedName = groupName !== groupId ? groupName : undefined;

                    return resolvedName ? (
                      <EntityLink
                        key={groupId}
                        type="group"
                        id={groupId}
                        name={resolvedName}
                        copyId
                        // The chip shows the name only — the truncated
                        // "(00g1a2b3…)" it replaced was never enough to paste
                        // anywhere — so the copy control names the id itself.
                        copyIdLabel={`Copy group id ${groupId}`}
                      />
                    ) : (
                      <UnnamedGroupChip key={groupId} groupId={groupId} />
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
              {/*
                The id is the one metadata value a user copies rather than reads,
                so it goes through the shared `CopyableId`. The label names the
                rule because several cards can be expanded at once, and a screen
                of controls all called "Copy rule id" would not say copy *which*.
              */}
              <div className="flex min-w-0 items-center gap-1">
                <span className="shrink-0 font-semibold">Rule ID:</span>
                <CopyableId value={rule.id} label={`Copy rule id for ${rule.name || rule.id}`} />
              </div>
            </div>

            {/*
              Actions. Every one is gated on its own handler: a surface that
              cannot perform a verb renders no control for it, rather than a
              button that swallows the click (ADR-0039). Activate/Deactivate used
              to render unconditionally, which was invisible while `RulesTab` —
              the only consumer — always wired both.
            */}
            <div className="flex flex-wrap gap-2 pt-2">
              {rule.status === 'ACTIVE'
                ? onDeactivate && (
                    <Button variant="secondary" size="sm" onClick={handleDeactivate}>
                      Deactivate Rule
                    </Button>
                  )
                : onActivate && (
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
              {onOpenInRulesTab && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenInRulesTab}
                  title={`Open rule ${rule.name} in the Rules tab`}
                >
                  Open in Rules tab
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
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
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

    return (
      <ListRow
        elementRef={cardRef}
        // A rule that touches the group you arrived from reads as the selected
        // one, so it takes the shared `selected` state rather than keeping its
        // own `border-primary`.
        state={rule.affectsCurrentGroup ? 'selected' : 'default'}
        flash={isFlashing}
        body={expandedBody}
        headerClassName="flex cursor-pointer items-center justify-between gap-4"
        onHeaderClick={toggleExpanded}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-neutral-900 text-sm">{rule.name}</h3>
              <Badge variant={rule.status === 'ACTIVE' ? 'success' : 'neutral'}>
                {rule.status}
              </Badge>
              {rule.affectsCurrentGroup && (
                <Badge variant="primary" solid>
                  Current Group
                </Badge>
              )}
              {hasConflicts && (
                <Badge variant="warning">
                  {rule.conflicts!.length} Conflict{rule.conflicts!.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <p className="text-sm text-neutral-600 truncate">{rule.condition}</p>
          </div>
        </div>
        <IconButton
          label={`${isExpanded ? 'Collapse' : 'Expand'} ${rule.name}`}
          variant="ghost"
          size="md"
          expanded={isExpanded}
          controls={detailsId}
          className="shrink-0"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-(--dur-instant) ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </IconButton>
      </ListRow>
    );
  },
);

RuleCard.displayName = 'RuleCard';

export default RuleCard;
