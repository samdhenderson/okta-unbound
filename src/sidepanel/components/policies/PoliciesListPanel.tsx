/**
 * @module sidepanel/components/policies/PoliciesListPanel
 * @description The Auth Policies tab's list region: loading, empty, and populated states.
 *
 * Wraps a {@link ScrollableList} of {@link PolicyCard}s, staggered in via
 * `.rise-in-stagger`, and picks the right empty state: "nothing loaded" (which
 * also carries the admin-role caveat, since a `403` on the policies endpoint is
 * indistinguishable from an org with no policies) vs. "nothing matches the
 * search". The row shape is known ahead of a load, so the loading state is a
 * {@link Skeleton} rather than the default spinner.
 */
import React, { memo } from 'react';
import { useStaggerReveal } from '../../hooks/useStaggerReveal';
import PolicyCard from './PolicyCard';
import ScrollableList from '../shared/ScrollableList';
import EmptyState from '../shared/EmptyState';
import Skeleton from '../shared/Skeleton';
import type { OktaPolicyListItem, OktaPolicyRule } from '../../../shared/schemas/okta';

interface PoliciesListPanelProps {
  /** Whether a policy load is in flight. */
  isLoading: boolean;
  /** Policies after the search filter — what actually renders. */
  policies: OktaPolicyListItem[];
  /** Whether any policies are loaded at all (drives which empty state shows). */
  hasPolicies: boolean;
  /** Load the policy list (the empty state's action). */
  onLoad: () => void;
  /** Fetches a policy's rules for the expanded card. */
  loadRules: (policyId: string) => Promise<OktaPolicyRule[]>;
}

/** The empty state shown when no policies came back from Okta (or none were loaded). */
const noPoliciesState = (onLoad: () => void) => (
  <EmptyState
    icon="shield"
    title="No App Authentication Policies"
    description="No app authentication policies found — or your admin role can't read policies."
    actions={[{ label: 'Reload Policies', onClick: onLoad, variant: 'primary' }]}
  />
);

/**
 * Renders the loading / empty / populated states of the auth policies list.
 *
 * `memo`ised on a default shallow prop compare, which holds because the tab passes a
 * `useMemo`d `policies` array, `useCallback`ed `onLoad`, and a `loadRules` taken from
 * the memoized `useOktaApi` facade. Without it every keystroke in the tab's search
 * box re-rendered the whole card list.
 */
const PoliciesListPanel: React.FC<PoliciesListPanelProps> = memo(function PoliciesListPanel({
  isLoading,
  policies,
  hasPolicies,
  onLoad,
  loadRules,
}) {
  const setStaggerRef = useStaggerReveal();

  return (
    <div className="min-h-[400px]">
      <ScrollableList
        loading={isLoading}
        loadingMessage="Loading auth policies…"
        skeleton={<Skeleton variant="row" size="lg" count={6} label="Loading auth policies" />}
        fillAvailable={false}
        testId="policies-list"
        emptyState={
          hasPolicies ? (
            <EmptyState
              icon="search"
              title="No Matching Policies"
              description="No auth policies match your search."
            />
          ) : (
            noPoliciesState(onLoad)
          )
        }
      >
        {policies.length > 0 && (
          <div ref={setStaggerRef} className="space-y-3 rise-in-stagger">
            {policies.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} loadRules={loadRules} />
            ))}
          </div>
        )}
      </ScrollableList>
    </div>
  );
});

export default PoliciesListPanel;
