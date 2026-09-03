/**
 * @module sidepanel/components/home/orgFigures
 * @description Turns org-snapshot reads into the findings the Home tab's
 * snapshot card lists — and, more importantly, decides which of their numbers
 * may be shown at all.
 *
 * The card leads with what is worth acting on and demotes the totals to a
 * caption. `214 groups` is trivia; `31 groups with no members` is a morning's
 * work. Each finding carries the filtered list it opens (see
 * {@link module:sidepanel/listViewRequest}) so a figure and its destination
 * cannot drift apart, and each one is phrased as a sentence rather than a
 * fragment, so the row still reads when its number is an em dash.
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
 * ## The 403 copy
 *
 * The design handoff specifies a literal 403 message, and that is now earned:
 * `RequestResult.status` survives `createSchedulerPageRequest` into
 * {@link module:shared/utils/oktaPagination}'s `PaginatedFetchError`, and from
 * there into `WalkOutcome.status` (D-068). `unavailableNote` reads it and
 * names the permission specifically rather than only saying a read failed —
 * still never inventing a number, per the zero trap above, just naming the
 * reason more precisely when the reason is known. Every other status (429, a
 * dropped connection, `undefined`) keeps the generic copy: only 401/403 read
 * as "you are not allowed to", because every other failure could just as
 * easily be transient.
 */
import { pluralize, singularOf, type NounForms } from '../../../shared/utils/plural';
import type { IconType } from '../shared/Icon';
import type { ListViewRequest, ListViewTab } from '../../listViewRequest';

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
  /**
   * HTTP status of the last failed sync, or `null`/`undefined` when there is
   * no failure or the failure carried no status (`WalkOutcome.status`,
   * D-068). Only 401/403 change the copy `unavailableNote` shows; every other
   * value reads the same as no status at all.
   */
  status?: number | null;
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

/**
 * `true` for the two statuses that mean "the credential behind this read is
 * not allowed to see this collection" — never a broader range: a 429 or a
 * dropped connection is not evidence of a permissions problem, and reporting
 * one as such would be a stronger, and wrong, claim to an admin.
 */
function isPermissionDenied(status: number | null | undefined): boolean {
  return status === 401 || status === 403;
}

/** The sentence shown instead of a number, for a figure that has none. */
function unavailableNote(
  label: string,
  error: string | null | undefined,
  status?: number | null,
): string {
  if (isPermissionDenied(status)) {
    return `You are not allowed to read ${label.toLowerCase()}.`;
  }
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
 * @param count - The figure's number, which is not always `source.count` — a
 * finding counts a subset of the collection it reads.
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
          ? unavailableNote(label, source.error, source.status)
          : undefined,
  };
}

/**
 * A collection, paired with the plural noun the card calls it by.
 *
 * The noun lives here rather than being derived from a title because it appears
 * inside sentences — *of 214 groups*, *Needs group rules, which have not been
 * read* — and a lowercased title is not reliably the right word in one.
 */
export interface NamedSource {
  /** The snapshot read. */
  source: FigureSource;
  /** Plural, lowercase: `groups`, `applications`, `group rules`. */
  noun: string;
  /**
   * The singular, for the one sentence that takes a count — *of 1
   * application*. Optional: it is derived from {@link NamedSource.noun} with
   * {@link module:shared/utils/plural.singularOf} when absent, which is right
   * for every regular plural the snapshot names. State it only for a noun that
   * derivation would mangle.
   */
  singular?: string;
}

/**
 * One finding: an actionable count, and the filtered list it opens.
 *
 * A finding with no `value` renders as text rather than as a control.
 * ADR-0039's "no verb without a wire" applies to a link into a list that cannot
 * be trusted just as much as to a button with no handler.
 */
