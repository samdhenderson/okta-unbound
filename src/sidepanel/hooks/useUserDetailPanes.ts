/**
 * @module sidepanel/hooks/useUserDetailPanes
 * @description Everything the user-detail rung's three panes need, in one hook.
 *
 * The detail rung shows **Groups**, **Apps** and **Profile** as three tabbed
 * panes of one card. Which pane is on screen is the only piece of that state the
 * rung's neighbours also read — the tiered `ActionBar` sits above the card and
 * the `PageHeader` counts apps beside groups — so `pane` lifts to here while
 * every filter, pill and disclosure stays local to the pane that owns it
 * (`docs/state-management.md`). Panes are hidden rather than unmounted
 * (ADR-0016/ADR-0018), so local state survives a pane switch without being
 * lifted or persisted.
 *
 * ## Nothing loads until its pane is asked for
 *
 * Groups is the default pane, so opening a user must not pay for the other two.
 * Both of the loads here are therefore gated on their own pane with the
 * **deferred re-arm** from `docs/state-management.md` — `enabled` sits in the
 * guard *and* the dependency array — so the first entry to a pane runs the work
 * that was deferred and a return to it refetches nothing (the entity cache
 * serves the fresh entry).
 *
 * - **Apps** — {@link sidepanel/hooks/useUserApps.useUserApps}, gated on
 *   `pane === 'apps'`.
 * - **The org's profile schema** — one org-wide read cached under
 *   {@link sidepanel/cache/keys.cacheKeys.userSchema} at `TTL_LONG`, gated on
 *   `pane === 'profile'`. It is asked per **org**, never per user.
 * - **The user's app assignments**, gated on `pane === 'profile'` as well. Not
 *   for the Apps pane — for the *editability* gate: `master.priority` on a schema
 *   property names app instances, and whether this user is attached to any of
 *   them is what turns an org-wide `PROFILE_MASTER` into a fact about one person
 *   ({@link module:sidepanel/components/users/profileEditability}). It is the
 *   same walk the Apps pane runs, read through the same cache key, so the two
 *   panes cost one walk between them however they are visited — and the entity
 *   cache folds concurrent asks onto one in-flight promise. What it deliberately
 *   does **not** reuse is `useUserApps`: that hook follows its list with a
 *   per-app fan-out to name granting groups, which the Profile pane has no use
 *   for and must not pay for.
 *
 * The whole hook is additionally gated on the Users tab being the visible one,
 * so a hidden tab spends no scheduler budget (ADR-0018).
 *
 * ## `appCount` omits rather than zeroes
 *
 * The header's apps metric comes from the full assignment list this hook
 * resolves. A first-page count would silently undercount any user with more than
 * one page of apps, so the completed walk is the only honest source for it.
 * It is `undefined` until a walk has actually returned — `useUserApps.hasLoaded`,
 * not `apps.length`. The two are different questions: an empty array means
 * *either* nothing has loaded yet *or* the walk finished and the user genuinely
 * has no apps. ADR-0032 §2a says omit a fact you cannot answer — but a loaded
 * zero **is** an answer, and hiding it is the same defect in the other
 * direction. `hasLoaded` is what tells them apart.
 *
 * ## Security
 *
 * Profile attributes and rule names are tenant data and frequently PII. Nothing
 * here logs any of it; `allProfileAttributes` has already dropped every
 * security-sensitive key (`isExcludedProfileField`) before a descriptor exists.
 */

import { useMemo, useState } from 'react';
import type { GroupMembership, OktaUser } from '../../shared/types';
import type { OktaUserProfileSchema } from '../../shared/schemas/okta';
import type { ProfileDisplayConfig } from '../../shared/storage/profileDisplayStore';
import { useEntityQuery } from '../cache/useEntityQuery';
import { cacheKeys, TTL_LONG } from '../cache/keys';
import {
  allProfileAttributes,
  type AttributeDescriptor,
} from '../components/users/profileAttributes';
import { profileMastering, type ProfileMastering } from '../components/users/profileEditability';
import { profileRuleReads } from '../components/users/profileRuleReads';
import { useOktaApi } from './useOktaApi';
import { useProfileDisplayConfig } from './useProfileDisplayConfig';
import { useUserApps, type AppsByGroupId } from './useUserApps';
import type { UserAppAssignment, UserAppsResult } from './useOktaApi/userOperations';
import type { RuleInventoryState } from './useUserMemberships';
import { userDisplayName } from '../../shared/utils/userDisplay';
import { useWorkingSetEntry } from './useWorkingSetEntry';

