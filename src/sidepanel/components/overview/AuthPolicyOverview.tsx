/**
 * @module sidepanel/components/overview/AuthPolicyOverview
 * @description Overview branch for a detected Okta authentication/access policy page.
 *
 * Surfaces the detected policy's identity and status, plus a read-only summary of
 * the policy's rules — count plus each rule's name, priority and status — read
 * through the scheduler path and zod-validated at the boundary.
 *
 * Following the {@link GroupOverview} / {@link UserOverview} convention, the id is
 * **not** repeated here: it lives (with its copy control) in the {@link ContextBar}
 * masthead.
 *
 * The rules list sits inside a bordered card, so each rule is a
 * {@link sidepanel/components/shared/ListRow} `variant="nested"` at
 * `density="tight"` — no border of its own, separation on hover (ADR-0029).
 *
 * Strictly read-only: nothing here mutates a policy or a rule, and no policy
 * settings are scraped out of the Okta page markup (identity comes from the URL +
 * page heading, everything else from `GET /api/v1/policies/{id}/rules`).
 *
 * @remarks There is deliberately **no "open in Okta" link**: `shared/utils/oktaUrl`
 * has no validated admin-URL builder for policies yet, and hand-assembling an admin
 * path is banned. Adding a `policy` entity to that helper is the follow-up.
 */
import React, { useMemo } from 'react';
import AlertMessage from '../shared/AlertMessage';
import LoadingSpinner from '../shared/LoadingSpinner';
import { ListRow } from '../shared';
import StatCard from './shared/StatCard';
import { useOktaApi } from '../../hooks/useOktaApi';
import { useEntityQuery } from '../../cache/useEntityQuery';
import type { OktaPolicyRule } from '@/shared/schemas/okta';

/**
 * Stable empty list for the not-yet-loaded case. A `?? []` literal would mint a new
 * array on every render, so every derivation downstream of it would re-run even when
 * the rules had not changed.
 */
const NO_RULES: readonly OktaPolicyRule[] = [];

/** Props for {@link AuthPolicyOverview}. */
interface AuthPolicyOverviewProps {
  /** Detected Okta policy id. */
  policyId: string;
  /** Detected policy display name; `null` when neither the DOM nor the API had one. */
  policyName: string | null;
  /** Policy lifecycle status, when page detection resolved one. */
  policyStatus?: string;
  /** Browser tab hosting the Okta session; every API call is routed to it. */
  targetTabId: number;
}

/** Badge variant per policy status; unknown statuses read as neutral. */
const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: 'bg-success-light text-success-text',
  INACTIVE: 'bg-neutral-100 text-neutral-700',
};

/** Small status badge shared by the policy header and each rule row. */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wide ${
      STATUS_CLASSES[status] ?? 'bg-neutral-100 text-neutral-700'
    }`}
  >
    {status}
  </span>
);

/**
 * Renders the authentication-policy Overview: identity, status, and the policy's
 * rules in priority order. Read-only.
 */
const AuthPolicyOverview: React.FC<AuthPolicyOverviewProps> = ({
  policyId,
  policyName,
  policyStatus,
  targetTabId,
}) => {
  const { getPolicyRules } = useOktaApi({ targetTabId });

  const {
    data: rulesData,
    isLoading,
    error,
    refetch,
  } = useEntityQuery<OktaPolicyRule[]>(['policyRules', policyId], () => getPolicyRules(policyId), {
    enabled: Boolean(targetTabId && policyId),
  });

  const rules = rulesData ?? NO_RULES;
  // `priority` is nullish in the schema; unprioritized rules sort last.
  const sortedRules = useMemo(
    () =>
      [...rules].sort(
        (a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER),
      ),
    [rules],
  );
  const activeCount = useMemo(
    () => sortedRules.filter((rule) => rule.status === 'ACTIVE').length,
    [sortedRules],
  );

  return (
    <div className="space-y-6">
      {/* Identity. The id + copy control live in the ContextBar masthead, matching
          the group/user overviews — no duplication here. */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">
            {policyName ?? 'Authentication policy'}
          </h2>
          {policyStatus && <StatusBadge status={policyStatus} />}
        </div>
        <p className="mt-0.5 text-sm text-neutral-600">
          Detected authentication policy. Its rules are shown read-only below.
        </p>
      </div>

      {/* Rules summary */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Total Rules" value={rules.length} color="primary" icon="list" countUp />
        <StatCard title="Active Rules" value={activeCount} color="success" icon="check" countUp />
      </div>

      <div className="bg-white rounded-md border border-neutral-200 p-6">
        <h3 className="mb-4 text-lg font-semibold text-neutral-900">Rules</h3>

        {isLoading && rules.length === 0 ? (
          <LoadingSpinner size="xl" message="Loading policy rules..." centered />
        ) : error ? (
          <AlertMessage
            message={{ text: error, type: 'danger' }}
            action={{ label: 'Retry', onClick: refetch }}
          />
        ) : sortedRules.length === 0 ? (
          <div className="py-8 text-center text-sm text-neutral-500">
            No rules found for this policy
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedRules.map((rule) => (
              <ListRow
                key={rule.id}
                as="li"
                variant="nested"
                density="tight"
                className="flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-neutral-900">
                    {rule.name || rule.id}
                  </div>
                  <div className="text-xs text-neutral-600">
                    {rule.priority == null ? 'No priority' : `Priority ${rule.priority}`}
                  </div>
                </div>
                {rule.status && <StatusBadge status={rule.status} />}
              </ListRow>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AuthPolicyOverview;
