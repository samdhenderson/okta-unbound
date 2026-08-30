/**
 * @module sidepanel/hooks/useJumpResolver
 * @description The Home tab's jump bar: resolves an Okta id, or searches names
 * and emails.
 *
 * The distinction in that sentence is the whole hook. An admin arriving at the
 * panel usually already has an id — it is in the URL they came from, in a
 * ticket, in a log line — and a name search cannot match one. So a well-formed
 * id takes a different path from a name, and the two have different costs, which
 * the UI states rather than averaging.
 *
 * ## What costs a request, and when
 *
 * | Input | Before Enter | On Enter |
 * | --- | --- | --- |
 * | A well-formed id | **nothing** | one local lookup; a request only on a miss |
 * | 3+ characters of a name | one debounced search | re-runs it immediately |
 * | 0–2 characters | **nothing** | nothing |
 *
 * An id issues no request while it is being typed because there is nothing to
 * search *for*: every intermediate prefix of an id matches nothing, so a
 * debounced search over one would spend a request per keystroke to return
 * nothing. The three-character floor exists for the same reason — `a` matches
 * most of the org and tells the reader nothing.
 *
 * ## Snapshot first
 *
 * Groups, rules and apps are already in the local org snapshot (ADR-0040), so
 * resolving those ids costs **zero requests**. Users are deliberately not stored
 * (ADR-0040 §5), so a user id always costs one. The footnote reports whichever
 * actually happened rather than a fixed claim — see {@link JumpResolution.cost}.
 *
 * ## The fan-out follows reachability
 *
 * A name search queries exactly the entity kinds this build can navigate to
 * (`NavigationContext.canNavigateTo`). That is not a request-count optimisation
 * so much as a correctness one: it makes it impossible to render a result row
 * that does nothing when pressed. An id the reader pasted is always resolved,
 * reachable or not — they asked for that exact thing, and an unreachable one
 * still gets an "Open in Okta" route.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { oktaIdKind, type OktaIdKind } from '../../shared/utils/oktaId';
import { useDebouncedValue } from './useDebouncedValue';
import { createLogger } from '../../shared/utils/logger';
import type { OrgEntityIndex } from './useOrgEntityIndex';

const log = createLogger('useJumpResolver');

/**
 * Shortest query that may reach Okta.
 *
 * Three, not the two the Users tab's own search uses. Home's bar is the panel's
 * front door and fans out over several endpoints at once, so a two-character
 * query is both more expensive here and less useful — it matches too much of the
 * org to be an answer. Named so the two surfaces can be aligned in one edit if
 * that is ever wanted.
 */
export const JUMP_SEARCH_MIN_CHARS = 3;

/**
 * How long typing must pause before a search is issued.
 *
 * 600ms, the same window the Users tab's search uses. It was 300ms — chosen on
 * the theory that the panel's front door should feel quicker than a list tab —
 * and that reasoning had the sign backwards. Home fans out over several
 * endpoints per settle and replaces the whole result list with what comes back,
 * so a window short enough to fit *between* two keystrokes turns ordinary typing
 * into a search per character: the list re-resolves under the reader mid-word,
 * over and over. A shorter debounce did not make the surface feel faster, it
 * made it feel unstable. 600 is long enough that a word is typed before anything
 * is spent, and Enter still bypasses it for a reader who is already done.
 */
export const JUMP_SEARCH_DEBOUNCE_MS = 600;

/** What the jump bar is currently doing. */
export type JumpMode = 'idle' | 'searching' | 'resolving' | 'results' | 'error';

/** One row in the jump bar's result list. */
export interface JumpResult {
  /** Which kind of entity, deciding the glyph and the destination tab. */
  kind: OktaIdKind;
  /** The Okta id, and the row's React key. */
  id: string;
  /** Primary line. */
  name: string;
  /** Secondary line — a status, a description, a login. */
  secondary?: string;
}

/** How an id resolution was paid for, so the footnote can say so honestly. */
export interface JumpResolution {
  /** Requests actually issued: `0` from the local snapshot, `1` from Okta. */
  cost: 0 | 1;
}

/** What {@link useJumpResolver} exposes. */
export interface UseJumpResolverResult {
  /** The raw input value. */
  query: string;
  /** Controlled setter for the input. */
  setQuery: (value: string) => void;
  /** Current state of the bar. */
  mode: JumpMode;
  /** Rows to render; empty unless `mode === 'results'`. */
  results: JumpResult[];
  /** Failure message, or `null`. */
  error: string | null;
  /**
   * Whether the current input is a well-formed id. The UI uses this to explain
   * that Enter will resolve it, and to suppress the "no results" state for an
   * id that has not been submitted yet.
   */
  isIdQuery: boolean;
  /** How the last id resolution was paid for, or `null` if none has run. */
  resolution: JumpResolution | null;
  /** Resolve an id, or run the name search immediately. Bound to Enter. */
  submit: () => void;
  /** Reset to the resting state. */
  clear: () => void;
}

/** Options for {@link useJumpResolver}. */
export interface UseJumpResolverOptions {
  /**
   * Local org snapshot index — the zero-request half of resolution.
   *
   * Like `fetchers`, read only from `submit`, so it needs no memoization.
   */
  index: OrgEntityIndex;
  /**
   * Search one kind by name. Omit a kind to exclude it from the fan-out.
   *
   * **Must be referentially stable** (`useMemo`). The debounced search effect
   * depends on it, so a fresh object literal on every render would re-issue the
   * search on every render — a request per keystroke of the *host*, not of the
   * input. Deliberately not hidden behind a ref: `react-hooks/refs` rejects
   * writing an object into a ref during render, and a silent staleness bug is a
   * worse trade than an explicit contract with one call site.
   */
  searchers: Partial<Record<OktaIdKind, (query: string) => Promise<JumpResult[]>>>;
  /**
   * Fetch one entity by id from Okta, for a local miss.
   *
   * Needs no stability guarantee — it is only ever reached from `submit`, an
   * event handler, so its identity churning between renders costs nothing.
   */
  fetchers: Partial<Record<OktaIdKind, (id: string) => Promise<JumpResult | null>>>;
  /**
   * Whether the tab hosting this bar is on screen. A hidden tab issues no
   * search (ADR-0018); typing is still recorded, so returning to the tab keeps
   * the query.
   */
  enabled?: boolean;
}