export interface OrgSubCount {
  /** Stable key, for React and for tests. */
  key: string;
  /**
   * The finding, as a sentence you could act on — *Groups with no members*, not
   * *empty*. A fragment only parses beside its number; a sentence still reads
   * when the number is an em dash.
   */
  label: string;
  /**
   * The glyph that leads the row, from the shared registry.
   *
   * It leads rather than trails because the row inverted — the number moved to
   * the trailing edge — and the 20px glyph plus its 12px gap is the same lead
   * `WorkingSetRow` uses, so the entity rows above the card and the findings on
   * it read as one column rather than two lists that happen to be adjacent.
   */
  icon: IconType;
  /** See {@link subCountStatus}. */
  status: OrgFigureStatus;
  /** The count, or `null` when nothing behind it can support one. */
  value: number | null;
  /**
   * The line under the finding: what the count is out of when there is one
   * (`of 214 groups`), and why there is not when there is not.
   */
  note?: string;
  /** The filtered list this finding opens. */
  request: ListViewRequest;
}

/** One collection: its total, the tab it opens, and the findings drawn from it. */
export interface OrgBox extends OrgFigure {
  /** The tab the total opens, unfiltered. */
  tab: ListViewTab;
  /** Plural, lowercase — how the totals caption names this collection. */
  noun: string;
  /** The findings drawn from it. May be empty. */
  subCounts: OrgSubCount[];
}

/**
 * Classify a count from the collections behind it.
 *
 * Three roles, and the asymmetry between them is the whole rule — the same one
 * `useOrgEntityIndex` applies to a jump-bar miss: **a positive reading survives
 * an unfinished walk; a negative one does not.**
 *
 * - `counted` may be `partial`. "31 groups with no members" out of an
 *   interrupted group walk is a floor — the pages that never arrived can only
 *   add more — and the card says "at least".
 * - `floors` are read the same way, positively, but are a *second* collection
 *   contributing rows. An incomplete one shrinks the answer without corrupting
 *   it, so it degrades the count to a floor exactly as `counted` does. The
 *   reports need this and the findings do not: "app access no rule maintains"
 *   draws its population from the app-group assignments, where every finding on
 *   the org card counts one collection and subtracts from others.
 * - `gates` may not be anything but `ok`. "Groups no rule fills" is computed by
 *   subtracting the groups some rule targets, so a rule list missing half its
 *   pages does not under-report; it reports every group those missing rules fed
 *   as unfilled. That is not a floor with a caveat, it is a wrong number, and
 *   there is no honest way to label it. So a gate that is anything but `ok`
 *   suppresses the count entirely.
 *
 * @param counted - The collection the rows are counted from.
 * @param gates - Collections consulted to exclude rows. Usually empty.
 * @param floors - Further collections read positively. Usually empty.
 * @returns The count's status.
 */
export function subCountStatus(
  counted: FigureSource,
  gates: FigureSource[],
  floors: FigureSource[] = [],
): OrgFigureStatus {
  const positives = [counted, ...floors].map(figureStatus);
  const negatives = gates.map(figureStatus);
  if ([...positives, ...negatives].some((status) => status === 'reading')) return 'reading';
  if (negatives.some((status) => status !== 'ok')) return 'unavailable';
  if (positives.some((status) => status === 'unavailable')) return 'unavailable';
  return positives.some((status) => status === 'partial') ? 'partial' : 'ok';
}

/** What a count resolved to, and the line that explains it. */
export interface CountResolution {
  /** See {@link subCountStatus}. */
  status: OrgFigureStatus;
  /** The number, or `null` when nothing behind it can support one. */
  value: number | null;
  /** What the number is out of when there is one, and why there is not when there is not. */
  note?: string;
}

/** The collections behind one count, and the number they produced. */
export interface CountInput {
  /** The collection the rows are counted from. */
  counted: NamedSource;
  /**
   * Collections consulted to *exclude* rows; see {@link subCountStatus} for why
   * these are held to a stricter bar. Usually empty.
   */
  gates?: NamedSource[];
  /** Further collections read positively. Usually empty. */
  floors?: NamedSource[];
  /** The number, used only when the status supports one. */
  count: number;
}

