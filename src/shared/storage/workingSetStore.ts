/**
 * @module shared/storage/workingSetStore
 * @description The Home tab's working set: the entities you pinned, and the last
 * few you looked at.
 *
 * One `chrome.storage.local` key holding one JSON blob, following
 * {@link module:sidepanel/components/groups/GroupCollections}'s arrangement rather
 * than IndexedDB's. The data is a handful of rows, and it has to repaint when
 * another surface writes it — `chrome.storage.onChanged` gives that for free,
 * where IndexedDB would need a broadcast of its own.
 *
 * ## Scoped by origin, not global
 *
 * Every entry lives under the org it came from. An admin who works across two
 * Okta orgs must never see one org's group names while connected to the other:
 * that is the same rule `orgSnapshotStore.clearOrigin` exists to enforce, and
 * getting it wrong here would be a quieter version of the same leak — a name in a
 * list rather than a whole inventory, but a name from an org the current session
 * is not entitled to.
 *
 * ## What is stored, and what is deliberately not
 *
 * An entry is an id, a display name, an optional pane, and a timestamp. No email,
 * no status, no profile, no member list — `chrome.storage` is plaintext
 * (`docs/security.md`), so the row carries the least that will render it and
 * nothing that would make the file worth reading.
 *
 * `recent` is capped and expires; `pinned` does neither. That asymmetry is
 * deliberate: a recent is a by-product of browsing and ages into noise, while a
 * pin is a decision the reader made and only they should undo it.
 *
 * Every method is fire-and-forget in the house style — failures are logged and
 * never propagate, and a read degrades to an empty set rather than throwing.
 */
import { createLogger } from '../utils/logger';

const log = createLogger('WorkingSetStore');

/** `chrome.storage.local` key under which the whole working set is persisted. */
export const WORKING_SET_STORAGE_KEY = 'okta_unbound_working_set';

/** How many recently-viewed entities are kept per org. */
export const RECENT_LIMIT = 5;

/**
 * How many pins are kept per org.
 *
 * Not a UX opinion — a backstop. Without one, a stuck recorder or a script could
 * grow the file without bound, and this is plaintext storage.
 */
export const PINNED_LIMIT = 20;

/** How long a recently-viewed entry survives without being seen again (14 days). */
export const RECENT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** The entity kinds the working set can hold — the two with a detail rung. */
export type WorkingSetKind = 'group' | 'user';

/** One remembered entity. */
export interface WorkingSetRef {
  /** Which detail rung opens it. */
  kind: WorkingSetKind;
  /** Okta id — the identity of the row. */
  id: string;
  /** Display name, as it read when last seen. */
  name: string;
  /**
   * Which pane the reader was on, when the rung has panes and reported one.
   *
   * Optional on purpose: only two tabs have a view stack at all, and a rung with
   * no panes has nothing true to say here. A row with no pane shows its kind
   * alone rather than inventing a location.
   */
  lastPane?: string;
  /** Epoch millis of the last visit. */
  lastSeenAt: number;
}

/** One org's working set. */
export interface WorkingSet {
  /** Entities the reader chose to keep, newest pin last. Never expires. */
  pinned: WorkingSetRef[];
  /** Entities recently opened, most recent first. Capped and expiring. */
  recent: WorkingSetRef[];
}

/** The persisted file: one working set per org origin. */
interface WorkingSetFile {
  version: 1;
  origins: Record<string, WorkingSet>;
}

/** An empty set, returned whenever an org has nothing or a read fails. */
export const EMPTY_WORKING_SET: WorkingSet = { pinned: [], recent: [] };

/** Whether a stored value is shaped like a usable entry. */
function isRef(value: unknown): value is WorkingSetRef {
  if (!value || typeof value !== 'object') return false;
  const ref = value as Partial<WorkingSetRef>;
  return (
    (ref.kind === 'group' || ref.kind === 'user') &&
    typeof ref.id === 'string' &&
    ref.id.length > 0 &&
    typeof ref.name === 'string' &&
    typeof ref.lastSeenAt === 'number' &&
    (ref.lastPane === undefined || typeof ref.lastPane === 'string')
  );
}

/**
 * Coerce whatever is on disk into a usable file.
 *
 * Storage is written by a previous version of this extension and read by this
 * one, so the shape is untrusted in the same sense an Okta response is: a
 * half-written blob, a hand-edited one, or one from a future schema must degrade
 * to "nothing remembered" rather than crash the tab that reads it.
 *
 * @param raw - The value read from `chrome.storage.local`.
 * @returns A well-formed file; empty when `raw` cannot be trusted.
 */
