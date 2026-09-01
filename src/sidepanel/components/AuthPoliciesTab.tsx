/**
 * @module sidepanel/components/AuthPoliciesTab
 * @description Auth Policies tab shell — a read-only browser for app authentication policies.
 *
 * A thin coordinator: {@link usePoliciesData} owns the `ACCESS_POLICY` list and its
 * cache-first load, this component owns the shell state (search text, the error
 * banner, the one-shot load on arrival) and composes {@link PoliciesListPanel}.
 *
 * **Read-only by design.** This tab renders no activate/deactivate or any other
 * mutation affordance, and the underlying `useOktaApi` policy operations are reads
 * only. Policy names and descriptions are end-user-controlled Okta data, rendered
 * as text through React's escaping.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from './shared/PageHeader';
import Button from './shared/Button';
import Input from './shared/Input';
import AlertMessage from './shared/AlertMessage';
import PoliciesListPanel from './policies/PoliciesListPanel';
import Icon from './shared/Icon';
import { useOktaApi } from '../hooks/useOktaApi';
import type { OperationResult } from '../hooks/useOktaApi/types';
import { useOwedLoad } from '../hooks/useOwedLoad';
import { usePoliciesData } from '../hooks/usePoliciesData';
import { filterPolicies } from './policies/policyFilters';
import { getRelativeTime } from '../../shared/utils/dateFormat';

interface AuthPoliciesTabProps {
  /** Chrome tab id of the connected Okta tab; required to fetch policies. */
  targetTabId?: number;
  /** Okta org origin of the connected tab (reserved for future deep links). */
  oktaOrigin?: string | null;
  /**
   * Whether this is the selected top-level tab. The tab stays mounted while
   * hidden, so the one-per-connected-tab policy auto-load is deferred until it is
   * shown rather than firing in the background. Defaults to `true`.
   */
  isActive?: boolean;
  /**
   * A single policy to arrive at, deep-linked from elsewhere in the panel (the
   * ⌘K palette, an `EntityLink`). This tab is a flat filtered list with no
   * detail rung, so arriving at a policy means arriving with the list filtered
   * to it. Applied once, then cleared via {@link onPolicySelected}.
   */
  selectedPolicyId?: string | null;
  /** Invoked once {@link selectedPolicyId} has been applied. */
  onPolicySelected?: () => void;
}

/**
 * Renders the Auth Policies tab: the app authentication policy list with search
 * and lazily expandable per-policy rules.
 */