/**
 * Drive the Home tab's jump bar.
 *
 * @param options - See {@link UseJumpResolverOptions}.
 * @returns See {@link UseJumpResolverResult}.
 */
export function useJumpResolver({
  index,
  searchers,
  fetchers,
  enabled = true,
}: UseJumpResolverOptions): UseJumpResolverResult {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<JumpMode>('idle');
  const [results, setResults] = useState<JumpResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolution, setResolution] = useState<JumpResolution | null>(null);

  const trimmed = query.trim();
  const idKind = useMemo(() => oktaIdKind(trimmed), [trimmed]);
  const isIdQuery = idKind !== null;

  const debounced = useDebouncedValue(trimmed, JUMP_SEARCH_DEBOUNCE_MS);

  // Guards every async settle against a newer query having started. Without it a
  // slow search for "eng" can land after a fast one for "engineering" and
  // replace the better answer with the worse one.
  const runIdRef = useRef(0);

  const runSearch = useCallback(
    async (needle: string) => {
      const runId = ++runIdRef.current;
      setMode('searching');
      setError(null);
      setResolution(null);

      // Only the kinds the caller supplied a searcher for — which is how the
      // fan-out stays tied to what this build can actually navigate to.
      const kinds = Object.keys(searchers) as OktaIdKind[];
      const settled = await Promise.allSettled(
        kinds.map((kind) => searchers[kind]?.(needle) ?? Promise.resolve([])),
      );
      if (runId !== runIdRef.current) return;

      const rows: JumpResult[] = [];
      let failures = 0;
      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') rows.push(...outcome.value);
        else failures += 1;
      }

      if (failures === kinds.length && kinds.length > 0) {
        // Every leg failed: there is no partial answer to show, so say so rather
        // than rendering an empty list that reads as "nothing matched".
        log.error('Jump search failed on every kind', { code: 'jump_search_failed' });
        setResults([]);
        setError('Search failed. Check the connection to Okta and try again.');
        setMode('error');
        return;
      }

      setResults(rows);
      setMode('results');
    },
    [searchers],
  );

  const runResolve = useCallback(
    async (kind: OktaIdKind, id: string) => {
      const runId = ++runIdRef.current;
      setMode('resolving');
      setError(null);

      const local = index.lookup(kind, id);
      if (local.status === 'hit') {
        if (runId !== runIdRef.current) return;
        // The whole point of the snapshot: an exact answer, no request.
        setResults([local.entity]);
        setResolution({ cost: 0 });
        setMode('results');
        return;
      }

      if (local.status === 'miss') {
        // Authoritative absence — the collection's last walk finished and this id
        // is not in it. Spending a request to be told the same thing is waste.
        if (runId !== runIdRef.current) return;
        setResults([]);
        setResolution({ cost: 0 });
        setMode('results');
        return;
      }

      // 'unknown': the snapshot cannot deny this id exists, so ask Okta.
      const fetcher = fetchers[kind];
      if (!fetcher) {
        if (runId !== runIdRef.current) return;
        setResults([]);
        setResolution({ cost: 0 });
        setMode('results');
        return;
      }

      try {
        const found = await fetcher(id);
        if (runId !== runIdRef.current) return;
        setResults(found ? [found] : []);
        setResolution({ cost: 1 });
        setMode('results');
      } catch (err) {
        if (runId !== runIdRef.current) return;
        // Identifiers and outcomes only — never the entity name or a response body.
        log.error('Jump resolve failed', { code: 'jump_resolve_failed', kind });
        setResults([]);
        setResolution({ cost: 1 });
        setError(err instanceof Error ? err.message : 'Could not resolve that id.');
        setMode('error');
      }
    },
    [index, fetchers],
  );

  // The debounced name search. Deliberately does nothing for an id: every
  // intermediate prefix of an id matches nothing, so searching one spends a
  // request per keystroke to return an empty list.
  useEffect(() => {
    if (!enabled) return;
    if (oktaIdKind(debounced) !== null) return;
    if (debounced.length < JUMP_SEARCH_MIN_CHARS) {
      // Back below the floor: drop stale rows rather than leaving a longer
      // query's results under a shorter one. Bumping the run id cancels any
      // search still in flight for the longer query.
      runIdRef.current += 1;
      setResults([]);
      setResolution(null);
      setError(null);
      setMode('idle');
      return;
    }
    void runSearch(debounced);
  }, [debounced, enabled, runSearch]);

  const submit = useCallback(() => {
    if (!enabled) return;
    if (idKind) {
      void runResolve(idKind, trimmed);
      return;
    }
    if (trimmed.length >= JUMP_SEARCH_MIN_CHARS) void runSearch(trimmed);
  }, [enabled, idKind, trimmed, runResolve, runSearch]);

  const clear = useCallback(() => {
    runIdRef.current += 1;
    setQuery('');
    setResults([]);
    setError(null);
    setResolution(null);
    setMode('idle');
  }, []);

  return {
    query,
    setQuery,
    mode,
    results,
    error,
    isIdQuery,
    resolution,
    submit,
    clear,
  };
}
