/**
 * @module sidepanel/demo/api
 * @description Demo implementations of the `useOktaApi` operations the scenes use.
 *
 * These are **plain async functions**, deliberately free of any Storybook or
 * test-runner import. `.storybook/mocks/demoApi.ts` wraps each one in a spy and
 * merges them into the facade mock; keeping the logic here means it is
 * type-checked, linted and knip-reachable like the rest of `src`, while the
 * spy-wrapping stays in the Storybook layer where it belongs.
 *
 * Two things are answered here rather than by named operations:
 *
 * - **`makeApiRequest`** — several side-panel hooks bypass the named ops and
 *   call the core transport directly (`getUserGroupsRequest`,
 *   `searchUsersRequest`, `useGroupLiveSearch`, `useDetectedUser`). Those go
 *   through the endpoint router below.
 * - **Rule impact** — computed with the app's real {@link summarizeRuleImpact}
 *   over the demo memberships, not hand-written. The number on screen is
 *   therefore one the app derived, which is the whole reason the dataset models
 *   memberships instead of asserting counts.
 */
import type { MemberMfaResult, OktaGroup, OktaUser } from '../../shared/types';
import { summarizeFactors } from '../../shared/utils/mfaUtils';
import {
  summarizeRuleImpact,
  toImpactRule,
  type RuleImpactSummary,
  type TargetGroupMembers,
} from '../../shared/membership/ruleImpact';
import type { DemoControls } from './control';
import { demoFactorsFor } from './factors';
import { demoGroupMembers, demoUserGroups } from './memberships';
import { demoApps, demoGroups, demoGroupsById, demoRules } from './snapshot';
import { demoUsers, demoUsersById } from './users';

/** A `{ success, data }` envelope, matching what the real core transport returns. */
interface DemoResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

const ok = (data: unknown): DemoResult => ({ success: true, data });

/** Narrow a raw demo group to the `OktaGroup` shape the panel's types use. */
function asOktaGroup(id: string): OktaGroup | null {
  const raw = demoGroupsById.get(id);
  if (!raw) return null;
  return {
    id: raw.id,
    type: raw.type,
    profile: { name: raw.profile?.name ?? raw.id, description: raw.profile?.description },
  };
}

/** The flattened user record `searchUsers`/`getUserById` return. */
interface FlatUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  login: string;
  status: string;
}

function flatten(user: OktaUser): FlatUser {
  return {
    id: user.id,
    email: user.profile.email,
    firstName: user.profile.firstName,
    lastName: user.profile.lastName,
    login: user.profile.login,
    status: user.status,
  };
}

/** Case-insensitive match across the fields Okta's `q` searches. */
function matchesQuery(user: OktaUser, query: string): boolean {
  const q = query.toLowerCase();
  const { firstName, lastName, email, login } = user.profile;
  return (
    firstName.toLowerCase().includes(q) ||
    lastName.toLowerCase().includes(q) ||
    email.toLowerCase().includes(q) ||
    login.toLowerCase().includes(q) ||
    `${firstName} ${lastName}`.toLowerCase().includes(q)
  );
}

/** Everyone in a group, resolved from the derived memberships. */
export function demoMembersOf(groupId: string): OktaUser[] {
  const ids = demoGroupMembers.get(groupId) ?? [];
  return ids.map((id) => demoUsersById.get(id)).filter((u): u is OktaUser => Boolean(u));
}

/**
 * Read one parameter out of a query string.
 *
 * Hand-rolled rather than using `URLSearchParams` because the demo modules are
 * linted under the app's config, where that browser global is not declared —
 * and a lint warning is not worth a dependency on it for one lookup.
 */
function queryParam(queryString: string, name: string): string {
  for (const pair of queryString.split('&')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    if (decodeURIComponent(pair.slice(0, eq)) === name) {
      return decodeURIComponent(pair.slice(eq + 1));
    }
  }
  return '';
}

/**
 * Route a raw endpoint to demo data.
 *
 * Covers the endpoints side-panel hooks reach for directly. Anything else
 * returns an empty success, which every caller degrades on cleanly rather than
 * showing an error banner.
 */