const AuthPoliciesTab: React.FC<AuthPoliciesTabProps> = ({
  targetTabId,
  isActive = true,
  selectedPolicyId,
  onPolicySelected,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Single error channel; '' clears it. Stable so useOktaApi keeps its memoized
  // identities (an unstable callback would defeat the facade's memoization).
  const handleError = useCallback((message: string) => setError(message || null), []);

  // `onResult` takes one `OperationResult` object, not `(message, type)`. It used to
  // be positional, and TypeScript accepts a function that ignores trailing
  // parameters — so a one-arg `(message) => …` type-checked here and then silently
  // dropped `type`, rendering an 'info' message as a danger banner. Latent here
  // rather than live — `getPolicyRules` emits no results today — but it was the same
  // shape. The object parameter makes that a compile error.
  //
  // Must be stable: useOktaApi memoizes its operations on this callback's identity.
  const handleResult = useCallback(({ message, type }: OperationResult) => {
    if (type === 'error') setError(message || null);
  }, []);

  const api = useOktaApi({ targetTabId: targetTabId ?? null, onResult: handleResult });
  const { policies, isLoading, lastFetchTime, loadPolicies } = usePoliciesData({
    targetTabId,
    onError: handleError,
  });

  // Load once per connected tab on arrival; the header action re-fetches on demand.
  // Gated on visibility: the tab stays mounted once visited, and the auto-load
  // re-arms on every new `targetTabId`, so without the gate switching Okta tabs
  // would re-list every policy from a tab the user is not looking at.
  useOwedLoad(targetTabId ?? null, isActive, () => {
    void loadPolicies(false);
  });

  const filteredPolicies = useMemo(
    () => filterPolicies(policies, searchQuery),
    [policies, searchQuery],
  );

  // Arriving at one policy: filter the list down to it. Keyed on the policy's
  // name rather than its id because the search box is the visible filter — a
  // reader can widen it by pressing backspace, which they could not do with an
  // id that matches nothing.
  //
  // Waits for a non-empty list before consuming: this tab loads on activation
  // (`useOwedLoad` above), so a jump into a cold tab arrives before the policies
  // do, and consuming the request against an empty list would silently drop it.
  const selectedPolicyHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedPolicyId) {
      selectedPolicyHandledRef.current = null;
      return;
    }
    if (selectedPolicyHandledRef.current === selectedPolicyId) return;
    if (policies.length === 0) return;
    selectedPolicyHandledRef.current = selectedPolicyId;
    const match = policies.find((policy) => policy.id === selectedPolicyId);
    // An unmatched id leaves the list as it is rather than filtering it to
    // empty — the reader asked to see a policy, and showing them nothing is a
    // claim this tab cannot support.
    if (match?.name) setSearchQuery(match.name);
    onPolicySelected?.();
  }, [selectedPolicyId, policies, onPolicySelected]);

  const hasPolicies = policies.length > 0;
  const lastUpdatedLabel = lastFetchTime ? getRelativeTime(lastFetchTime) : null;

  // Stable handlers so the memoized `PoliciesListPanel` below is not re-rendered by
  // a fresh arrow on every keystroke in the search box.
  const handleRefresh = useCallback(
    () => void loadPolicies(hasPolicies),
    [loadPolicies, hasPolicies],
  );
  const handleLoad = useCallback(() => void loadPolicies(true), [loadPolicies]);

  return (
    <div className="tab-content active" style={{ fontFamily: 'var(--font-primary)', padding: 0 }}>
      <PageHeader
        title="Auth Policies"
        subtitle="Browse the app authentication (sign-on) policies that govern how users authenticate into apps"
        badge={
          hasPolicies
            ? {
                text: `${policies.length} ${policies.length === 1 ? 'Policy' : 'Policies'}`,
                variant: 'neutral',
              }
            : undefined
        }
        actions={
          <Button
            variant={hasPolicies ? 'secondary' : 'primary'}
            icon="refresh"
            onClick={handleRefresh}
            disabled={isLoading}
            loading={isLoading}
          >
            {hasPolicies ? 'Refresh' : 'Load Policies'}
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto px-(--sp-gutter) py-(--sp-gutter) space-y-(--sp-rung)">
        {error && (
          <AlertMessage
            message={{ text: error, type: 'danger' }}
            onDismiss={() => setError(null)}
          />
        )}

        {hasPolicies && (
          // Raw `space-y-2`, not a role: this is a search input plus its own caption
          // line, not a stack of cards (`--sp-rung`) or a row of controls
          // (`--sp-field`) — none of ADR-0048's six roles names this relationship.
          <div className="space-y-2">
            <Input
              value={searchQuery}
              onChange={setSearchQuery}
              type="search"
              icon={<Icon type="search" size="md" />}
              ariaLabel="Search auth policies"
              placeholder="Search policies by name or description…"
            />
            {lastUpdatedLabel && (
              <p className="text-xs text-neutral-600">Last updated {lastUpdatedLabel}</p>
            )}
          </div>
        )}

        <PoliciesListPanel
          isLoading={isLoading}
          policies={filteredPolicies}
          hasPolicies={hasPolicies}
          onLoad={handleLoad}
          loadRules={api.getPolicyRules}
        />
      </div>
    </div>
  );
};

export default AuthPoliciesTab;
