/**
 * @module sidepanel/hooks/useAppOverviewData
 * @description Cache-backed enrichment reads behind the detected-app Overview.
 *
 * Keeps {@link AppOverview} presentational: this hook owns the two
 * {@link useEntityQuery} reads that back the app's status / sign-on mode, its
 * assignment counts, and whether an app-specific access policy is attached. Every
 * request goes through the scheduler path (side panel → background `ApiScheduler`
 * → content script) and every response is zod-validated at that boundary.
 *
 * Read-only. Enrichment is *supplementary*: each read degrades to `null` rather
 * than failing the view, so the app's identity and export deep-links always render.
 */

import { useOktaApi } from './useOktaApi';
import { useEntityQuery } from '../cache/useEntityQuery';
import type { OktaAppListItem } from '@/shared/schemas/okta';
import type { AppAssignmentCounts } from './useOktaApi/appOperations';

/** The enrichment payload cached under `['appAssignments', appId]`. */
export interface AppAssignmentSummary {
  /** Assignment totals, or `null` when the walk failed / was forbidden. */
  counts: AppAssignmentCounts | null;
  /** Id of the app-specific access policy, or `null` when none is attached. */
  accessPolicyId: string | null;
}

/** What {@link useAppOverviewData} exposes to the app Overview. */
export interface AppOverviewData {
  /** The app record, or `null` while loading / when the read failed. */
  app: OktaAppListItem | null;
  /** `true` while the app record is loading with nothing cached to show. */
  isLoadingApp: boolean;
  /** Assignment counts, or `null` while loading / when unavailable. */
  counts: AppAssignmentCounts | null;
  /** Access policy id, or `null` when none is attached / not yet known. */
  accessPolicyId: string | null;
  /** `true` while the assignment/policy read is in flight with nothing to show. */
  isLoadingAssignments: boolean;
}

/**
 * Load the supplementary detail shown on a detected app's Overview.
 *
 * Two independent cache entries so the cheap identity read is not held up by the
 * potentially many-request assignment walk:
 * `['appDetail', appId]` (status + sign-on mode) and `['appAssignments', appId]`
 * (user/group counts + access-policy id).
 *
 * @param appId - The detected Okta app instance id.
 * @param targetTabId - Browser tab hosting the Okta session; every call is routed
 *   to it. `null`/`undefined` disables the reads (there is nowhere to send them).
 * @returns See {@link AppOverviewData}. Never throws: a failed read surfaces as
 *   `null` data, which the Overview renders as an em dash.
 */
export function useAppOverviewData(appId: string, targetTabId?: number | null): AppOverviewData {
  const { getAppById, getAppAssignmentCounts, getAppAccessPolicyId } = useOktaApi({
    targetTabId: targetTabId ?? null,
  });

  const enabled = Boolean(appId && targetTabId);

  const { data: app, isLoading: isLoadingApp } = useEntityQuery<OktaAppListItem | null>(
    ['appDetail', appId],
    () => getAppById(appId),
    { enabled },
  );

  const { data: assignments, isLoading: isLoadingAssignments } =
    useEntityQuery<AppAssignmentSummary>(
      ['appAssignments', appId],
      async () => {
        const [counts, accessPolicyId] = await Promise.all([
          getAppAssignmentCounts(appId),
          getAppAccessPolicyId(appId),
        ]);
        return { counts, accessPolicyId };
      },
      { enabled },
    );

  return {
    app: app ?? null,
    isLoadingApp,
    counts: assignments?.counts ?? null,
    accessPolicyId: assignments?.accessPolicyId ?? null,
    isLoadingAssignments,
  };
}
