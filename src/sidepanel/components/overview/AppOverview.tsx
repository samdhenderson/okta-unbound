/**
 * @module sidepanel/components/overview/AppOverview
 * @description Overview branch for a detected Okta app page.
 *
 * Surfaces the detected app's identity, its lifecycle status and sign-on mode, the
 * user/group assignment counts, whether an app-specific authentication policy is
 * attached, and the app-scoped exports (assigned users, assigned groups) as
 * pre-scoped deep-links.
 *
 * Presentational: the enrichment reads live in {@link useAppOverviewData}. They are
 * *supplementary* — identity and the export deep-links render unconditionally, and a
 * failed or forbidden read degrades to an em dash rather than an error state (policy
 * and assignment endpoints are commonly forbidden for non-super-admins).
 */
import React from 'react';
import { Button } from '../shared';
import Icon from '../shared/Icon';
import StatCard from '../shared/StatCard';
import { useAppOverviewData } from '../../hooks/useAppOverviewData';

/** Props for {@link AppOverview}. */
interface AppOverviewProps {
  /** Detected Okta app id. */
  appId: string;
  /** Detected Okta app display name. */
  appName: string;
  /**
   * Browser tab hosting the Okta session; every enrichment call is routed to it.
   * Omit (or pass `null`) to render identity + exports only, with no API reads.
   */
  targetTabId?: number | null;
  /**
   * Open the Export tab pre-scoped to an app-scoped descriptor for this app.
   * @param descriptorId - `'app-users'` or `'app-groups'`.
   */
  onExport: (descriptorId: string, appId: string, appName: string) => void;
}

/** Badge variant per Okta app lifecycle status; unknown statuses read as neutral. */
const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: 'bg-success-light text-success-text',
  INACTIVE: 'bg-neutral-100 text-neutral-700',
};

/** Em dash shown wherever an enrichment read is unavailable (failed or forbidden). */
const UNAVAILABLE = '—';

/**
 * Overview for a detected app: identity + status, assignment stat cards, the
 * app-specific authentication-policy note, and the app-scoped export deep-links.
 */
const AppOverview: React.FC<AppOverviewProps> = ({ appId, appName, targetTabId, onExport }) => {
  const { app, isLoadingApp, counts, accessPolicyId, isLoadingAssignments } = useAppOverviewData(
    appId,
    targetTabId,
  );

  const status = app?.status;
  const signOnMode = app?.signOnMode;

  /** Loading reads as a bare em dash too — the card is a metric, not a spinner host. */
  const countValue = (value?: number) =>
    isLoadingAssignments || counts == null ? UNAVAILABLE : (value ?? UNAVAILABLE);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">{appName}</h2>
          {status && (
            <span
              className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wide ${
                STATUS_CLASSES[status] ?? 'bg-neutral-100 text-neutral-700'
              }`}
            >
              {status}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          Sign-on mode{' '}
          <span className="font-medium text-neutral-700">
            {isLoadingApp && !signOnMode ? UNAVAILABLE : (signOnMode ?? UNAVAILABLE)}
          </span>
        </p>
      </div>

      {/* Assignment stats. Both come from one cached read, so they share a state. */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="Assigned Users"
          value={countValue(counts?.users)}
          color="primary"
          icon="users"
          countUp
        />
        <StatCard
          title="Assigned Groups"
          value={countValue(counts?.groups)}
          color="neutral"
          icon="building"
          countUp
        />
      </div>

      {accessPolicyId && (
        <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
          <Icon type="shield" size="sm" className="mt-0.5 shrink-0 text-neutral-500" />
          <span>
            Has app-specific authentication policy
            <span className="block text-xs text-neutral-500">
              Navigate to the policy in Okta to inspect its rules.
            </span>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon="download"
          onClick={() => onExport('app-users', appId, appName)}
          title="Export the users assigned to this app (opens the Export tab pre-scoped)"
        >
          Export App Users
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon="download"
          onClick={() => onExport('app-groups', appId, appName)}
          title="Export the groups assigned to this app (opens the Export tab pre-scoped)"
        >
          Export App Groups
        </Button>
      </div>
    </div>
  );
};

export default AppOverview;
