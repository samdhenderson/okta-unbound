/**
 * @module sidepanel/components/home/homeReports
 * @description The Home tab's reports: findings you can read in place, not
 * numbers you have to go and rebuild.
 *
 * A report is one question over rows the org snapshot already holds, so every
 * one of them costs **zero requests**. The difference between a report and one
 * of the org card's findings is only how much of the answer fits on the row: a
 * finding is a count with a filtered list behind it, a report is a count whose
 * matching entities are worth naming — so the row expands and names them.
 *
 * ## The honesty rules are shared, not re-implemented
 *
 * Every count here goes through
 * {@link module:sidepanel/components/home/orgFigures.resolveCount}, the same
 * function the org card's findings use. A report with an unread collection
 * behind it shows an em dash and the sentence saying which read is missing,
 * exactly as a finding does — and, importantly, it shows **no findings at all**
 * in that state rather than the handful its half-read collections happened to
 * produce.
 *
 * ## A report reports; it never recommends
 *
 * None of these is a delete list, and the copy never implies one. The labels say
 * what was *found*, not what should be *done*, and every expanded report carries
 * the caveat naming what its join cannot see —
 * {@link module:sidepanel/components/groups/ruleOrphans.INVISIBLE_MAINTAINERS}
 * verbatim for the rule-based reports, because Okta membership can be maintained
 * by Workflows, SCIM, an IdP or a direct API call, none of which this extension
 * observes.
 *
 * The dormant-access report is the one that *narrows* that sentence rather than
 * repeating it (ADR-0067 §1): it reads the one field every such write path does
 * move, so it may say "nothing filled it" where its siblings can only say "we
 * see nothing filling this". A stronger claim earns a stricter precondition, and
 * {@link ReportInput.suppressed} is where that is expressed.
 */
import {
  resolveCount,
  type CountInput,
  type CountResolution,
  type OrgFigureStatus,
} from './orgFigures';
import type { GroupFinding } from '../groups/ruleOrphans';

/**
 * How many findings a report row lists when expanded.
 *
 * A preview, and the row says so whenever it is truncating — a list silently cut
 * to its first 25 reads as a complete answer, which is the same class of lie the
 * counts on this tab exist to avoid. Everything beyond it is reachable through
 * the tab the finding lives on.
 */
export const REPORT_PREVIEW_LIMIT = 25;

/**
 * What the MFA-coverage launcher says before anything is picked.
 *
 * The one question on this card whose answer is **not** free: a factor read per
 * member. So the row is a scope-first launcher rather than a number, and this
 * sentence states the cost up front — an admin who lands on the group's page and
 * only then discovers the price has been misled by the row that sent them.
 */
export const MFA_SCAN_CAVEAT =
  'This one is not free. Coverage is a factor read per member, so picking a group opens that ' +
  'group and arms the scan there — nothing is read until you start it.';

/**
 * What the launcher says when the group collection was never walked.
 *
 * Same rule as a report that cannot state a number: offering a chooser built
 * from whatever rows happened to be on disk would present an unread org as an
 * org with three groups in it.
 */
export const MFA_UNAVAILABLE_NOTE =
  'Groups have not been read yet, so there is nothing to choose from. Refresh the org snapshot ' +
  'above, then come back.';

/**
 * What the launcher adds when the group walk did not finish.
 *
 * Unlike a report, a partial list is still *usable* here — every group it does
 * name is real and scannable. What it cannot do is imply completeness, so a
 * group missing from the filter is explained rather than left to look absent.
 */
export const MFA_PARTIAL_NOTE =
  'The last group read did not finish, so a group missing from this list may simply be unread.';

/** One report row. */
export interface HomeReport {
  /** Stable key, for React and for tests. */
  key: string;
  /** The report title: what was found, phrased as a noun the row can head. */
  label: string;
  /** See {@link module:sidepanel/components/home/orgFigures.subCountStatus}. */
  status: OrgFigureStatus;
  /** How many were found, or `null` when nothing behind it supports a number. */
  value: number | null;
  /** What the number is out of, or why there is not one. */
  note?: string;
  /**
   * The entities found, capped at {@link REPORT_PREVIEW_LIMIT} — and empty
   * whenever {@link HomeReport.value} is `null`, so a report that cannot state a
   * number cannot leak a partial list of names either.
   */
  findings: GroupFinding[];
  /** What this report cannot see. Shown whenever the row is open. */
  caveat: string;
}

/** Everything one report row is built from. */
export interface ReportInput extends Omit<CountInput, 'count'> {
  /** Stable key. */
  key: string;
  /** The report title. */
  label: string;
  /** Every matching entity, before the preview cap. */
  findings: GroupFinding[];
  /** What this report cannot see. */
  caveat: string;
  /**
   * A precondition this report failed, stated as the line to show instead of a
   * number — omitted when there is no such precondition.
   *
   * The completeness machinery in
   * {@link module:sidepanel/components/home/orgFigures.resolveCount} answers
   * *"were the collections behind this read?"*, which is the only question the
   * first two reports have. A report can have a further one that is not about a
   * collection at all: the dormant-access report is measured from the last
   * complete group walk, so it is withheld when that anchor is missing or more
   * than {@link module:sidepanel/components/groups/ruleOrphans.DORMANT_ANCHOR_MAX_AGE_DAYS}
   * days old, even though every collection behind it read cleanly (ADR-0067 §3).
   *
   * Expressing that as a synthetic `gate` was the alternative and was rejected:
   * a gate's note is generated from a collection noun, and the sentence a reader
   * needs here names a *read*, not a collection.
   */
  suppressed?: string;
}

/**
 * Resolve one report's count against its collections and its own precondition.
 *
 * Extracted from {@link buildReport} so a report's **export** applies the
 * identical rule rather than re-deriving it at the export layer — one function,
 * two surfaces (ADR-0065). A snapshot-sourced descriptor calls this and ships
 * the verdict alongside its rows; nothing downstream gets to decide separately
 * whether a number may be published.
 *
 * @param counts - The collections behind the count, and the count itself.
 * @param suppressed - A failed precondition, stated as the line to show instead
 * of a number. See {@link ReportInput.suppressed}.
 * @returns The status, the value (`null` when nothing supports one), and the
 * line explaining it.
 */
export function resolveReportCount(counts: CountInput, suppressed?: string): CountResolution {
  const resolved = resolveCount(counts);
  // A failed precondition only ever *downgrades*: it turns a number into an em
  // dash, and it never renames a failure the collections already reported. A
  // report whose rules were never read should still say so — that sentence
  // points at the read the admin can go and fix, where this one would point at
  // a second, less immediate cause.
  const blocked =
    suppressed !== undefined && (resolved.status === 'ok' || resolved.status === 'partial');
  return blocked ? { status: 'unavailable', value: null, note: suppressed } : resolved;
}

/**
 * Build one report row.
 *
 * @param input - See {@link ReportInput}.
 * @returns The report descriptor.
 */
export function buildReport({
  key,
  label,
  findings,
  caveat,
  suppressed,
  ...counts
}: ReportInput): HomeReport {
  const resolved = resolveReportCount({ ...counts, count: findings.length }, suppressed);
  return {
    key,
    label,
    status: resolved.status,
    value: resolved.value,
    note: resolved.note,
    // Gated on the resolved value rather than on `findings` directly: the
    // findings were computed from whatever rows happened to be on disk, and when
    // the collections behind them cannot support a count they cannot support a
    // list of names either.
    findings: resolved.value === null ? [] : findings.slice(0, REPORT_PREVIEW_LIMIT),
    caveat,
  };
}
