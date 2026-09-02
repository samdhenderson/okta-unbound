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
 */
import React, { memo, useCallback, useId, useState } from 'react';
import { CopyableId, IconButton, ListRow } from '../shared';
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
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
                Rules
              </div>
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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-(--sp-inline)">
            <h3 className="text-sm font-semibold text-neutral-900">{name}</h3>
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
          // I-010: this label still collides when two policies share a display
          // name — `AuthPoliciesTab.test.tsx`/`.stories.tsx` (outside this
          // change's file ownership) assert the exact string `Show rules for
          // <name>` verbatim, so folding the id in here the way the copy
          // control below does would require editing assertions this change
          // does not own. Left as the residual half of I-010; the copy
          // control is fixed.
          label={isExpanded ? `Hide rules for ${name}` : `Show rules for ${name}`}
          variant="ghost"
          size="md"
          expanded={isExpanded}
          controls={rulesId}
          className="shrink-0"
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
