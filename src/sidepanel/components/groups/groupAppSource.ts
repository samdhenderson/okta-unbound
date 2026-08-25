/**
 * @module sidepanel/components/groups/groupAppSource
 * @description Pure derivation of the Access tab's app rows: one display model
 * per assigned app.
 *
 * No React and no I/O, which is the structural guarantee `docs/components.md`
 * §"List rows derive; they never fetch" asks for — scrolling this list cannot
 * start work, because there is nothing here that could. Everything a row shows
 * comes from the app-assignment walk `useGroupAccessGrants` already paid for,
 * plus the push mappings the group load already enriched.
 *
 * ## Nothing here costs a request
 *
 * The rows used to be `EntityLink` chips carrying a label and an id, and the
 * whole of `GET /api/v1/groups/{id}/apps` beyond those two fields was discarded
 * at the boundary. `oktaAppListItemSchema` was already validating `status`,
 * `signOnMode` and `lastUpdated` on every row; they are simply kept now.
 *
 * ## Absent is not a value
 *
 * Every field past the id is optional in the schema **by design** — a caught
 * field degrades to "not reported" rather than costing the caller a whole
 * application (see that schema's note on the `signOnMode: null` regression). So
 * a row states a fact only when it has one: no status means no badge, not an
 * "Unknown" badge; no sign-on mode means no line.
 *
 * ## Push is three-state, and stays three-state
 *
 * `GroupPushSection` distinguishes "not pushed anywhere" (an empty array — a
 * loaded fact) from "push mappings were never loaded" (`undefined` — the group
 * load's enrichment is non-fatal and can be skipped). Folding push into these
 * rows must not flatten that: {@link GroupAppPush} keeps `unknown` and
 * `not-pushed` apart, and a row in the `unknown` state says nothing about push
 * at all rather than implying the app is not pushed to.
 *
 * ## Why `GroupPushSection` survives this
 *
 * Push and assignment are different relations. A group is *pushed to* an app
 * from that app's Push Groups tab, which does not require the group to be
 * assigned to the app — so an app can carry a push mapping and never appear in
 * this list. Folding the section into these rows would silently drop exactly
 * those mappings. The join here is an annotation on the apps that do appear; the
 * section remains the complete account.
 *
 * App labels, group names and sign-on modes are end-user-controllable Okta data.
 * Nothing here is logged, and every consumer renders the result as escaped React
 * text.
 */
import { appStatusVariant, type AppStatusVariant } from '../apps/appFilters';
import type { AppGrant } from '../../hooks/useGroupAccessGrants';
import type { PushGroupMapping } from '../../../shared/types';

/**
 * Whether this group's membership is pushed out to the app, as far as anyone
 * knows.
 *
 * Three states, not a boolean: see the module note. `unknown` is the group
 * load's push enrichment not having run, and must never render as "no".
 */
export type GroupAppPush =
  | { state: 'unknown' }
  | { state: 'not-pushed' }
  | {
      state: 'pushed';
      /**
       * The group the push writes into. Required on `PushGroupMapping`, so it is
       * always carried — but Okta can return it empty, and a consumer must treat
       * an empty string as "not named" rather than rendering "Writes into .".
       */
      targetGroupName: string;
      /** Okta's assignment priority. A priority, never a state — see `GroupPushSection`. */
      priority?: number;
    };

/** One rendered row of the Access tab's assigned-app list. */
export interface GroupAppRowModel {
  /** Okta app id. */
  id: string;
  /** Display label. */
  label: string;
  /** Okta lifecycle status, when the row reported one. Absent ⇒ no badge. */
  status?: string;
  /** Badge variant for {@link status}, from the shared app-status mapping. */
  statusVariant: AppStatusVariant;
  /** Sign-on mode, when the row reported one. Absent ⇒ the line is omitted. */
  signOnMode?: string;
  /** When Okta last updated the app, when the row reported it. */
  lastUpdated?: Date;
  /** Whether this group's membership is pushed to the app. */
  push: GroupAppPush;
}

/**
 * Build the Access tab's app rows.
 *
 * @param apps - The group's app assignments, as walked by `useGroupAccessGrants`.
 * @param pushMappings - The group's push mappings. **`undefined` means the
 * enrichment did not run** and every row's push state is `unknown`; an empty
 * array is the loaded fact that this group is pushed nowhere.
 * @returns One model per app, in the order the assignments arrived. Pure.
 */
export function toGroupAppRows(
  apps: readonly AppGrant[],
  pushMappings: readonly PushGroupMapping[] | undefined,
): GroupAppRowModel[] {
  // Built once rather than scanned per row: a group assigned to 200 apps and
  // pushed to 50 of them would otherwise be 10,000 comparisons.
  const byAppId = new Map<string, PushGroupMapping>();
  for (const mapping of pushMappings ?? []) {
    if (!byAppId.has(mapping.appId)) byAppId.set(mapping.appId, mapping);
  }

  return apps.map((app) => ({
    id: app.id,
    label: app.label,
    status: app.status,
    statusVariant: appStatusVariant(app.status),
    signOnMode: app.signOnMode,
    lastUpdated: app.lastUpdated,
    push: pushStateFor(app.id, pushMappings, byAppId),
  }));
}

/**
 * One app's push state.
 *
 * @param appId - The app.
 * @param pushMappings - The raw mappings, whose `undefined`-ness is the whole
 * point — it is what separates "unknown" from "no".
 * @param byAppId - The prebuilt index.
 * @returns The three-state verdict.
 */
function pushStateFor(
  appId: string,
  pushMappings: readonly PushGroupMapping[] | undefined,
  byAppId: ReadonlyMap<string, PushGroupMapping>,
): GroupAppPush {
  if (pushMappings === undefined) return { state: 'unknown' };
  const mapping = byAppId.get(appId);
  if (!mapping) return { state: 'not-pushed' };
  return {
    state: 'pushed',
    targetGroupName: mapping.targetGroupName,
    priority: mapping.priority,
  };
}
