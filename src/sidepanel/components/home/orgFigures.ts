/**
 * @module sidepanel/components/home/orgFigures
 * @description Turns three org-snapshot reads into the four figures the Home
 * tab's snapshot card shows — and, more importantly, decides which of them may
 * be shown as a number at all.
 *
 * React-free and pure, because the rules here are the deliverable and they are
 * worth testing without rendering anything.
 *
 * ## The zero trap
 *
 * `rows.length === 0` is ambiguous in three ways at once. It means *this org has
 * no groups*, *the snapshot has not been read yet*, **and** *the IndexedDB read
 * failed* — `orgSnapshotStore.countCollection` returns `0` on failure by design,
 * and `useOrgSnapshot` blanks its rows on every org change. Rendering that as
 * "0 groups" would show a healthy org an empty inventory, which is the single
 * worst thing this card could do.
 *
 * So a figure is a **number** only when its collection's last walk actually
 * finished. Everything else is a state with its own copy:
 *
 * | Condition | Status | What the reader sees |
 * | --- | --- | --- |
 * | first read in flight | `reading` | a skeleton, never a `0` |
 * | walk finished | `ok` | the count |
 * | rows present, walk unfinished | `partial` | the count, marked as a floor |
 * | never walked | `unavailable` | a plain sentence saying so |
 *
 * `partial` exists because ADR-0040 §7 forbids serving an interrupted walk as
 * complete, and hiding those rows entirely would be the opposite error — they
 * are real rows, they are just not all of them.
 *
 * ## Why the failure copy is generic
 *
 * The design handoff specifies a literal 403 message. That cannot be earned
 * today: `RequestResult.status` exists on the scheduler but
 * `createSchedulerPageRequest` drops it, `WalkOutcome` carries no status field,
 * and the background collapses all four collections into one `{success, error}`.
 * Claiming a permission problem on what may have been a dropped connection is
 * the same class of lie the omit-not-zero rule exists to prevent, so the copy
 * says only what is known.
 */
import type { IconType } from '../shared/Icon';

/** What is known about one figure. See the table in the module header. */
export type OrgFigureStatus = 'reading' | 'ok' | 'partial' | 'unavailable';

/** The subset of a snapshot read this module needs. */
export interface FigureSource {
  /** `true` until the first IndexedDB read for the current org resolves. */
  isReading: boolean;
  /** Whether the last walk for this collection finished (ADR-0040 §7). */
  complete: boolean;
  /** Epoch millis of the last completed full walk, or `null` when never. */
  lastFullWalkAt: number | null;
  /** How many rows are stored. */
  count: number;
  /** Message from the last failed sync, or `null`. */
  error?: string | null;
}

/** One rendered figure. */
export interface OrgFigure {
  /** Stable key, for React and for tests. */
  key: string;
  /** Card title. */
  label: string;
  /** Glyph from the shared registry. */
  icon: IconType;
  /** See {@link OrgFigureStatus}. */
  status: OrgFigureStatus;
  /**
   * The count — `null` unless the status is `ok` or `partial`.
   *
   * Never `0` as a stand-in for "unknown": that conflation is the whole reason
   * this module exists.
   */
  value: number | null;
  /** A line under the value, when the status needs one. */
  note?: string;
}

/**
 * Classify one collection.
 *
 * @param source - What the snapshot read reports.
 * @returns Which of the four states this figure is in.
 */
export function figureStatus(source: FigureSource): OrgFigureStatus {
  if (source.isReading) return 'reading';
  if (source.complete && source.lastFullWalkAt !== null) return 'ok';
  // Rows with no finished walk behind them are a floor, not a total. With no
  // rows either, nothing has ever been read and there is no number to caveat.
  return source.count > 0 ? 'partial' : 'unavailable';
}

/** The sentence shown instead of a number, for a figure that has none. */
function unavailableNote(label: string, error: string | null | undefined): string {
  return error
    ? `The last read of ${label.toLowerCase()} did not finish.`
    : `${label} have not been read yet.`;
}

/**
 * Build one figure from one collection.
 *
 * @param key - Stable key.
 * @param label - Card title, also used in the failure sentence.
 * @param icon - Glyph.
 * @param source - What the snapshot read reports.
 * @param count - The figure's number, which is not always `source.count` — the
 * paused-rules figure counts a subset of the same collection.
 * @returns The figure descriptor.
 */
export function buildFigure(
  key: string,
  label: string,
  icon: IconType,
  source: FigureSource,
  count = source.count,
): OrgFigure {
  const status = figureStatus(source);
  return {
    key,
    label,
    icon,
    status,
    value: status === 'ok' || status === 'partial' ? count : null,
    note:
      status === 'partial'
        ? 'At least — the last read did not finish.'
        : status === 'unavailable'
          ? unavailableNote(label, source.error)
          : undefined,
  };
}

/**
 * The freshest fact the card can state about its own age: the **oldest**
 * finished walk across the collections it shows.
 *
 * Oldest rather than newest on purpose — the card presents one stamp for four
 * figures, and quoting the newest would date the whole card by its most
 * recently refreshed corner.
 *
 * @param sources - The collections the card is showing.
 * @returns Epoch millis, or `null` when any of them has never finished a walk.
 */
export function oldestWalkAt(sources: FigureSource[]): number | null {
  const stamps = sources.map((source) => source.lastFullWalkAt);
  if (stamps.some((stamp) => stamp === null)) return null;
  return Math.min(...(stamps as number[]));
}
