/**
 * @module sidepanel/hooks/useBlastRadius
 * @description React wrapper around the pure blast-radius engine — "if I save
 * this profile edit, what happens to this user's group access?"
 *
 * The engine (`shared/membership/blastRadius`) is synchronous, pure, and costs
 * **zero API calls**. This hook adds the two things a React surface needs and
 * the engine deliberately does not have: the group id→name map, and a piece of
 * state that can only ever hold a report belonging to the draft it was computed
 * from.
 *
 * ## It is opt-in, and that is a correctness property, not a performance one
 *
 * `analyze()` is the only thing that runs the engine. Nothing here recomputes on
 * a render or a keystroke. One analysis is `2 × N` rule evaluations over the
 * org's whole rule inventory, which is cheap on demand and wasteful per typed
 * character — but the reason it is a button rather than a live readout is that a
 * prediction which redraws itself mid-word invites an admin to read a verdict
 * about a half-typed value as a verdict about the value they meant.
 *
 * ## A report is only ever true for one draft
 *
 * {@link UseBlastRadiusReturn.reset} exists so a caller can retract the report
 * the instant the draft changes. Showing a stale report beside an edited field
 * is worse than showing none: it is a confident, specific, wrong answer, and the
 * admin has no way to tell it apart from a fresh one. The hook additionally
 * retracts on its own whenever the subject user changes, so a report can never
 * survive into a different person's editor.
 *
 * ## Cost
 *
 * The only I/O is one `chrome.storage.local` read of the Groups tab's cache
 * (`loadCachedGroupNames`), memoised for the life of the hook. No Okta request
 * is issued, so this never touches the scheduler. A cache miss degrades a label
 * to a group id and nothing else.
 *
 * ## Security
 *
 * The draft, the rule names, the group names and the condition expressions are
 * end-user-controllable tenant data and PII. **Only counts and the report status
 * are ever logged** — both compile-time-shaped, neither derived from a string.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeBlastRadius } from '../../shared/membership/blastRadius';
import type {
  BlastRadiusReport,
  RuleInventoryState,
} from '../../shared/membership/blastRadiusTypes';
import type { GroupMembership, OktaUser } from '../../shared/types';
import { createLogger } from '../../shared/utils/logger';
import { loadCachedGroupNames } from './fetchGroupRulesRequest';

const log = createLogger('BlastRadius');

/**
 * The resting report: nothing has been asked, so nothing is claimed.
 *
 * Mirrors the engine's own `emptyReport('not-computed')`, which is
 * module-private there. Held as one frozen module constant rather than rebuilt
 * per reset so that `setReport(NOT_COMPUTED)` on an already-reset hook bails out
 * of the re-render instead of scheduling a redundant one.
 */
const NOT_COMPUTED: BlastRadiusReport = Object.freeze({
  status: 'not-computed',
  groups: [],
  rules: [],
  counts: { added: 0, removed: 0, notPredicted: 0, starts: 0, stops: 0, undetermined: 0 },
  secondOrderPossible: false,
  secondOrderRuleNames: [],
}) as BlastRadiusReport;

/** The stored report, tagged with the user it is an answer about. */
interface ReportState {
  /** `user.id` at the moment the report was committed; `null` when there is none. */
  readonly userId: string | null;
  /** The committed report. */
  readonly report: BlastRadiusReport;
}

/** The resting state. One shared instance, so `setState(IDLE)` on an idle hook bails out. */
const IDLE: ReportState = { userId: null, report: NOT_COMPUTED };

/** What {@link useBlastRadius} needs to answer a question about an edit. */
export interface UseBlastRadiusOptions {
  /**
   * The user as Okta currently holds them, before the edit. `null` while none is
   * loaded — {@link UseBlastRadiusReturn.analyze} is then a no-op that leaves the
   * report at `not-computed` rather than guessing about nobody.
   */
  user: OktaUser | null;
  /**
   * The user's **COMPLETE** membership list.
   *
   * Not negotiable, and the reason is in `BlastRadiusInput`: the list becomes the
   * context every `isMemberOf*` clause is answered from, and that answer is
   * two-valued over the list it is given (ADR-0021). A partial list turns every
   * omitted group into a confident `false`.
   */
  memberships: readonly GroupMembership[];
  /**
   * The org's rule inventory, three-state. `unresolved` yields a `not-computed`
   * report (nothing may be concluded *and* nothing may be reported);
   * `unavailable` yields an `unavailable` one, which is itself a finding.
   */
  rules: RuleInventoryState;
}

