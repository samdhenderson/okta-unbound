/**
 * @module sidepanel/demo/control
 * @description The surface the film script drives a scene through.
 *
 * A `Demo/` scene carries no `play` function: the story only sets the stage, and
 * all choreography happens from Playwright. That means the beats a scene needs
 * — seed the org, make a loading state last long enough to see, push the
 * progress bar, flip the connected page context — have to be reachable from
 * outside the page. This module publishes them on `globalThis.__OKTA_DEMO__`, so
 * the script can `page.evaluate(() => __OKTA_DEMO__.setLatency(600))`.
 *
 * Nothing here runs in the extension: it is imported only by
 * `scenes.stories.tsx`.
 */
import { orgSnapshotStore } from '../../shared/snapshot/orgSnapshotStore';
import { SHARD_KEY_SEPARATOR } from '../../shared/snapshot/types';
import { DEMO_ORIGIN } from './org';
import { DEMO_GROUP_COUNT, currentGroups, demoAppGroups, demoApps, demoRules } from './snapshot';

/**
 * Artificial latency, in milliseconds, applied to every demo read.
 *
 * A real demo needs its loading states to be *visible*: a skeleton that resolves
 * in 3ms never appears on camera. Held as a mutable module-level number rather
 * than baked into the operations, because the facade mock's return value must
 * stay a stable singleton — rebuilding it to change a delay would give every
 * operation a new identity and loop any consumer effect that lists one in a
 * dependency array.
 */
let latencyMs = 450;

/**
 * The control surface the mounted scene installed, if one has.
 *
 * Held so a write can reach `emitSnapshotUpdated` without the story threading it
 * down through the API layer. Only the Storybook layer owns the `chrome` fake
 * that emits it, which is why the handle is injected rather than imported.
 */
let installedControls: DemoControls | null = null;

/** Set the artificial read latency. */
export function setDemoLatency(ms: number): void {
  latencyMs = Math.max(0, ms);
}

/** Await the current artificial latency. Every demo read starts with this. */
export function demoDelay(): Promise<void> {
  return latencyMs === 0 ? Promise.resolve() : new Promise((r) => setTimeout(r, latencyMs));
}

/**
 * Write the whole demo org into the snapshot store, the way a completed
 * background walk would (ADR-0040).
 *
 * Clears the origin first: the store is real IndexedDB and outlives a story the
 * way it outlives a panel session, so a scene that skipped this would inherit
 * whatever the previous scene left behind.
 */
export async function seedDemoSnapshot(): Promise<void> {
  const now = Date.now();
  await orgSnapshotStore.clearOrigin(DEMO_ORIGIN);

  await orgSnapshotStore.upsertMany(
    'groups',
    DEMO_ORIGIN,
    currentGroups().map((entity) => ({ id: entity.id, entity })),
    now,
  );
  await orgSnapshotStore.upsertMany(
    'rules',
    DEMO_ORIGIN,
    demoRules.map((entity) => ({ id: entity.id, entity })),
    now,
  );
  await orgSnapshotStore.upsertMany(
    'apps',
    DEMO_ORIGIN,
    demoApps.map((entity) => ({ id: entity.id, entity })),
    now,
  );
  await orgSnapshotStore.upsertMany(
    'appGroups',
    DEMO_ORIGIN,
    demoAppGroups.map(({ appId, assignment }) => ({
      id: `${appId}${SHARD_KEY_SEPARATOR}${assignment.id}`,
      entity: assignment,
    })),
    now,
  );

  for (const collection of ['groups', 'rules', 'apps', 'appGroups'] as const) {
    await orgSnapshotStore.patchMeta(collection, DEMO_ORIGIN, {
      complete: true,
      lastFullWalkAt: now,
      itemCount:
        collection === 'groups'
          ? DEMO_GROUP_COUNT
          : collection === 'rules'
            ? demoRules.length
            : collection === 'apps'
              ? demoApps.length
              : demoAppGroups.length,
    });
  }
}

