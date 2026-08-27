/**
 * Choreographed scenes for the demo reel.
 *
 * These are **stages, not tests**. Each export seeds the demo org, mounts the
 * whole side panel, and stops. Nothing here clicks anything: the choreography
 * lives in `.storybook/scripts/film-scenes.mjs`, which drives the page from
 * Playwright. See ADR-0043 for why.
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

import { DEMO_HERO_GROUP_ID, demoGroupsById } from './snapshot';
import { DEMO_COMPARISON_PAIR, demoUsersById } from './users';
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
  demoSearchUsers,
} from './api';
import { demoDelay, installDemoControls, seedDemoSnapshot, setDemoLatency } from './control';

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
});

/**
 * Publishes the live progress handle onto the demo control surface.
 *
 * Renders nothing. It exists because `ProgressContext` is only reachable from
 * inside the provider, and the film script needs to drive the ActivityBar from
 * outside the page for the bulk-operation scene.
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

/**
 * Scene 1 — browse the org's groups, open one, and ask why someone is in it.
 *
 * Showcases the `rise-in-stagger` cascade, the 320ms `animate-push-in` detail
 * view, and the `.disclose` row expansion that reveals membership provenance.
 */
export const GroupDrilldown: Story = {
  beforeEach: async () => {
    await stage({
      tab: 'groups',
      context: {
        getGroupInfo: {
          groupId: DEMO_HERO_GROUP_ID,
          groupName: demoGroupsById.get(DEMO_HERO_GROUP_ID)?.profile?.name ?? 'Engineering - All',
        },
      },
    });
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
 * Scene 3 — a bulk membership change, with the ActivityBar tracking it.
 *
 * The progress bar's motion is real; its *numbers* are driven by the film
 * script through `__OKTA_DEMO__.progress`, because bulk-operation progress
 * normally flows through the facade this story has mocked away.
 */
export const BulkOperation: Story = {
  beforeEach: async () => {
    await stage({ tab: 'users', latency: 300 });
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
    await stage({
      tab: 'groups',
      latency: 200,
      context: {
        getGroupInfo: {
          groupId: DEMO_HERO_GROUP_ID,
          groupName: demoGroupsById.get(DEMO_HERO_GROUP_ID)?.profile?.name ?? 'Engineering - All',
        },
      },
    });
  },
};