/** The report, and the two controls that decide when it exists. */
export interface UseBlastRadiusReturn {
  /**
   * The current report. `status: 'not-computed'` until `analyze()` has produced
   * one, and again after every `reset()`.
   */
  report: BlastRadiusReport;
  /**
   * Run the engine against a proposed patch (attribute name → raw value, merged
   * over `user.profile`; a key present with `undefined` means "clear it").
   *
   * Fire-and-forget: it resolves the cached group-name map, then commits the
   * report. Calling it again supersedes any run still in flight, so the report
   * always belongs to the most recent draft handed in.
   *
   * The draft is PII. Never log it.
   */
  analyze: (draft: Readonly<Record<string, unknown>>) => void;
  /**
   * Retract the report back to `not-computed`.
   *
   * Call it whenever the draft changes. A report is true only for the draft it
   * was computed from, and a stale one is indistinguishable from a fresh one on
   * screen.
   */
  reset: () => void;
  /** Whether a run is in flight — true only across the group-name cache read. */
  isAnalyzing: boolean;
}

/**
 * Hold a blast-radius report for one user's proposed profile edit.
 *
 * @param options - See {@link UseBlastRadiusOptions}.
 * @returns The report plus `analyze` / `reset` / `isAnalyzing`. See
 *   {@link UseBlastRadiusReturn}.
 *
 * @example
 * ```tsx
 * const { report, analyze, reset, isAnalyzing } = useBlastRadius({
 *   user,
 *   memberships,
 *   rules: ruleInventory,
 * });
 *
 * // The draft moved, so the last answer is no longer about it.
 * useEffect(() => reset(), [draft, reset]);
 *
 * <Button onClick={() => analyze(draft)} loading={isAnalyzing}>Check impact</Button>
 * <BlastRadiusReportView report={report} />
 * ```
 */
export function useBlastRadius({
  user,
  memberships,
  rules,
}: UseBlastRadiusOptions): UseBlastRadiusReturn {
  const [state, setState] = useState<ReportState>(IDLE);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // One storage read for the life of the hook. The Groups cache does not change
  // under us often enough to be worth re-reading per analysis, and a miss costs
  // a label, not a verdict.
  const groupNamesRef = useRef<ReadonlyMap<string, string> | null>(null);
  const mountedRef = useRef(true);
  // Monotonic run token: a run whose token has been superseded never commits.
  const runIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    setState(IDLE);
    setIsAnalyzing(false);
  }, []);

  // A report belongs to the person it was computed about, so the subject's id is
  // stored beside it and checked here. Derived during render rather than cleared
  // in an effect: an effect would return the previous user's report for one
  // render first, which is the exact frame in which an admin reads a confident,
  // specific, wrong answer.
  const currentUserId = user?.id ?? null;
  const report = state.userId === currentUserId ? state.report : NOT_COMPUTED;

  const analyze = useCallback(
    (draft: Readonly<Record<string, unknown>>) => {
      if (!user) {
        reset();
        return;
      }

      runIdRef.current += 1;
      const runId = runIdRef.current;
      setIsAnalyzing(true);

      void (async () => {
        let groupNames = groupNamesRef.current;
        if (!groupNames) {
          groupNames = await loadCachedGroupNames();
          groupNamesRef.current = groupNames;
        }
        if (!mountedRef.current || runIdRef.current !== runId) return;

        const next = analyzeBlastRadius({ user, draft, memberships, rules, groupNames });
        setState({ userId: user.id, report: next });
        setIsAnalyzing(false);
        // Counts and the status enum only — never a name, an expression, or a
        // drafted value.
        log.debug('Analyzed', next.status, next.counts);
      })();
    },
    [user, memberships, rules, reset],
  );

  return { report, analyze, reset, isAnalyzing };
}