/** Both forms of a named collection's noun, deriving the singular when unstated. */
function nounForms(named: NamedSource): NounForms {
  return { one: named.singular ?? singularOf(named.noun), other: named.noun };
}

/**
 * The line under a count: what the number is out of, or why there is none.
 *
 * The unavailable branch names the collection that is missing, and which one it
 * is matters — "needs group rules" points somewhere different from "groups have
 * not been read". A bare "not read" would leave a reader guessing between them.
 */
function countNote(
  status: OrgFigureStatus,
  counted: NamedSource,
  gates: NamedSource[],
  floors: NamedSource[],
): string | undefined {
  if (status === 'reading') return undefined;
  // The only branch whose noun follows a count, and so the only one that
  // pluralises. The other three are plural regardless of any number — they
  // speak about the collection ("Needs group rules, which have not been read"),
  // and singularising them would produce a sentence that does not agree.
  if (status === 'ok') return `of ${pluralize(counted.source.count, nounForms(counted))}`;
  if (status === 'partial') {
    // Name the collection that actually fell short, which with a floor in play
    // is not always the one being counted.
    const short = [counted, ...floors].find((source) => figureStatus(source.source) !== 'ok');
    return `At least — the last read of ${(short ?? counted).noun} did not finish.`;
  }

  const blocking = [...gates, ...floors].find((source) => figureStatus(source.source) !== 'ok');
  return blocking
    ? `Needs ${blocking.noun}, which have not been read.`
    : `${counted.noun[0].toUpperCase()}${counted.noun.slice(1)} have not been read yet.`;
}

/**
 * Resolve one count against the collections behind it.
 *
 * The shared core of a finding on the org card and a report row, so the two
 * surfaces cannot end up applying the honesty rules differently.
 *
 * @param input - See {@link CountInput}.
 * @returns See {@link CountResolution}.
 */
export function resolveCount({
  counted,
  gates = [],
  floors = [],
  count,
}: CountInput): CountResolution {
  const status = subCountStatus(
    counted.source,
    gates.map((gate) => gate.source),
    floors.map((floor) => floor.source),
  );
  const hasValue = status === 'ok' || status === 'partial';
  return {
    status,
    value: hasValue ? count : null,
    note: countNote(status, counted, gates, floors),
  };
}

/** Everything one finding row needs to be built. */
export interface SubCountInput extends CountInput {
  /** Stable key. */
  key: string;
  /** The finding, as a sentence. */
  label: string;
  /** The glyph that leads the row. See {@link OrgSubCount.icon}. */
  icon: IconType;
  /** The filtered list this finding opens. */
  request: ListViewRequest;
}

/**
 * Build one finding row.
 *
 * @param input - See {@link SubCountInput}.
 * @returns The finding descriptor.
 */
export function buildSubCount({
  key,
  label,
  icon,
  request,
  ...counts
}: SubCountInput): OrgSubCount {
  return { key, label, icon, ...resolveCount(counts), request };
}

/**
 * Attach a tab, a noun and findings to a collection's total.
 *
 * @param figure - The total, from {@link buildFigure}.
 * @param tab - The tab the total opens.
 * @param noun - Plural, lowercase.
 * @param subCounts - The findings drawn from this collection.
 * @returns The box descriptor.
 */
export function buildBox(
  figure: OrgFigure,
  tab: ListViewTab,
  noun: string,
  subCounts: OrgSubCount[],
): OrgBox {
  return { ...figure, tab, noun, subCounts };
}

/**
 * The freshest fact the card can state about its own age: the **oldest**
 * finished walk across the collections it shows.
 *
 * Oldest rather than newest on purpose — the card presents one stamp for every
 * figure on it, and quoting the newest would date the whole card by its most
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
