/**
 * Choreographed scenes for the demo reel.
 *
 * These are **stages, not tests**. Each export seeds the demo org, mounts the
 * whole side panel, and stops. Nothing here clicks anything: the walking lives
 * in `.storybook/scripts/capture/walks/`, driven from Playwright by
 * `capture/capture.mjs`. See ADR-0043 for why the split, and ADR-0045 for why
 * the walk is now all that Playwright does.
 *
 * That split is not stylistic. A `play` function cannot scroll a wheel or
 * resize a viewport, and both are load-bearing here — `useStaggerReveal` only
 * cascades rows that actually cross the viewport, and the ActionBar's overflow
 * ladder only re-splits when the panel width really changes. A `play` also
 * blocks Storybook's ready signal behind `waitForAnimations`, which a
 * scroll-driven `.dock-band` holds open for its full five-second ceiling.
 *
 * Every scene therefore carries:
 * - `motion: 'on'` — the preview decorator suppresses all animation otherwise,
 *   which would leave nothing to film.
 * - `tags: ['!test']` — a 15-second staged scene has no business in the browser
 *   suite. They still type-check and still build, which is the gate that matters.
 * - `a11y: { disable: true }` — the axe pass costs seconds on a 250-user DOM and
 *   these are excluded from the a11y gate by `!test` already.
 * - `actions: { disable: true }` — the actions addon serializes every mocked
 *   call onto the channel, which is visible jank at this data volume.
 */