/** Which pane of the user-detail rung is on screen. */
export type UserDetailPane = 'groups' | 'apps' | 'profile';

/** Pane keys as the Home tab's working set shows them back to the reader. */
const PANE_LABEL: Record<UserDetailPane, string> = {
  groups: 'Groups',
  apps: 'Apps',
  profile: 'Profile',
};

/** Options for {@link useUserDetailPanes}. */
export interface UseUserDetailPanesOptions {
  /** The user whose detail rung is open, or `null` when none is selected. */
  user: OktaUser | null;
  /** Chrome tab id of the connected Okta tab; nothing loads without one. */
  targetTabId?: number;
  /** Okta org origin — the key both the schema and the display config are held under. */
  oktaOrigin: string | null;
  /** The user's analysed memberships, as the rung already holds them. */
  memberships: GroupMembership[];
  /**
   * The org-wide group-rule inventory from
   * {@link sidepanel/hooks/useUserMemberships.useUserMemberships}. Only the
   * `available` state produces rule marks: `unresolved` and `unavailable` both
   * render as *no* marks, never as "no rule reads this".
   */
  rules: RuleInventoryState;
  /**
   * Whether the Users tab is the visible one. Gates both loads, so a hidden tab
   * spends no scheduler budget (ADR-0018). Defaults to `true`.
   */
  enabled?: boolean;
}

/** What {@link useUserDetailPanes} returns. */
export interface UseUserDetailPanesReturn {
  /** Which pane is on screen. */
  pane: UserDetailPane;
  /** Selects a pane. Loads gated on that pane run on the first switch to it. */
  setPane: (pane: UserDetailPane) => void;

  /** The user's app assignments, granting group filled in wherever it is known. */
  apps: UserAppAssignment[];
  /** `true` while the apps list is loading with nothing cached to show. */
  isLoadingApps: boolean;
  /** `false` when the app pagination walk did not finish; the pane must say so. */
  appsComplete: boolean;
  /** Group id → the labels of the apps that group grants — the Groups pane's `Also grants:` line. */
  appsByGroupId: AppsByGroupId;
  /**
   * How many apps the user has, for the header's metric — `undefined` until the
   * list has loaded something. See the module header for why zero is omitted.
   */
  appCount?: number;

  /** Every attribute of this user's profile, empty ones included. */
  attributes: AttributeDescriptor[];
  /** `true` while the org's profile schema is loading with nothing cached. */
  isLoadingProfile: boolean;
  /** The admin's reconciled profile-display configuration for this org. */
  profileConfig: ProfileDisplayConfig;
  /** Applies one patch to the configuration and persists it (coalesced). */
  updateProfileConfig: (patch: Partial<ProfileDisplayConfig>) => void;
  /** Discards the org's configuration and returns to the shipped defaults. */
  resetProfileConfig: () => void;
  /**
   * Attribute Okta name → the names of the rules that read it *and* currently
   * grant this user access. Attributes no qualifying rule reads are absent.
   */
  ruleReads: Record<string, string[]>;
  /**
   * Which profile sources are attached to this user, for the editability gate.
   *
   * Empty (`{}`) until the Profile pane's app walk has finished, which reads as
   * "cannot say" and leaves every externally-mastered attribute locked — the
   * conservative direction.
   */
  mastering: ProfileMastering;
}

/**
 * Owns the user-detail rung's pane selection and the two loads that hang off it.
 *
 * @param options - See {@link UseUserDetailPanesOptions}.
 * @returns The pane selector plus the apps and profile data — see
 *   {@link UseUserDetailPanesReturn}.
 *
 * @example
 * ```tsx
 * const panes = useUserDetailPanes({
 *   user: selectedUser,
 *   targetTabId,
 *   oktaOrigin,
 *   memberships,
 *   rules,
 *   enabled: isActive,
 * });
 * ```
 */
