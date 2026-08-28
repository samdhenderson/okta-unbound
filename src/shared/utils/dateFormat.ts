/**
 * @module shared/utils/dateFormat
 * @description Date formatting — single source of truth.
 *
 * Replaces the ~3 independent `formatDate`/`getRelativeTime` implementations in
 * `UsersTab`, `UserProfileCard`, and `csvUtils`. Uses the runtime locale
 * (`toLocaleDateString(undefined, …)`), so rendered output varies by user locale.
 */

/** Accepted date inputs: a `Date`, an epoch-ms number, an ISO/parseable string, or nullish. */
export type DateInput = Date | number | string | null | undefined;

/**
 * Human-friendly absolute date with time, e.g. "Mar 5, 2026, 02:30 PM".
 *
 * @param date - A `Date`, epoch-ms number, ISO/parseable date string, or nullish.
 * @returns The localized date-time string; `'Never'` for nullish input, or the
 *   stringified raw input if `Date` construction throws.
 */
export function formatDate(date: DateInput): string {
  if (!date) return 'Never';
  try {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(date);
  }
}

/**
 * Date-only variant, e.g. "Mar 5, 2026" (no time). Used where a compact date is
 * preferred over the full timestamp.
 *
 * @param date - A `Date`, epoch-ms number, ISO/parseable date string, or nullish.
 * @returns The localized date string; `'Never'`/the stringified raw input on the
 *   same conditions as {@link formatDate}.
 */
export function formatDateShort(date: DateInput): string {
  if (!date) return 'Never';
  try {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(date);
  }
}

/**
 * One bucket of relative time, correctly pluralised.
 *
 * Every bucket below the day one divides down to a floor, so each could and did
 * produce a count of exactly one: 7 to 13 days rendered "1 weeks ago" and 30 to
 * 59 days rendered "1 months ago". Both are reachable from ordinary data and
 * both were user visible.
 */
function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

/**
 * Coarse relative time from now, bucketed by days/weeks/months/years.
 *
 * Buckets: `'today'`, `'yesterday'`, then `N days ago`, `N weeks ago`,
 * `N months ago`, `N years ago`.
 *
 * @param dateString - An ISO/parseable date string, or nullish.
 * @returns The relative-time label, or `null` for nullish/unparseable input.
 *
 * @example
 * getRelativeTime(new Date(Date.now() - 3 * 864e5).toISOString()); // => '3 days ago'
 */
export function getRelativeTime(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    if (Number.isNaN(diffMs)) return null;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return plural(diffDays, 'day');
    if (diffDays < 30) return plural(Math.floor(diffDays / 7), 'week');
    if (diffDays < 365) return plural(Math.floor(diffDays / 30), 'month');
    return plural(Math.floor(diffDays / 365), 'year');
  } catch {
    return null;
  }
}
