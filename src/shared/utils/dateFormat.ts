/**
 * @module shared/utils/dateFormat
 * @description Date formatting — single source of truth.
 *
 * Replaces the ~3 independent `formatDate`/`getRelativeTime` implementations in
 * `UsersTab`, `UserProfileCard`, and `csvUtils`. Uses the runtime locale
 * (`toLocaleDateString(undefined, …)`), so rendered output varies by user locale.
 */

/**
 * Human-friendly absolute date with time, e.g. "Mar 5, 2026, 02:30 PM".
 *
 * @param dateString - An ISO/parseable date string, or nullish.
 * @returns The localized date-time string; `'Never'` for nullish input, or the
 *   raw input string if `Date` construction throws.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Date-only variant, e.g. "Mar 5, 2026" (no time). Used where a compact date is
 * preferred over the full timestamp.
 *
 * @param dateString - An ISO/parseable date string, or nullish.
 * @returns The localized date string; `'Never'`/the raw input on the same
 *   conditions as {@link formatDate}.
 */
export function formatDateShort(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
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
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return null;
  }
}
