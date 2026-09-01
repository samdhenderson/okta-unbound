/**
 * @module sidepanel/components/RuleCard
 * @description A single Okta group rule as a list row: name, status, the relations it has
 * to the group you arrived from, and its condition. Pressing it opens the rule's rung.
 *
 * ## It used to be the detail view, and that was the problem
 *
 * This card carried an expandable body holding the condition expression, the attributes
 * the rule reads, its target groups, its conflicts, its metadata — and, flex-wrapped at
 * the bottom, four write verbs. ADR-0030's inventory named that body as one of the five
 * layout dialects the app had for what is conceptually one thing, and the last of the five
 * never converted. Its action row was also the exact failure ADR-0030 §2 exists to stop:
 * verbs whose object is the whole rule, rendered as though they were a property of a
 * section of a card.
 *
 * All of it is {@link sidepanel/components/rules/RuleDetailView} now, under a real
 * `ActionBar`. What is left here is a row: the facts you scan a list for, and a way in.
 *
 * ## Two consumers, two behaviours, one prop
 *
 * The Rules tab has a rule rung to push, so it wires `onOpenRule` and the row becomes the
 * way in. The Group Detail rules section has no such rung — its own stack is showing a
 * *group* — so it wires `onOpenInRulesTab` instead and the row deep-links across tabs.
 * Exactly one of the two is ever present, and a row with neither is inert by design
 * rather than by omission: the same "every action is gated on its handler" discipline this
 * card already applied to its writes (ADR-0039).
 *
 * **The status is stated in text, not hue.** It was a coloured dot — green ring for
 * `ACTIVE`, grey for anything else — with no accompanying label, so the one fact the card
 * most needed to carry was available only to a reader who could see the colour *and* knew
 * the convention.
 *
 * The row is {@link sidepanel/components/shared/ListRow} (ADR-0029), and the arrival flash
 * is its shared `flash` prop rather than a hand-applied `animate-affirm-flash`.
 * `affectsCurrentGroup` maps onto the shared `selected` state — it had its own
 * `border-primary` before, which was the same idea spelled differently.
 *
 * **The row opens through a `StretchedButton`, not a click handler on its box.** That is
 * the house pattern for "pressing the row opens it" — `GroupListItem` is the other user —
 * and it is a real, invisible `<button>` covering the row rather than a `<div>` taught to
 * behave like one: Enter/Space, focus and disabled semantics come for free, and the row's
 * heading and badges stay plain content instead of becoming illegal button children. It
 * also had to be a control of *some* kind: the card's only keyboard route in used to be
 * its disclosure `IconButton`, which left with the disclosure. The overlay carries its own
 * `:active` state layer (ADR-0046), so the row responds without a `.press` of its own —
 * a button-scale press on a target this wide reads as a lurch anyway.
 */
import React, { useState, useCallback, useEffect, useId, useRef, memo } from 'react';
import type { FormattedRule } from '../../shared/types';
import { Badge, ListRow, StretchedButton } from './shared';
import Icon from './shared/Icon';

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
  /**
   * Open this rule's detail rung. Wired by the Rules tab, which has one to push.
   * Mutually exclusive in practice with {@link RuleCardProps.onOpenInRulesTab}.
   */
  onOpenRule?: (rule: FormattedRule) => void;
  /**
   * Jump to this rule on the Rules tab. Wired by surfaces that show a rule somewhere
   * *else* — the Group Detail rules section — whose own view stack is showing a group and
   * so has no rule rung to push.
   */
  onOpenInRulesTab?: (ruleId: string) => void;
  /** When true, the row flashes on arrival (deep-link target). */
  isHighlighted?: boolean;
}

/**
 * Memoised row for a single group rule.
 *
 * **Default shallow compare, deliberately — no custom comparator.** There was one, and it
 * listed eight rule fields while the render read roughly twice that; group names resolve
 * *after* the first paint, so the omission left a card rendering stale text for a group it
 * had since learned the name of (D-039). A list of fields that has to be re-derived every
 * time the body changes is a comparator that will drift again; the compiler cannot check
 * it, and being wrong costs correctness while being over-broad costs only a re-render.
 * The row reads far less than it used to, which makes the shallow compare cheaper still.
 */
