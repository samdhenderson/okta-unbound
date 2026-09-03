/**
 * @module shared/snapshot/parseVersion
 * @description Whether a stored collection was written by the walk this build
 * ships (ADR-0066).
 *
 * A {@link CollectionSpec} describes **what the walk asks Okta for and what it
 * does with the answer**: the first-page URL and its `expand`s, the parameters
 * re-applied across pages, which shards a fan-out visits, and how a row's
 * storage key and watermark are derived. Change any of those and the rows
 * already in the snapshot were written under a different question — no mapper,
 * component or export descriptor can repair them, because the bytes were never
 * fetched.
 *
 * So each spec carries a `parseVersion`, the snapshot records the version each
 * `(origin, collection)` was last completely walked at, and a mismatch makes the
 * next sync attempt for that collection a full walk, once. This module holds the
 * two pure halves of that: reading the stored version honestly, and
 * fingerprinting a spec so a wire change that forgets its bump fails a lock test
 * instead of silently stranding every already-synced org.
 *
 * **This is not `DB_VERSION`.** `DB_VERSION` describes object stores, key paths
 * and indexes; it moves through an IndexedDB upgrade transaction, applies to
 * every origin at once, and can never be un-bumped. `parseVersion` is an
 * ordinary field on an ordinary record, scoped to one `(origin, collection)`
 * pair, freely renumbered, and costs one opportunistic walk of one collection.
 * `DB_VERSION` must **not** move for a content change (ADR-0066 §2).
 *
 * @see {@link module:shared/snapshot/snapshotSync} for the specs and the branch
 * that acts on a mismatch.
 */

import { z } from 'zod';
import type { SnapshotCollection, SyncMeta } from './types';

/**
 * A stored `parseVersion`, validated rather than trusted.
 *
 * IndexedDB is plaintext and locally modifiable (`docs/security.md`), and the
 * same defensive posture ADR-0006 applies to Okta responses applies to anything
 * read back off disk. A non-integer, negative or otherwise nonsensical value is
 * treated as **absent** rather than as a version, because "I cannot read this"
 * and "this was written before versions existed" have the same correct remedy:
 * walk the collection again.
 */
const storedParseVersionSchema = z.number().int().nonnegative();

/**
 * The version a collection's stored rows were last completely walked at.
 *
 * **`null` means "not knowable", and is deliberately treated as a mismatch.**
 * Two populations read `null`, and one walk each is the right answer for both:
 *
 * - An org that has never synced this collection. It was going to cold-walk
 *   anyway, so the mismatch costs nothing.
 * - An org holding rows written before ADR-0066 landed. Version 0 is not
 *   knowable retroactively — the field simply was not written — so those rows
 *   get exactly one upgrade walk per collection, on the release that adopts
 *   this. One walk once is not the eager failure mode; the eager failure mode is
 *   one walk per release, forever (ADR-0066 §5).
 *
 * Because the field is genuinely absent on records already in the field, it is
 * optional on {@link SyncMeta} and `undefined` collapses to `null` here — one
 * meaning, read in one place, rather than every call site remembering that two
 * spellings of "no version" exist.
 *
 * @param meta - The collection's stored bookkeeping.
 * @returns The recorded version, or `null` when it is absent or unreadable.
 */
export function readParseVersion(meta: SyncMeta): number | null {
  const parsed = storedParseVersionSchema.safeParse(meta.parseVersion);
  return parsed.success ? parsed.data : null;
}

/**
 * The minimum a spec must expose to be versioned and fingerprinted.
 *
 * Declared structurally rather than by importing `CollectionSpec`, so this
 * module stays a leaf that `snapshotSync` depends on and not the other half of
 * an import cycle.
 */
export interface VersionedSpec {
  /** Which snapshot collection the rows land in. */
  collection: SnapshotCollection;
  /**
   * What this build's walk asks for and stores.
   *
   * Bump it when the **request** or the **write-time transform** changes: a new
   * `expand=`, a different shard selection or shard-key grammar, a change to
   * `identify`, a move to another endpoint, or a schema that starts narrowing
   * instead of passing through.
   *
   * Do **not** bump it for a read-side change. The list schemas are
   * `.passthrough()` and the store persists the parsed row, so a mapper that
   * learns to read a field Okta was already sending lights up existing rows
   * immediately — a bump there would re-walk the org to buy nothing
   * (ADR-0066 §_Context_).
   */
  parseVersion: number;
  /** Canonical first-page URL, including `limit` and any `expand`. */
  firstUrl: string;
  /** Query parameters re-applied across pages. */
  preserveParams?: string[];
  /** Present only on a sharded collection. */
  shards?: (...args: never[]) => unknown;
  /** Present when the storage key is composed rather than copied from `row.id`. */
  identify?: (...args: never[]) => unknown;
}

