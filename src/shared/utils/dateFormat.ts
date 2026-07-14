/**
 * Date formatting — single source of truth.
 *
 * Replaces the ~3 independent `formatDate`/`getRelativeTime` implementations in
 * `UsersTab`, `UserProfileCard`, and `csvUtils`.
 *
 * @module dateFormat
 */

/**
 * Human-friendly absolute date, e.g. "Mar 5, 2026, 02:30 PM".
 * Returns "Never" for empty input and the raw string if parsing fails.
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
 * Relative time from now, e.g. "3 days ago". Returns `null` for empty/invalid input.
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