const RuleCard: React.FC<RuleCardProps> = memo(
  ({ rule, onOpenRule, onOpenInRulesTab, isHighlighted = false }) => {
    /*
      One-shot arrival flash, decoupled from `isHighlighted` itself: the flash decays on
      its own `--dur-tell` beat rather than leaving the row's border pinned to the
      animation's end state for as long as the caller holds the highlight.
    */
    const [isFlashing, setIsFlashing] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const nameId = useId();

    useEffect(() => {
      if (isHighlighted) setIsFlashing(true);
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

    const handleOpen = useCallback(() => {
      if (onOpenRule) {
        onOpenRule(rule);
        return;
      }
      onOpenInRulesTab?.(rule.id);
    }, [onOpenRule, onOpenInRulesTab, rule]);

    const canOpen = Boolean(onOpenRule || onOpenInRulesTab);
    /*
      The two consumers open two different things, and the row says which. Pressing it in
      the Rules tab pushes a rung on the stack you are already on; pressing it in the
      Group Detail rules section leaves this tab entirely. "Open rule" would be a
      half-truth in the second case, and the destination is the part a reader needs.
    */
    const opensInRulesTab = !onOpenRule && Boolean(onOpenInRulesTab);
    const hasConflicts = Boolean(rule.conflicts && rule.conflicts.length > 0);
    /*
      A rule assigning into a group the org no longer has does nothing, and looked
      exactly like a working one from this list (D-061). The producer decides
      whether the question could be asked at all — `missingGroupIds` is `undefined`
      when the group walk had not finished — so an empty or absent list is silence,
      never a clean bill of health drawn from a half-read inventory.
    */
    const missingTargets = rule.missingGroupIds?.length ?? 0;

    return (
      <ListRow
        elementRef={cardRef}
        // A rule that touches the group you arrived from reads as the selected one, so it
        // takes the shared `selected` state rather than keeping its own `border-primary`.
        state={rule.affectsCurrentGroup ? 'selected' : 'default'}
        flash={isFlashing}
        // `relative` is the `StretchedButton` contract: the overlay stretches to its
        // nearest positioned ancestor, so that ancestor has to be the clickable region.
        className="relative flex items-center justify-between gap-4"
      >
        {canOpen && (
          /*
            `label` is identical for every row in the list, so `describedBy` points at the
            element naming *this* one — a reader hears "Open rule, Contractor intake"
            rather than fifty controls called the same thing.
          */
          <StretchedButton
            label={opensInRulesTab ? 'Open rule in the Rules tab' : 'Open rule'}
            describedBy={nameId}
            title={
              opensInRulesTab
                ? `Open rule ${rule.name} in the Rules tab`
                : `Open the detail view for ${rule.name}`
            }
            onClick={handleOpen}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-(--sp-inline)">
            <h3 id={nameId} className="text-sm font-semibold text-neutral-900">
              {rule.name}
            </h3>
            <Badge variant={rule.status === 'ACTIVE' ? 'success' : 'neutral'}>{rule.status}</Badge>
            {rule.affectsCurrentGroup && (
              <Badge variant="primary" solid>
                Current Group
              </Badge>
            )}
            {missingTargets > 0 && (
              <Badge variant="warning">
                {missingTargets === 1 ? 'Target missing' : `${missingTargets} targets missing`}
              </Badge>
            )}
            {hasConflicts && (
              <Badge variant="warning">
                {rule.conflicts!.length} Conflict{rule.conflicts!.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <p className="truncate text-sm text-neutral-600">{rule.condition}</p>
        </div>
        {/*
          A chevron, not a disclosure control: it points at a destination now rather than
          toggling something in place, so it is decorative and the row's own click target
          carries the affordance. A row that cannot be opened shows none.
        */}
        {canOpen && <Icon type="chevron-right" size="sm" className="shrink-0 text-neutral-400" />}
      </ListRow>
    );
  },
);

RuleCard.displayName = 'RuleCard';

export default RuleCard;