/**
 * Does this collection's snapshot need re-walking because the walk changed?
 *
 * A mismatch **outranks every cheap mode**, and it has to. A delta only rewrites
 * rows Okta reports as changed, so it can never repair a row that is merely
 * old-shaped; and the drift check is worse than useless here, because counts
 * agree perfectly across a field addition and it would return `in-sync` and
 * license the delta. Either would leave the gap permanent while every subsequent
 * check reported agreement (ADR-0066 §4).
 *
 * The remedy is a re-walk, never a delete: the stored rows keep being served
 * while the walk runs in the background, because dropping them would turn every
 * field addition into a cold load — precisely the regression ADR-0040 exists to
 * prevent. During that window an absent field renders as unknown ("Not reported
 * by Okta"), never as zero and never as never (ADR-0066 §3).
 *
 * @param spec - The collection as this build walks it.
 * @param meta - What the snapshot recorded for it.
 * @returns `true` when the stored rows predate the current walk.
 */
export function isParseVersionStale(spec: VersionedSpec, meta: SyncMeta): boolean {
  return readParseVersion(meta) !== spec.parseVersion;
}

/**
 * Everything about a spec that decides what ends up stored, reduced to
 * comparable values.
 *
 * Read-side code — mappers, components, export descriptors — is deliberately
 * **not** here, because those changes are retroactive against passthrough rows
 * and versioning them would buy a re-walk for nothing.
 */
export interface SpecFingerprint {
  /** The declared version, so the fixture pins version and shape together. */
  parseVersion: number;
  /** The URL the walk starts from, `expand`s included. */
  firstUrl: string;
  /** Preserved parameters, sorted so a reordering is not a false positive. */
  preserveParams: string[];
  /** The shard provider's function name, or `null` for a single-URL collection. */
  shardProvider: string | null;
  /** A hash of `identify`'s source, or `null` when the spec uses the default. */
  identifyHash: string | null;
}

/**
 * FNV-1a, 32-bit, hex.
 *
 * A hash rather than the source itself so the lock fixture stays one short line
 * per collection instead of an embedded copy of a function that would then need
 * keeping in sync by hand. Not a security primitive and not used as one — it
 * guards against accident, not against an adversary.
 *
 * @param input - Text to hash.
 * @returns Eight lowercase hex digits.
 */
function hashSource(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Reduce a spec to the shape a lock test can pin.
 *
 * A convention that relies on memory is a convention that fails, and this one
 * fails silently and per-org: forget the bump and every already-synced org keeps
 * serving rows written under the old question, discovered months later by
 * someone who assumes Okta does not expose the field. So the bump is enforced by
 * a fixture rather than by a review habit — change the wire without changing
 * `parseVersion` and the test fails, naming the collection (ADR-0066 §5).
 *
 * The fixture is a little brittle by design: reformatting `identify` moves its
 * hash. A false positive costs one line and one deliberate look at whether
 * stored rows are affected, which is much cheaper than the silent gap.
 *
 * **Known blind spot.** This watches the spec. A change to shared walk machinery
 * outside any spec — `fetchAllPages`, `parseOktaList`'s leniency — can still
 * alter what gets stored without tripping it (ADR-0066 §_Consequences_).
 *
 * @param spec - The collection to fingerprint.
 * @returns Its comparable shape.
 */
export function fingerprintSpec(spec: VersionedSpec): SpecFingerprint {
  return {
    parseVersion: spec.parseVersion,
    firstUrl: spec.firstUrl,
    preserveParams: [...(spec.preserveParams ?? [])].sort(),
    shardProvider: spec.shards ? (spec.shards.name ?? '') : null,
    identifyHash: spec.identify ? hashSource(spec.identify.toString()) : null,
  };
}
