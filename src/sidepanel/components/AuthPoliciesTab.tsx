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
import Icon from './overview/shared/Icon';
import { useOktaApi } from '../hooks/useOktaApi';
import type { OperationResult } from '../hooks/useOktaApi/types';
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
}

/**
 * Renders the Auth Policies tab: the app authentication policy list with search
 * and lazily expandable per-policy rules.
 */
const AuthPoliciesTab: React.FC<AuthPoliciesTabProps> = ({ targetTabId, isActive = true }) => {
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
  const autoLoadedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isActive || targetTabId == null || autoLoadedRef.current === targetTabId) return;
    autoLoadedRef.current = targetTabId;
    void loadPolicies(false);
  }, [isActive, targetTabId, loadPolicies]);

  const filteredPolicies = useMemo(
    () => filterPolicies(policies, searchQuery),
    [policies, searchQuery],
  );

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

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <AlertMessage
            message={{ text: error, type: 'danger' }}
            onDismiss={() => setError(null)}
          />
        )}

        {hasPolicies && (
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