export function normalizeFile(raw: unknown): WorkingSetFile {
  const empty: WorkingSetFile = { version: 1, origins: {} };
  if (!raw || typeof raw !== 'object') return empty;
  const file = raw as Partial<WorkingSetFile>;
  if (file.version !== 1 || !file.origins || typeof file.origins !== 'object') return empty;

  const origins: Record<string, WorkingSet> = {};
  for (const [origin, set] of Object.entries(file.origins)) {
    if (!set || typeof set !== 'object') continue;
    const { pinned, recent } = set as Partial<WorkingSet>;
    origins[origin] = {
      pinned: Array.isArray(pinned) ? pinned.filter(isRef).slice(0, PINNED_LIMIT) : [],
      recent: Array.isArray(recent) ? recent.filter(isRef).slice(0, RECENT_LIMIT) : [],
    };
  }
  return { version: 1, origins };
}

/** Whether two references point at the same entity. */
const same = (a: { kind: WorkingSetKind; id: string }, b: { kind: WorkingSetKind; id: string }) =>
  a.kind === b.kind && a.id === b.id;

/**
 * Drop recents that have aged out.
 *
 * @param set - The set to prune.
 * @param now - Current epoch millis.
 * @returns The set with expired recents removed. Pins are untouched.
 */
export function prune(set: WorkingSet, now: number): WorkingSet {
  const fresh = set.recent.filter((ref) => now - ref.lastSeenAt < RECENT_TTL_MS);
  return fresh.length === set.recent.length ? set : { ...set, recent: fresh };
}

/**
 * Record a visit.
 *
 * A pinned entity is refreshed **in place** rather than also entering `recent` —
 * it is already on Home, and listing it twice would spend the reader's attention
 * to say one thing.
 *
 * @param set - The current set.
 * @param ref - The entity just seen.
 * @returns A new set with the visit applied.
 */
export function applyTouch(set: WorkingSet, ref: WorkingSetRef): WorkingSet {
  const pinnedIndex = set.pinned.findIndex((entry) => same(entry, ref));
  if (pinnedIndex >= 0) {
    const pinned = [...set.pinned];
    pinned[pinnedIndex] = { ...pinned[pinnedIndex], ...ref };
    return { pinned, recent: set.recent };
  }
  const recent = [ref, ...set.recent.filter((entry) => !same(entry, ref))].slice(0, RECENT_LIMIT);
  return { pinned: set.pinned, recent };
}

/**
 * Pin an entity, moving it out of `recent` if it was there.
 *
 * @param set - The current set.
 * @param ref - The entity to keep.
 * @returns A new set with the pin applied; unchanged when already pinned or at
 * {@link PINNED_LIMIT}.
 */
export function applyPin(set: WorkingSet, ref: WorkingSetRef): WorkingSet {
  if (set.pinned.some((entry) => same(entry, ref))) return set;
  if (set.pinned.length >= PINNED_LIMIT) {
    log.warn('Pin limit reached', { code: 'working_set_pin_limit', limit: PINNED_LIMIT });
    return set;
  }
  return {
    pinned: [...set.pinned, ref],
    recent: set.recent.filter((entry) => !same(entry, ref)),
  };
}

/**
 * Unpin an entity. It does **not** fall back into `recent`: the reader just said
 * they were done with it, and re-listing it one row lower would argue.
 *
 * @param set - The current set.
 * @param ref - Which entity to release.
 * @returns A new set with the pin removed.
 */
export function applyUnpin(set: WorkingSet, ref: { kind: WorkingSetKind; id: string }): WorkingSet {
  return { pinned: set.pinned.filter((entry) => !same(entry, ref)), recent: set.recent };
}

/**
 * `chrome.storage.local`-backed working set. Prefer the {@link workingSetStore}
 * singleton over constructing new instances.
 */
class WorkingSetStore {
  private async readFile(): Promise<WorkingSetFile> {
    try {
      const stored = await chrome.storage.local.get(WORKING_SET_STORAGE_KEY);
      return normalizeFile(stored?.[WORKING_SET_STORAGE_KEY]);
    } catch {
      // Identifiers and outcomes only — an entity name must not reach the log.
      log.error('Failed to read the working set', { code: 'working_set_read_failed' });
      return { version: 1, origins: {} };
    }
  }

  private async writeFile(file: WorkingSetFile): Promise<void> {
    try {
      await chrome.storage.local.set({ [WORKING_SET_STORAGE_KEY]: file });
    } catch {
      log.error('Failed to write the working set', { code: 'working_set_write_failed' });
    }
  }

