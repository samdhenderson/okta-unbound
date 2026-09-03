/**
 * @module sidepanel/components/policies/PolicyCard
 * @description Expandable, read-only card for a single app authentication policy.
 *
 * Collapsed it shows the policy name, status pill, evaluation priority, a `System`
 * badge for Okta-managed policies and the description. Expanding lazily fetches the
 * policy's rules through {@link useEntityQuery} keyed `['policyRules', id]`, so a
 * re-expansion (or a re-mount after a tab switch) is served from the session cache
 * with no second request.
 *
 * The card is strictly read-only: it renders no activate/deactivate or any other
 * mutation affordance. Only validated scalar fields are rendered, as text through
 * React's escaping — policy names and descriptions are end-user-controlled input.
 *
 * The chrome is {@link sidepanel/components/shared/ListRow} at `comfortable`
 * density (ADR-0029) — the card used to carry its own hand-written border, hover
 * and transition string. The rules disclosure goes in `ListRow`'s `body` slot,
 * which is the shape this card needs: the padding belongs to the header, the body
 * sets its own, and the border belongs to the card around both.
 *
 * **The header toggles on click, not just via its trailing `IconButton`** (I-023):
 * `AppListItem` and `RuleCard` both make the whole header a click target, and this
 * card was the one place the same gesture did nothing. It uses `RuleCard`'s
 * pattern — a shared `StretchedButton` overlay, a real `<button>` rather than a
 * `<div onClick>`, so Enter/Space and focus semantics come for free — not
 * `AppListItem`'s `press-subtle` div, which has no keyboard route of its own
 * (filed separately; not this card's problem). The trailing `IconButton` stays:
 * it is the only *visible* signal that the row expands at all — the chevron and
 * its rotation — and both `AppListItem` and `RuleCard` keep an equivalent
 * affordance, so removing it here would cost discoverability for no gain. The
 * two controls stay non-colliding because only the `IconButton` carries
 * `aria-expanded`/`aria-controls` (`StretchedButton` has no such prop) and its
 * label keeps naming the policy (`Show/Hide rules for {name}`), while the
 * overlay's label is deliberately shorter (`Show/Hide rules`) and reads the name
 * from `aria-describedby` instead — so a screen reader hears two related but
 * non-identical announcements, never the same string twice.
 */
import React, { memo, useCallback, useId, useState } from 'react';
import { CopyableId, Eyebrow, IconButton, ListRow, StretchedButton } from '../shared';
import Icon from '../shared/Icon';
import PolicyRulesList from './PolicyRulesList';
import { useEntityQuery } from '../../cache/useEntityQuery';
import type { OktaPolicyListItem, OktaPolicyRule } from '../../../shared/schemas/okta';
import { policyStatusClasses, policyStatusLabel } from './policyStatus';

interface PolicyCardProps {
  /** The validated policy to display. */
  policy: OktaPolicyListItem;
  /** Fetches a policy's rules (the tab passes `api.getPolicyRules`). */
  loadRules: (policyId: string) => Promise<OktaPolicyRule[]>;
}

/**
 * Renders one auth policy as an expandable read-only card, lazily loading its
 * rules the first time it is expanded.
 */
/**
 * Default shallow compare, deliberately — no custom comparator. There was one, listing
 * every field the card renders; enumerating it against the render body (`D-045`, following
 * `RuleCard`'s `D-039`) found every field already there, so it added no correctness over the
 * default while still being a hand-written list that would silently drift the moment the
 * card grows a new field. `policy` objects come from `PoliciesListPanel`'s list with stable
 * per-id identity, so the honest shallow compare is exactly as effective and cannot go stale.
 */
