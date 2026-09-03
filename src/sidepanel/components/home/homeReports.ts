/**
 * @module sidepanel/components/home/homeReports
 * @description The Home tab's reports: findings you can read in place, not
 * numbers you have to go and rebuild.
 *
 * A report is one question over rows the org snapshot already holds, so both of
 * the ones here cost **zero requests**. The difference between a report and one
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
 * Neither of these is a delete list, and the copy never implies one. Okta
 * membership can be maintained by Workflows, SCIM, an IdP, or a direct API call,
 * none of which this extension can see — so every expanded report carries
 * {@link module:sidepanel/components/groups/ruleOrphans.INVISIBLE_MAINTAINERS}
 * verbatim, and the labels say what was *found*, not what should be *done*.
 */
import { resolveCount, type CountInput, type OrgFigureStatus } from './orgFigures';
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
}

/**
 * Build one report row.
 *
 * @param input - See {@link ReportInput}.
 * @returns The report descriptor.
 */
export function buildReport({ key, label, findings, caveat, ...counts }: ReportInput): HomeReport {
  const resolved = resolveCount({ ...counts, count: findings.length });
  return {
    key,
    label,
    ...resolved,
    // Gated on the resolved value rather than on `findings` directly: the
    // findings were computed from whatever rows happened to be on disk, and when
    // the collections behind them cannot support a count they cannot support a
    // list of names either.
    findings: resolved.value === null ? [] : findings.slice(0, REPORT_PREVIEW_LIMIT),
    caveat,
  };
}