export async function demoMakeApiRequest(endpoint?: string): Promise<DemoResult> {
  if (typeof endpoint !== 'string') return ok([]);

  const [path = '', queryString = ''] = endpoint.split('?');
  const captured = (pattern: RegExp): string | undefined => pattern.exec(path)?.[1];

  const userId = captured(/^\/api\/v1\/users\/([^/]+)\/groups$/);
  if (userId !== undefined) {
    const ids = demoUserGroups.get(userId) ?? [];
    return ok(ids.map((id) => demoGroupsById.get(id)).filter(Boolean));
  }

  const memberGroupId = captured(/^\/api\/v1\/groups\/([^/]+)\/users$/);
  if (memberGroupId !== undefined) return ok(demoMembersOf(memberGroupId));

  if (path === '/api/v1/groups/rules') return ok(demoRules);

  const groupId = captured(/^\/api\/v1\/groups\/([^/]+)$/);
  if (groupId !== undefined) return ok(demoGroupsById.get(groupId) ?? null);

  if (path === '/api/v1/groups') {
    const q = queryParam(queryString, 'q');
    const hits = demoGroups.filter((g) =>
      (g.profile?.name ?? '').toLowerCase().includes(q.toLowerCase()),
    );
    return ok(hits.slice(0, 20));
  }

  if (path === '/api/v1/users') {
    const q = queryParam(queryString, 'q') || queryParam(queryString, 'search');
    return ok(demoUsers.filter((u) => matchesQuery(u, q)).slice(0, 20));
  }

  // The factors route exists so a direct-transport caller and the named
  // `scanGroupMfa` operation below cannot disagree about the same user.
  const factorsUserId = captured(/^\/api\/v1\/users\/([^/]+)\/factors$/);
  if (factorsUserId !== undefined) return ok(demoFactorsFor(factorsUserId));

  const singleUserId = captured(/^\/api\/v1\/users\/([^/]+)$/);
  if (singleUserId !== undefined) return ok(demoUsersById.get(singleUserId) ?? null);

  if (path.startsWith('/api/v1/apps')) return ok(demoApps);

  return ok([]);
}

/**
 * Preview what deactivating a rule would cost, using the app's real summarizer.
 *
 * @param rule - The rule under preview; only its id and name are read here, the
 * rest of the analysis comes from the demo memberships and rule set.
 */
export async function demoCaptureRuleImpact(rule: {
  id: string;
  name?: string;
}): Promise<RuleImpactSummary> {
  const subject = demoRules.find((r) => r.id === rule.id);
  const targetIds = subject?.actions?.assignUserToGroups?.groupIds ?? [];

  const targets: TargetGroupMembers[] = targetIds.map((groupId) => {
    const raw = demoGroupsById.get(groupId);
    return {
      groupId,
      groupName: raw?.profile?.name ?? groupId,
      groupType: raw?.type,
      members: demoMembersOf(groupId),
    };
  });

  return summarizeRuleImpact(
    rule.id,
    rule.name ?? subject?.name ?? rule.id,
    targets,
    demoRules.map(toImpactRule),
  );
}

/** Everyone in a group. */
export async function demoGetAllGroupMembers(groupId: string): Promise<OktaUser[]> {
  return demoMembersOf(groupId);
}

/** One group, in the narrow `OktaGroup` shape. */
export async function demoGetGroupById(groupId: string): Promise<OktaGroup | null> {
  return asOktaGroup(groupId);
}

/** How many members a group has. */
export async function demoGetGroupMemberCount(groupId: string): Promise<number> {
  return demoGroupMembers.get(groupId)?.length ?? 0;
}

/** Search users by name/email/login. */
export async function demoSearchUsers(query: string): Promise<FlatUser[]> {
  if (query.trim().length < 2) return [];
  return demoUsers
    .filter((u) => matchesQuery(u, query))
    .slice(0, 20)
    .map(flatten);
}

/** One user, flattened. */
export async function demoGetUserById(userId: string): Promise<FlatUser | null> {
  const user = demoUsersById.get(userId);
  return user ? flatten(user) : null;
}

/** The whole validated user, profile included — what a profile editor needs. */
export async function demoGetUserRaw(userId: string): Promise<OktaUser | null> {
  return demoUsersById.get(userId) ?? null;
}

/** How many groups a user belongs to. */
export async function demoGetUserGroupMemberships(userId: string): Promise<number> {
  return demoUserGroups.get(userId)?.length ?? 0;
}

/** A user's last sign-in, or `null` when they have never signed in. */
export async function demoGetUserLastLogin(userId: string): Promise<Date | null> {
  const last = demoUsersById.get(userId)?.lastLogin;
  return last ? new Date(last) : null;
}

