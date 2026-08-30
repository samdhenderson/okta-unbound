/**
 * @module sidepanel/demo/state
 * @description The demo org's mutable half: profile edits applied on top of the
 * frozen seed.
 *
 * The reel's Users chapter has to end on a fix landing. An admin corrects a
 * mis-typed `department`, and the group rule that reads it then applies. Nothing
 * about that is filmable against a dataset that is built once and never changes,
 * so this module is where the org stops being a constant.
 *
 * ## A patch overlay, not a mutated seed
 *
 * {@link module:sidepanel/demo/users}'s `demoUsers` stays exactly what it was: a
 * deterministic array built once from a seeded PRNG, byte-identical on every run.
 * Writes accumulate here instead, as a map of per-user profile patches, and a
 * reader asks for the merged view.
 *
 * Three things follow from that, and all three are the reason it is a map rather
 * than an in-place edit:
 *
 * - **The seed stays diffable.** A reviewer reading `users.ts` sees the org as
 *   authored, not as some take left it.
 * - **Reset is a `.clear()`**, so a scene that re-mounts between takes is honestly
 *   back where it started rather than approximately so. A demo that carries the
 *   last take's edits into this one produces footage that cannot be reproduced,
 *   and nothing about that looks like an error.
 * - **The untouched path costs nothing.** With no patches applied, the merged
 *   view is the seed array itself, by identity, so every scene that does not
 *   write is exactly as cheap as it was before this module existed.
 *
 * ## The revision counter is the invalidation signal
 *
 * {@link module:sidepanel/demo/memberships} re-derives every rule-fed group when
 * a profile changes, and it needs to know when to bother. A counter is enough:
 * it is monotonic, it is cheap to compare, and it cannot get out of step with the
 * data the way a boolean dirty flag can when two writes land back to back.
 *
 * ## Nothing here ships
 *
 * This module is imported only by the other `demo/` modules and by
 * `scenes.stories.tsx`. Rollup follows the manifest entry graph and nothing there
 * reaches it, so it is not in the extension. It lives under `src` so that tsc,
 * eslint and knip still see it (ADR-0043).
 */
import type { OktaUser } from '../../shared/types';
import { demoUsers } from './users';

/** The subset of a profile a demo write may change. */
export type DemoProfilePatch = Partial<OktaUser['profile']>;

/** Per-user profile patches, keyed by Okta id. Empty until something writes. */
const patches = new Map<string, DemoProfilePatch>();

/** Bumped on every write. See the module note on invalidation. */
let revision = 0;

/** Memoised merged view, rebuilt only when {@link revision} moves. */
let cachedRevision = -1;
let cachedUsers: OktaUser[] = demoUsers;
let cachedById: ReadonlyMap<string, OktaUser> = new Map(demoUsers.map((u) => [u.id, u]));

function rebuild(): void {
  if (cachedRevision === revision) return;
  cachedUsers =
    patches.size === 0
      ? // By identity, not by copy. A scene that never writes must not pay for
        // this module existing.
        demoUsers
      : demoUsers.map((user) => {
          const patch = patches.get(user.id);
          if (!patch) return user;
          return {
            ...user,
            // A real `POST /api/v1/users/{id}` moves this, and the panel shows
            // it. Deliberately the wall clock rather than the dataset's frozen
            // anchor: every other date in this org is anchored so that two takes
            // filmed a week apart agree, but this one is produced by an action
            // the viewer just watched, and freezing it would have the panel
            // report a live edit as having happened a month ago.
            lastUpdated: new Date().toISOString(),
            profile: { ...user.profile, ...patch },
          };
        });
  cachedById = new Map(cachedUsers.map((user) => [user.id, user]));
  cachedRevision = revision;
}

/**
 * How many writes have been applied.
 *
 * Consumers memoise against this rather than against the user array, whose
 * identity is deliberately stable on the untouched path.
 */
export function demoRevision(): number {
  return revision;
}

/**
 * Apply a profile patch, the way a sparse `POST /api/v1/users/{id}` would.
 *
 * Merged onto any patch already held for that user rather than replacing it, so
 * two successive edits to different attributes both survive.
 *
 * @param userId - Okta id of the user being written.
 * @param patch - The attributes to change. Keys absent from it are untouched.
 */
export function applyProfilePatch(userId: string, patch: DemoProfilePatch): void {
  const existing = patches.get(userId);
  patches.set(userId, existing ? { ...existing, ...patch } : { ...patch });
  revision += 1;
}

/**
 * Drop every write, returning the org to its authored state.
 *
 * Called from a scene's `beforeEach` alongside the other resets. A take that
 * inherited the previous take's edits would film an org nobody can reproduce.
 */
export function resetDemoWrites(): void {
  if (patches.size === 0) return;
  patches.clear();
  revision += 1;
}

/** The org's people as they stand now: the seed with every write applied. */
export function currentUsers(): readonly OktaUser[] {
  rebuild();
  return cachedUsers;
}

/** One person as they stand now, or `undefined` if this org has no such id. */
export function currentUserById(userId: string): OktaUser | undefined {
  rebuild();
  return cachedById.get(userId);
}