import React, { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import App from '../App';
import { useProgress } from '../contexts/ProgressContext';
import { makeUseOktaApiValue, useOktaApi } from '../../../.storybook/mocks/useOktaApi.mock';
import {
  emitRuntimeMessage,
  resetPageContext,
  resetSchedulerState,
  resetStorageSeed,
  resetSyncSnapshotResponder,
  setPageContext,
  setStorageSeed,
} from '../../../.storybook/mocks/chrome';

import { DEMO_HERO_GROUP_ID, currentGroupsById } from './snapshot';
import { DEMO_COMPARISON_PAIR, demoUsersById } from './users';
import { DEMO_ORIGIN, fakeId } from './org';
import { GROUP } from './memberships';
import { WORKING_SET_STORAGE_KEY, type WorkingSetRef } from '../../shared/storage/workingSetStore';
import {
  demoBatchGetUserDetails,
  demoCaptureRuleImpact,
  demoGetAllGroupMembers,
  demoGetAllGroups,
  demoGetGroupById,
  demoGetGroupMemberCount,
  demoGetGroupRulesForGroup,
  demoGetUserApps,
  demoGetUserById,
  demoGetUserGroupMemberships,
  demoGetUserLastLogin,
  demoGetUserRaw,
  demoMakeApiRequest,
  demoSearchGroups,
  demoScanGroupMfa,
  demoSearchUsers,
  demoUpdateUserProfile,
} from './api';
import { demoDelay, installDemoControls, seedDemoSnapshot, setDemoLatency } from './control';
import { resetDemoWrites } from './state';

/** Storage key `App` restores its active tab from. */
const SELECTED_TAB_KEY = 'okta_unbound_selected_tab';

/**
 * Wrap a demo operation so it pays the scene's artificial latency first.
 *
 * The delay is read at call time, never captured, so `setLatency` can change it
 * mid-scene without any operation identity changing — which is what keeps the
 * facade mock's singleton contract intact.
 */
function slow<A extends unknown[], R>(impl: (...args: A) => Promise<R>) {
  return fn(async (...args: A): Promise<R> => {
    await demoDelay();
    return impl(...args);
  });
}

/**
 * The demo facade value, built exactly once.
 *
 * The real `useOktaApi` returns a memoized object whose operation identities are
 * stable across renders, and the mock must honour that: a fresh object per call
 * would give every op a new identity, re-running any consumer effect that lists
 * one in a dependency array until React throws "Maximum update depth exceeded".
 */
const demoApiValue = makeUseOktaApiValue({
  makeApiRequest: slow(demoMakeApiRequest),
  getAllGroupMembers: slow(demoGetAllGroupMembers),
  getGroupById: slow(demoGetGroupById),
  getGroupMemberCount: slow(demoGetGroupMemberCount),
  getGroupRulesForGroup: slow(demoGetGroupRulesForGroup),
  getAllGroups: slow(demoGetAllGroups),
  searchGroups: slow(demoSearchGroups),
  searchUsers: slow(demoSearchUsers),
  getUserById: slow(demoGetUserById),
  getUserRaw: slow(demoGetUserRaw),
  getUserApps: slow(demoGetUserApps),
  getUserLastLogin: slow(demoGetUserLastLogin),
  getUserGroupMemberships: slow(demoGetUserGroupMemberships),
  batchGetUserDetails: slow(demoBatchGetUserDetails),
  captureRuleImpact: slow(demoCaptureRuleImpact),
  updateUserProfile: slow(demoUpdateUserProfile),
  // Not wrapped in `slow`: the scan paces itself against a wall clock so the bar
  // lands on its mark, and adding the scene's read latency on top would push it
  // past the shot it is framed for.
  scanGroupMfa: fn(demoScanGroupMfa),
});

/**
 * Publishes the live progress handle onto the demo control surface.
 *
 * Renders nothing. It exists because `ProgressContext` is only reachable from
 * inside the provider, and the film script needs to drive the ActivityBar from
 * outside the page. The MFA-coverage scene uses it: `demoScanGroupMfa` reports
 * through this bridge because the real scan drives the bar via
 * `coreApi.runOperation`, and the scenes have mocked that facade away.
 */
const DemoBridge: React.FC = () => {
  const { startProgress, updateBatch, completeProgress } = useProgress();

  useEffect(() => {
    const controls = installDemoControls(() => emitRuntimeMessage({ action: 'snapshotUpdated' }));
    controls.progress = {
      start: (operationName, message, total) => startProgress(operationName, message, total, true),
      update: (completed, total, message) =>
        updateBatch({ total, completed, active: 0, failed: 0 }, message),
      complete: completeProgress,
    };
  }, [startProgress, updateBatch, completeProgress]);

  return null;
};

/** Stage shared by every scene: fresh mocks, a seeded org, a connected page. */
async function stage(options: {
  tab: string;
  latency?: number;
  context?: Record<string, unknown>;
}): Promise<void> {
  resetSyncSnapshotResponder();
  resetSchedulerState();
  // Before the seed: `seedDemoSnapshot` reads the org through the overlay, so a
  // take that inherited the previous take's edits would seed them into IndexedDB.
  resetDemoWrites();
  resetPageContext();
  resetStorageSeed();

  useOktaApi.mockReturnValue(demoApiValue);
  setDemoLatency(options.latency ?? 450);
  setStorageSeed({ [SELECTED_TAB_KEY]: options.tab });
  if (options.context) setPageContext(options.context);

  await seedDemoSnapshot();
}

const meta = {
  title: 'Demo/Scenes',
  component: App,
  // Not `autodocs`: a docs page renders every story inline, and each `App`
  // instance emits a `MODAL_LAYER_ID` node, so overlays from all of them would
  // portal into whichever landed first.
  tags: ['!test'],
  parameters: {
    layout: 'fullscreen',
    motion: 'on',
    a11y: { disable: true },
    actions: { disable: true },
  },
  render: () => (
    <>
      <DemoBridge />
      <App />
    </>
  ),
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The connected-page context every scene that drills into the hero group needs. */
const heroGroupContext = {
  getGroupInfo: {
    groupId: DEMO_HERO_GROUP_ID,
    groupName: currentGroupsById().get(DEMO_HERO_GROUP_ID)?.profile?.name ?? 'Engineering - All',
  },
};

/**
 * Scene 1 — browse the org's groups, open one, and ask why someone is in it.
 *
 * Showcases the `rise-in-stagger` cascade, the 320ms `animate-push-in` detail
 * view, and the `.disclose` row expansion that reveals membership provenance.
 */
export const GroupDrilldown: Story = {
  beforeEach: async () => {
    await stage({ tab: 'groups', context: heroGroupContext });
  },
};

/**
 * Scene 2 — preview what turning a rule off would cost.
 *
 * The affected-user count is computed by the app's real `summarizeRuleImpact`
 * over the demo memberships, so the number on screen is derived, not written.
 */
export const RuleImpact: Story = {
  beforeEach: async () => {
    await stage({ tab: 'rules', latency: 700 });
  },
};

/**
 * Scene 3 — MFA coverage across a group, one request per member.
 *
 * Replaces an earlier bulk-membership scene that drove the ActivityBar by hand
 * over a surface where nothing was being written. This one is the real thing:
 * `scanGroupMfa` is genuinely one `GET /api/v1/users/{id}/factors` per member,
 * the single job in this app that no query parameter can collapse, and
 * therefore the one place the scheduler's progress bar is reporting on work an
 * administrator actually waits for.
 *
 * The numbers are derived end to end. Factors come from
 * {@link module:sidepanel/demo/factors}, which computes them from each user's
 * own status, employee type and department; the panel then summarizes them with
 * the same `summarizeFactors` a live org would go through. So when the coverage
 * line says how many members have no second factor, that count is a consequence
 * of the org, and filtering the roster to those people returns exactly them.
 */
export const MfaCoverage: Story = {
  beforeEach: async () => {
    await stage({ tab: 'groups', latency: 300, context: heroGroupContext });
  },
};

/**
 * Scene 4 — a group read as a population rather than as a list.
 *
 * The composition reports discover their own facets: `discoverAttributeBreakdowns`
 * looks at what the members actually carry rather than at a fixed column set, so
 * the dimensions on screen are the ones this group happens to vary along. Sorting
 * and filtering then compose over the same roster.
 */
export const GroupComposition: Story = {
  beforeEach: async () => {
    await stage({ tab: 'groups', latency: 300, context: heroGroupContext });
  },
};

/**
 * Scene 4 — two people side by side across groups, apps and attributes.
 *
 * The pair is pinned so every take frames the same two rows. Their app diff is
 * a real consequence of their group diff: `demoGetUserApps` derives apps from
 * the app-sourced groups each of them is actually in.
 */
export const UserComparison: Story = {
  beforeEach: async () => {
    const left = demoUsersById.get(DEMO_COMPARISON_PAIR.left);
    await stage({
      tab: 'users',
      latency: 350,
      context: {
        getUserInfo: left
          ? {
              userId: left.id,
              userName: `${left.profile.firstName} ${left.profile.lastName}`,
              userEmail: left.profile.email,
              userStatus: left.status,
            }
          : null,
      },
    });
  },
};

/**
 * Scene 5 — why one of the pair has access and the other does not.
 *
 * The same stage as {@link UserComparison}: the film script runs the compare
 * flow as a prologue and this scene's argument starts where that one's ends. It
 * is a separate story rather than a second choreography over the same one
 * because `SCENES` is keyed by story id, and a scene is a stage.
 */
export const AccessCauses: Story = {
  beforeEach: async () => {
    const left = demoUsersById.get(DEMO_COMPARISON_PAIR.left);
    await stage({
      tab: 'users',
      latency: 350,
      context: {
        getUserInfo: left
          ? {
              userId: left.id,
              userName: `${left.profile.firstName} ${left.profile.lastName}`,
              userEmail: left.profile.email,
              userStatus: left.status,
            }
          : null,
      },
    });
  },
};

/**
 * Scene 5 — the action strip.
 *
 * Two beats, both driven from Playwright. A scroll ramp walks the `.dock-band`
 * through its `view-timeline` merge into the page header; a viewport sweep from
 * 1000px down to 380px walks the overflow ladder in `actionBarFit`, including
 * the two points where dropping an action buys enough room for the icons to
 * come back.
 */
export const ActionBarShowcase: Story = {
  beforeEach: async () => {
    await stage({ tab: 'groups', latency: 200, context: heroGroupContext });
  },
};

/**
 * The Home tab's working set, seeded so **Pinned** and **Recent** both arrive
 * with rows rather than the tab's own empty-state copy.
 *
 * Reuses the same hero entities the other scenes already made interesting —
 * {@link DEMO_HERO_GROUP_ID} (Engineering - All) and the
 * {@link DEMO_COMPARISON_PAIR} — so a jump-bar id lookup for one of these rows
 * resolves against data the panel already has opinions about, rather than
 * against an entity invented for this scene alone. `Sales - All` fills out the
 * fourth row so neither list is a single entry.
 *
 * Deliberately respects {@link WorkingSetRef}'s actual shape: `kind`, `id`,
 * `name`, an optional `lastPane`, and `lastSeenAt` — no email, no status, no
 * membership, matching what `workingSetStore`'s own module header says this
 * storage is allowed to hold. One row omits `lastPane` on purpose, so the row
 * exercises `WorkingSetRow`'s fallback to the bare kind label rather than
 * `<Kind> · left on <pane>` on every row.
 */
function homeWorkingSetSeed(): {
  version: 1;
  origins: Record<string, { pinned: WorkingSetRef[]; recent: WorkingSetRef[] }>;
} {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const engineeringGroup = currentGroupsById().get(DEMO_HERO_GROUP_ID);
  const salesId = fakeId('00g', GROUP.sales);
  const salesGroup = currentGroupsById().get(salesId);
  const left = demoUsersById.get(DEMO_COMPARISON_PAIR.left);
  const right = demoUsersById.get(DEMO_COMPARISON_PAIR.right);

  const pinned: WorkingSetRef[] = [
    {
      kind: 'group',
      id: DEMO_HERO_GROUP_ID,
      name: engineeringGroup?.profile?.name ?? 'Engineering - All',
      lastPane: 'Attributes',
      lastSeenAt: now - 5 * hour,
    },
    {
      kind: 'user',
      id: DEMO_COMPARISON_PAIR.left,
      name: left ? `${left.profile.firstName} ${left.profile.lastName}` : 'Amara Okonkwo',
      lastPane: 'Groups',
      lastSeenAt: now - 2 * day,
    },
  ];

  const recent: WorkingSetRef[] = [
    {
      kind: 'user',
      id: DEMO_COMPARISON_PAIR.right,
      name: right ? `${right.profile.firstName} ${right.profile.lastName}` : 'Tomas Lindqvist',
      lastPane: 'Apps',
      lastSeenAt: now - 30 * 60 * 1000,
    },
    {
      // No `lastPane`: exercises the row's fallback to the bare kind label,
      // which a rung with no view stack (the truth for a group opened but not
      // drilled into a pane) actually produces.
      kind: 'group',
      id: salesId,
      name: salesGroup?.profile?.name ?? 'Sales - All',
      lastSeenAt: now - 3 * day,
    },
  ];

  return { version: 1, origins: { [DEMO_ORIGIN]: { pinned, recent } } };
}

/**
 * Scene 6 — the Home tab: search the org, pick up where you left off, and see
 * what needs fixing.
 *
 * The jump bar, the org findings and the reports card all read the org
 * snapshot the same way the other scenes' tabs do, so this stage needs nothing
 * bespoke for them — `stage()` already seeds it. The one thing no other scene
 * seeds is the working set, so this one does, via {@link homeWorkingSetSeed}.
 */
export const Home: Story = {
  beforeEach: async () => {
    await stage({ tab: 'home', latency: 300 });
    setStorageSeed({ [WORKING_SET_STORAGE_KEY]: homeWorkingSetSeed() });
  },
};