/**
 * Seed only *part* of the org, for the beat where rows stream in.
 *
 * @param groupCount - How many groups to write. The meta is left `complete:
 * false`, so the list honestly reports itself as a prefix of the org rather
 * than as the whole of it (ADR-0040 §7).
 */
export async function seedDemoSnapshotPartial(groupCount: number): Promise<void> {
  const now = Date.now();
  await orgSnapshotStore.clearOrigin(DEMO_ORIGIN);
  await orgSnapshotStore.upsertMany(
    'groups',
    DEMO_ORIGIN,
    currentGroups()
      .slice(0, groupCount)
      .map((entity) => ({ id: entity.id, entity })),
    now,
  );
  await orgSnapshotStore.patchMeta('groups', DEMO_ORIGIN, {
    complete: false,
    itemCount: DEMO_GROUP_COUNT,
  });
}

/**
 * Re-publish the group rows after a write, and tell the panel they moved.
 *
 * A profile edit re-derives every rule-fed membership (ADR-0052), which changes
 * headcounts — but the panel does not read `memberships.ts`. It reads the rows
 * `seedDemoSnapshot` wrote into IndexedDB, and those are now stale by exactly
 * the amount the write changed. So the rows are written again and the app's own
 * `snapshotUpdated` broadcast is fired.
 *
 * That second half is the point. The alternative was to reach into the panel and
 * force a re-render, which would prove nothing: the repaint a viewer sees here
 * is the same one a background walk produces against a live org, travelling the
 * same listener in `useOrgSnapshot`. Only the source of the rows differs.
 *
 * Groups alone: rules, apps and app-group assignments cannot change under a
 * profile write, and re-seeding them would spend three IndexedDB round trips to
 * write back what is already there.
 */
export async function republishDemoGroups(): Promise<void> {
  await orgSnapshotStore.upsertMany(
    'groups',
    DEMO_ORIGIN,
    currentGroups().map((entity) => ({ id: entity.id, entity })),
    Date.now(),
  );
  await orgSnapshotStore.patchMeta('groups', DEMO_ORIGIN, {
    complete: true,
    lastFullWalkAt: Date.now(),
    itemCount: DEMO_GROUP_COUNT,
  });
  installedControls?.emitSnapshotUpdated();
}

/** Live progress handles a scene publishes so the script can drive the ActivityBar. */
export interface DemoProgressHandle {
  /** Begin a tracked operation (what puts the bar on screen). */
  start: (operationName: string, message: string, total: number) => void;
  /** Report live batch counts. */
  update: (completed: number, total: number, message?: string) => void;
  /** End the operation and clear the bar. */
  complete: () => void;
}

/** What `globalThis.__OKTA_DEMO__` exposes to the film script. */
export interface DemoControls {
  /** Set the artificial read latency, in milliseconds. */
  setLatency: (ms: number) => void;
  /** Re-seed the full org. */
  seed: () => Promise<void>;
  /** Seed a prefix of the org, leaving it marked incomplete. */
  seedPartial: (groupCount: number) => Promise<void>;
  /** Tell the panel the background wrote new snapshot rows. */
  emitSnapshotUpdated: () => void;
  /** Drive the ActivityBar's progress bar. Present once a scene has mounted. */
  progress?: DemoProgressHandle;
}

/**
 * Publish the control surface.
 *
 * @param emitSnapshotUpdated - Fires the chrome fake's `snapshotUpdated`
 * runtime message; supplied by the story because only the Storybook layer holds
 * the fake.
 */
export function installDemoControls(emitSnapshotUpdated: () => void): DemoControls {
  const controls: DemoControls = {
    setLatency: setDemoLatency,
    seed: seedDemoSnapshot,
    seedPartial: seedDemoSnapshotPartial,
    emitSnapshotUpdated,
  };
  installedControls = controls;
  (globalThis as unknown as { __OKTA_DEMO__?: DemoControls }).__OKTA_DEMO__ = controls;
  return controls;
}
