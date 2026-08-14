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
import { cacheKeys } from '../cache/keys';
import { extractAccessPolicyId } from './useOktaApi/policyOperations';
import type { OktaAppListItem } from '@/shared/schemas/okta';
import type { AppAssignmentCounts } from './useOktaApi/appOperations';

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
 * potentially many-request assignment walk: `['appDetail', appId]` (status,
 * sign-on mode, and the `_links` the access policy is derived from) and
 * `['appAssignmentCounts', appId]` (user/group totals).
 *
 * The access-policy id is **derived, not fetched**. Okta exposes it only on
 * `GET /api/v1/apps/{id}` — the very request `['appDetail', appId]` already made —
 * so it is pulled out of that record with the pure {@link extractAccessPolicyId}
 * rather than by calling `getAppAccessPolicyId`, which would issue the identical
 * request a second time.
 *
 * `['appAssignmentCounts', appId]` is deliberately the same key, holding the same
 * shape, that the Applications tab's expanded row uses. Both are mounted at once
 * (ADR-0018), so they must agree: an earlier revision had them storing two different
 * shapes under one key, and whichever populated first corrupted the other's read.
 * Sharing the entry means whichever screen the user reaches first warms the other.
 *
 * @param appId - The detected Okta app instance id.
 * @param targetTabId - Browser tab hosting the Okta session; every call is routed
 *   to it. `null`/`undefined` disables the reads (there is nowhere to send them).
 * @returns See {@link AppOverviewData}. Never throws: a failed read surfaces as
 *   `null` data, which the Overview renders as an em dash.
 */
export function useAppOverviewData(appId: string, targetTabId?: number | null): AppOverviewData {
  const { getAppById, getAppAssignmentCounts } = useOktaApi({
    targetTabId: targetTabId ?? null,
  });

  const enabled = Boolean(appId && targetTabId);

  const { data: app, isLoading: isLoadingApp } = useEntityQuery<OktaAppListItem | null>(
    cacheKeys.appDetail(appId),
    () => getAppById(appId),
    { enabled },
  );

  const { data: counts, isLoading: isLoadingAssignments } =
    useEntityQuery<AppAssignmentCounts | null>(
      cacheKeys.appAssignmentCounts(appId),
      () => getAppAssignmentCounts(appId),
      { enabled },
    );

  return {
    app: app ?? null,
    isLoadingApp,
    counts: counts ?? null,
    accessPolicyId: extractAccessPolicyId(app?._links),
    isLoadingAssignments,
  };
}