/** Several users at once, keyed by id. */
export async function demoBatchGetUserDetails(userIds: string[]): Promise<Map<string, OktaUser>> {
  const out = new Map<string, OktaUser>();
  for (const id of userIds) {
    const user = demoUsersById.get(id);
    if (user) out.set(id, user);
  }
  return out;
}

/**
 * A user's app assignments, derived from their groups' push mappings.
 *
 * Each app-sourced group the user is in contributes its app, so the comparison
 * scene's app diff is a real consequence of the group diff beside it.
 */
export async function demoGetUserApps(
  userId: string,
): Promise<{ apps: { id: string; label: string; groupId?: string }[]; complete: boolean }> {
  const groupIds = demoUserGroups.get(userId) ?? [];
  const apps = new Map<string, { id: string; label: string; groupId?: string }>();

  for (const groupId of groupIds) {
    const source = demoGroupsById.get(groupId)?.source;
    if (!source) continue;
    if (!apps.has(source.id)) {
      apps.set(source.id, { id: source.id, label: source.name ?? source.id, groupId });
    }
  }

  return { apps: [...apps.values()], complete: true };
}

/** The org's groups, raw. */
export async function demoGetAllGroups(): Promise<typeof demoGroups> {
  return demoGroups;
}

/** Groups matching a search string. */
export async function demoSearchGroups(query: string): Promise<typeof demoGroups> {
  const q = query.toLowerCase();
  return demoGroups.filter((g) => (g.profile?.name ?? '').toLowerCase().includes(q)).slice(0, 20);
}

/** Every rule that assigns into a group. */
export async function demoGetGroupRulesForGroup(groupId: string): Promise<typeof demoRules> {
  return demoRules.filter((r) => (r.actions?.assignUserToGroups?.groupIds ?? []).includes(groupId));
}

/**
 * How long a full scan should take on camera, in milliseconds.
 *
 * The real operation is one `GET /api/v1/users/{id}/factors` per member — the
 * one job in this app that is genuinely irreducible, and therefore the one place
 * the scheduler's progress bar is doing something an admin actually waits on. A
 * demo that resolved it instantly would show the bar for two frames and prove
 * nothing; one that took as long as the real thing would be unwatchable. Seven
 * seconds is long enough to read the bar move and short enough to hold a shot.
 */
const SCAN_WALL_CLOCK_MS = 7000;

/**
 * Scan a set of users for enrolled MFA factors, the way the real operation does.
 *
 * Mirrors `useOktaApi`'s `scanGroupMfa`: same signature, same `Map` return, same
 * per-user summarization through the app's own {@link summarizeFactors}, so the
 * numbers the coverage view renders are derived here exactly as they would be
 * from a live org.
 *
 * The one thing it cannot mirror is the ActivityBar. The real scan drives it via
 * `coreApi.runOperation`, and the scenes have mocked the facade that provides
 * it — so progress is reported through the `__OKTA_DEMO__.progress` bridge the
 * story publishes, which is wired to the same `ProgressContext` the real bar
 * reads. The bar's motion is real; only its source is different.
 *
 * @param userIds - The members to scan, in the order the bar will count them.
 * @param onProgress - Optional per-item callback, matching the real operation's.
 * @returns Per-user results keyed by user id.
 */
export async function demoScanGroupMfa(
  userIds: string[],
  onProgress?: (current: number, total: number) => void,
): Promise<Map<string, MemberMfaResult>> {
  const total = userIds.length;
  const results = new Map<string, MemberMfaResult>();
  const progress = (globalThis as { __OKTA_DEMO__?: DemoControls }).__OKTA_DEMO__?.progress;

  progress?.start('MFA scan', `Scanning 0/${total} members`, total);

  // Pace by elapsed wall clock rather than by a fixed per-item sleep, so the
  // scan still lands on its mark when the machine is busy encoding video.
  const started = Date.now();
  for (const [i, userId] of userIds.entries()) {
    const completed = i + 1;
    results.set(userId, summarizeFactors(userId, demoFactorsFor(userId)));

    const due = started + (SCAN_WALL_CLOCK_MS * completed) / Math.max(total, 1);
    const wait = due - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

    progress?.update(completed, total, `Scanned ${completed}/${total} members`);
    onProgress?.(completed, total);
  }

  progress?.complete();
  return results;
}