  /**
   * Read one org's working set, pruning expired recents as a side effect.
   *
   * @param origin - Okta org origin; a blank one reads nothing rather than
   * another org's rows.
   * @param now - Current epoch millis, injected so the expiry is testable.
   * @returns The org's set, or {@link EMPTY_WORKING_SET}.
   */
  async read(origin: string | null | undefined, now = Date.now()): Promise<WorkingSet> {
    if (!origin) return EMPTY_WORKING_SET;
    const file = await this.readFile();
    const set = file.origins[origin];
    if (!set) return EMPTY_WORKING_SET;
    const pruned = prune(set, now);
    if (pruned !== set) {
      // Expiry is enforced on read rather than by a timer: nothing else wakes
      // this module up, and a row the reader can see is a row that was read.
      await this.writeFile({ ...file, origins: { ...file.origins, [origin]: pruned } });
    }
    return pruned;
  }

  /** Apply `mutate` to one org's set and persist the result. */
  private async update(
    origin: string | null | undefined,
    mutate: (set: WorkingSet) => WorkingSet,
    now: number,
  ): Promise<WorkingSet> {
    if (!origin) return EMPTY_WORKING_SET;
    const file = await this.readFile();
    const next = mutate(prune(file.origins[origin] ?? EMPTY_WORKING_SET, now));
    await this.writeFile({ ...file, origins: { ...file.origins, [origin]: next } });
    return next;
  }

  /**
   * Record that an entity was opened.
   *
   * @param origin - Okta org origin.
   * @param ref - The entity just seen, minus its timestamp.
   * @param now - Current epoch millis.
   * @returns The org's updated set.
   */
  async touch(
    origin: string | null | undefined,
    ref: Omit<WorkingSetRef, 'lastSeenAt'>,
    now = Date.now(),
  ): Promise<WorkingSet> {
    return this.update(origin, (set) => applyTouch(set, { ...ref, lastSeenAt: now }), now);
  }

  /**
   * Pin or unpin an entity, whichever it is not already.
   *
   * @param origin - Okta org origin.
   * @param ref - The entity to toggle, minus its timestamp.
   * @param now - Current epoch millis.
   * @returns The org's updated set.
   */
  async togglePin(
    origin: string | null | undefined,
    ref: Omit<WorkingSetRef, 'lastSeenAt'>,
    now = Date.now(),
  ): Promise<WorkingSet> {
    return this.update(
      origin,
      (set) =>
        set.pinned.some((entry) => same(entry, ref))
          ? applyUnpin(set, ref)
          : applyPin(set, { ...ref, lastSeenAt: now }),
      now,
    );
  }

  /**
   * Forget an entity entirely, pinned or recent.
   *
   * @param origin - Okta org origin.
   * @param ref - Which entity to drop.
   * @returns The org's updated set.
   */
  async forget(
    origin: string | null | undefined,
    ref: { kind: WorkingSetKind; id: string },
    now = Date.now(),
  ): Promise<WorkingSet> {
    return this.update(
      origin,
      (set) => ({
        pinned: set.pinned.filter((entry) => !same(entry, ref)),
        recent: set.recent.filter((entry) => !same(entry, ref)),
      }),
      now,
    );
  }

  /**
   * Drop everything remembered for one org.
   *
   * @param origin - Okta org origin to forget.
   */
  async clearOrigin(origin: string): Promise<void> {
    const file = await this.readFile();
    if (!(origin in file.origins)) return;
    const origins = { ...file.origins };
    delete origins[origin];
    await this.writeFile({ ...file, origins });
    log.info('Cleared the working set for one origin', { code: 'working_set_cleared' });
  }

  /**
   * Subscribe to writes from any surface — including another panel instance.
   *
   * @param listener - Called with the whole file whenever the key changes.
   * @returns An unsubscribe function.
   */
  subscribe(listener: (file: WorkingSetFile) => void): () => void {
    const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !(WORKING_SET_STORAGE_KEY in changes)) return;
      listener(normalizeFile(changes[WORKING_SET_STORAGE_KEY]?.newValue));
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }

  /**
   * Read one org's set out of a broadcast file, so a subscriber does not have to
   * re-read storage to answer a change it was just handed.
   *
   * @param file - The file from {@link WorkingSetStore.subscribe}.
   * @param origin - Okta org origin.
   * @returns That org's set.
   */
  select(file: { origins: Record<string, WorkingSet> }, origin: string | null | undefined) {
    return (origin && file.origins[origin]) || EMPTY_WORKING_SET;
  }
}

/** Shared singleton. */
export const workingSetStore = new WorkingSetStore();
