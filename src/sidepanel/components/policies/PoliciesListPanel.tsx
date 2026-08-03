/**
 * @module sidepanel/components/policies/PoliciesListPanel
 * @description The Auth Policies tab's list region: loading, empty, and populated states.
 *
 * Wraps a {@link ScrollableList} of {@link PolicyCard}s and picks the right empty
 * state: "nothing loaded" (which also carries the admin-role caveat, since a `403`
 * on the policies endpoint is indistinguishable from an org with no policies) vs.
 * "nothing matches the search".
 */
import React from 'react';
import PolicyCard from './PolicyCard';
import ScrollableList from '../shared/ScrollableList';
import EmptyState from '../shared/EmptyState';
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

/** Renders the loading / empty / populated states of the auth policies list. */
const PoliciesListPanel: React.FC<PoliciesListPanelProps> = ({
  isLoading,
  policies,
  hasPolicies,
  onLoad,
  loadRules,
}) => (
  <div className="min-h-[400px]">
    <ScrollableList
      loading={isLoading}
      loadingMessage="Loading auth policies…"
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
      {policies.map((policy) => (
        <PolicyCard key={policy.id} policy={policy} loadRules={loadRules} />
      ))}
    </ScrollableList>
  </div>
);

export default PoliciesListPanel;