export function useUserDetailPanes({
  user,
  targetTabId,
  oktaOrigin,
  memberships,
  rules,
  enabled = true,
}: UseUserDetailPanesOptions): UseUserDetailPanesReturn {
  const [pane, setPane] = useState<UserDetailPane>('groups');
  const { getUserProfileSchema, getUserApps } = useOktaApi({ targetTabId: targetTabId ?? null });

  // A new user opens on Groups. Without this the rung would inherit whichever
  // pane the previous user was left on, and the header's counts would describe
  // one person while the visible pane described another.
  //
  // Adjusting state during render on an input change, the pattern `PageHeader`
  // and `Modal` already use: React re-renders immediately without committing the
  // intermediate frame, so the panes never flash the outgoing user's tab.
  const userId = user?.id ?? null;
  const [paneUserId, setPaneUserId] = useState<string | null>(userId);
  if (paneUserId !== userId) {
    setPaneUserId(userId);
    setPane('groups');
  }

  // Two lines, and the reason they are *here* rather than in the navigation
  // machinery: this rung is the only surface that knows all four facts at once —
  // which kind, which id, what it is called, and which pane is open. Gated on
  // the same `enabled` as the loads, because the rung stays mounted behind
  // another top-level tab (ADR-0018) and a hidden one must not keep re-asserting
  // itself as the most recent thing the reader looked at.
  useWorkingSetEntry({
    origin: oktaOrigin,
    kind: 'user',
    id: userId,
    name: user ? userDisplayName(user) : null,
    pane: PANE_LABEL[pane],
    enabled,
  });

  const appsResult = useUserApps(userId, {
    targetTabId: targetTabId ?? null,
    memberships,
    // Scopes the org snapshot the granting-group fallback consults before it
    // walks anything — see `useUserApps`' "The snapshot answers first".
    oktaOrigin,
    enabled: enabled && pane === 'apps',
  });

  // Org-wide, never per user: the full profile-attribute definition, including
  // attributes this user has not set. Deferred until the Profile pane is asked
  // for, then held for TTL_LONG — an org's schema does not change during a
  // session.
  const schemaQuery = useEntityQuery<OktaUserProfileSchema | null>(
    cacheKeys.userSchema(oktaOrigin),
    () => getUserProfileSchema(),
    { ttl: TTL_LONG, enabled: enabled && pane === 'profile' && Boolean(targetTabId) },
  );

  // The same key `useUserApps` uses, deliberately: whichever pane is opened first
  // pays for the walk and the other reads it back from the cache.
  const masteringApps = useEntityQuery<UserAppsResult>(
    cacheKeys.userApps(userId ?? 'none'),
    () => getUserApps(userId as string),
    { enabled: enabled && pane === 'profile' && Boolean(userId) },
  );

  // An incomplete walk is discarded rather than trusted: the gate's only question
  // is whether a mastering app is *absent*, and a truncated list answers "absent"
  // for every app it never reached.
  const mastering = useMemo(
    () => profileMastering(masteringApps.data?.apps, masteringApps.data?.complete ?? false),
    [masteringApps.data],
  );

  const attributes = useMemo(
    () => (user ? allProfileAttributes(user, schemaQuery.data) : []),
    [user, schemaQuery.data],
  );

  // The hook memoizes on the joined names, so a fresh array each render is fine.
  const attributeNames = attributes.map((attribute) => attribute.name);
  const {
    config: profileConfig,
    update: updateProfileConfig,
    reset: resetProfileConfig,
  } = useProfileDisplayConfig(oktaOrigin, attributeNames);

  // `unresolved` and `unavailable` both mean "we cannot say", which renders as no
  // marks at all — never as "no rule reads this attribute".
  const ruleReads = useMemo(
    () =>
      user && rules.status === 'available' ? profileRuleReads(rules.rules, user, memberships) : {},
    [rules, user, memberships],
  );

  return {
    pane,
    setPane,

    apps: appsResult.apps,
    isLoadingApps: appsResult.isLoading,
    appsComplete: appsResult.complete,
    appsByGroupId: appsResult.appsByGroupId,
    appCount: appsResult.hasLoaded ? appsResult.apps.length : undefined,

    attributes,
    isLoadingProfile: schemaQuery.isLoading,
    profileConfig,
    updateProfileConfig,
    resetProfileConfig,
    ruleReads,
    mastering,
  };
}
