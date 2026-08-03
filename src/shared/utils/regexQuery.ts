/**
 * @module shared/utils/regexQuery
 * @description Parser for rockstar-style `/pattern/flags` search queries.
 *
 * Promoted from the Groups tab's filter helpers so any searchable list (groups
 * today; applications and authentication policies later) can offer the same
 * regex-query affordance. Uses the real `RegExp` constructor for parsing — never
 * `eval` — and treats invalid patterns as "not a regex query".
 */

/**
 * Parse a rockstar-style `/pattern/flags` regex query.
 *
 * Returns a compiled {@link RegExp} when `query` is slash-wrapped and the pattern
 * is valid, else `null` (the caller falls back to substring matching). The `g` and
 * `y` flags are stripped because they make `.test()` stateful across the many calls
 * one filter pass makes; `i`/`m`/`s`/`u` are preserved.
 *
 * @param query - The raw search text.
 * @returns A compiled regex, or `null` if not slash-wrapped or the pattern is invalid.
 *
 * @example
 * parseRegexQuery('/^sales-/i'); // => a RegExp matching names starting "sales-"
 * parseRegexQuery('sales');      // => null (plain substring query)
 */
export function parseRegexQuery(query: string): RegExp | null {
  const match = query.trim().match(/^\/(.+)\/([gimsuy]*)$/);
  if (!match) return null;
  try {
    return new RegExp(match[1], match[2].replace(/[gy]/g, ''));
  } catch {
    return null;
  }
}