const PolicyCard: React.FC<PolicyCardProps> = memo(({ policy, loadRules }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const rulesId = useId();
  const nameId = useId();

  const toggleExpanded = useCallback(() => setIsExpanded((prev) => !prev), []);

  // Only fetches once expanded; the cache keeps the result across collapse/expand
  // cycles and across unmounts within the panel session.
  const {
    data: rules,
    isLoading,
    error,
  } = useEntityQuery<OktaPolicyRule[]>(['policyRules', policy.id], () => loadRules(policy.id), {
    enabled: isExpanded,
  });

  const name = policy.name ?? policy.id;

  return (
    <ListRow
      density="comfortable"
      testId={`policy-${policy.id}`}
      /*
        The disclosure goes in `body` rather than alongside the header because the
        card's padding is not uniform: the header is inset by the row's `p-4` while
        the rules panel runs edge to edge, carrying its own `px-4 pb-4 pt-3` and a
        full-width separator. `body` is exactly that split — `ListRow` moves its
        density padding onto a wrapper around `children` and clips the card, so the
        header keeps its inset and the body still meets the rounded corners.

        `.disclose` animates `grid-template-rows` between 0fr and 1fr, so the body
        collapses to zero height with no JS measurement and stays mounted while
        closed (held out of the tab order and accessible tree via `inert`) rather
        than unmounting — matching `AppListItem` and `RuleCard`, which share this
        lazy-fetch-on-expand shape. `useEntityQuery`'s `enabled` gate is what keeps
        the rules request from firing until the card is actually opened, and its
        cache is what makes a re-expansion cost no second request.
      */
      body={
        <div
          id={rulesId}
          className="disclose"
          data-open={isExpanded}
          data-testid="policy-rules-disclosure"
          inert={!isExpanded || undefined}
        >
          <div>
            <div className="space-y-3 border-t border-neutral-100 bg-neutral-50 px-4 pb-4 pt-3">
              <Eyebrow as="div">Rules</Eyebrow>
              <PolicyRulesList rules={rules} isLoading={isLoading} error={error} />
              {/*
                The id goes through the shared `CopyableId` rather than being
                read-only text: it is the value a user takes to the API or a
                support ticket. The label names the policy *and* folds the id
                in (`Copy <type> id for <name> (<id>)`, `EntityLink`'s
                `copyId` convention, I-010): several cards can be expanded at
                once, and two policies can legitimately share a display name,
                so the name alone is not enough to tell their copy controls
                apart.
              */}
              <div className="flex min-w-0 items-center gap-1 border-t border-neutral-200 pt-2 text-xs text-neutral-600">
                <span className="shrink-0 font-semibold">Policy ID:</span>
                <CopyableId
                  value={policy.id}
                  label={`Copy policy id for ${policy.name || policy.id} (${policy.id})`}
                />
              </div>
            </div>
          </div>
        </div>
      }
    >
      {/*
        `relative` is the `StretchedButton` contract: the overlay stretches to
        its nearest positioned ancestor, so that ancestor has to be exactly the
        clickable region — the header, not the whole card (the body below has
        its own controls that must stay independently clickable).
      */}
      <div className="relative flex items-start justify-between gap-4">
        <StretchedButton
          // Shorter than the `IconButton`'s label on purpose — `describedBy`
          // supplies the policy name, so the two controls read as related
          // rather than as the same announcement twice.
          label={isExpanded ? 'Hide rules' : 'Show rules'}
          describedBy={nameId}
          onClick={toggleExpanded}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-(--sp-inline)">
            <h3 id={nameId} className="text-sm font-semibold text-neutral-900">
              {name}
            </h3>
            <span
              className={`rounded-md border px-2 py-0.5 text-xs font-medium ${policyStatusClasses(policy.status)}`}
            >
              {policyStatusLabel(policy.status)}
            </span>
            {policy.system && (
              <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-600">
                System
              </span>
            )}
            {policy.priority != null && (
              <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-xs text-neutral-600">
                Priority {policy.priority}
              </span>
            )}
          </div>
          {policy.description && (
            <p className="truncate text-xs text-neutral-600">{policy.description}</p>
          )}
        </div>
        <IconButton
          // Already names its policy, which is the part `D-103` was about. What
          // remains is the rare case of two policies sharing a display name,
          // and that is `D-107`'s problem, not a second fix here: appending the
          // id unconditionally would make every policy in the list announce an
          // opaque string to disambiguate a collision that usually is not
          // there. `D-107` disambiguates only the rows that collide.
          label={isExpanded ? `Hide rules for ${name}` : `Show rules for ${name}`}
          variant="ghost"
          size="md"
          expanded={isExpanded}
          controls={rulesId}
          // `relative z-10`: the `StretchedButton` contract for a sibling
          // control that must sit above the overlay in stacking order, or it
          // becomes unclickable.
          className="relative z-10 shrink-0"
          onClick={toggleExpanded}
        >
          <Icon
            type="chevron-right"
            size="sm"
            className={`transition-transform duration-(--dur-instant) ${isExpanded ? 'rotate-90' : ''}`}
          />
        </IconButton>
      </div>
    </ListRow>
  );
});

PolicyCard.displayName = 'PolicyCard';

export default PolicyCard;
