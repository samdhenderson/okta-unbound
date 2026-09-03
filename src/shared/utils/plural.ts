/**
 * @module shared/utils/plural
 * @description English pluralisation — single source of truth for the two
 * shapes the panel actually needs: *the `s`*, and *a count with its noun*.
 *
 * Six private copies of this logic had accumulated before it was extracted —
 * a `plural(n)` returning the suffix, a `plural(count, noun)` returning the
 * phrase, and a scatter of inline `count === 1 ? '' : 's'` ternaries — and one
 * surface that could not be expressed by any of them (`Policy`/`Policies`) had
 * simply hand-rolled a third form. So this module deliberately covers all three
 * shapes rather than the one its first caller needed: a helper that cannot
 * express an irregular plural guarantees the next private copy.
 *
 * ## Counting rule
 *
 * English takes the singular at **exactly one** and the plural everywhere else,
 * including zero and fractions — *0 groups*, *1 group*, *1.5 hours*. No locale
 * plural-rule machinery (`Intl.PluralRules`) is used, because every string this
 * module builds is English copy authored in this repo; a real i18n pass would
 * replace the call sites, not this helper.
 *
 * ## Where number formatting lives
 *
 * {@link pluralize} formats the count with `toLocaleString()`. Thousands
 * separators are wanted in every UI string in the panel that quotes a count
 * (`of 1,204 applications`), and leaving it to the caller is exactly how the
 * org card ended up with `count.toLocaleString()` inlined at one site and bare
 * interpolation at others. Callers that need the raw number — or a count they
 * have already formatted themselves — use {@link pluralNoun} and interpolate
 * the number they want, which keeps the choice explicit rather than hidden
 * behind an options flag.
 */

/** A noun whose plural is not the singular plus `s` — `{ one: 'Policy', other: 'Policies' }`. */
export interface NounForms {
  /** The form used at a count of exactly one. */
  one: string;
  /** The form used at every other count, zero and fractions included. */
  other: string;
}

/**
 * A noun, in either of the two ways callers hold one.
 *
 * A bare string is the **singular**, and its plural is that string plus `s`.
 * Anything irregular is spelled out as {@link NounForms}.
 */
export type Noun = string | NounForms;

/** Expand a {@link Noun} to both forms. */
function forms(noun: Noun): NounForms {
  return typeof noun === 'string' ? { one: noun, other: `${noun}s` } : noun;
}

/**
 * The bare plural suffix — `''` at one, `'s'` otherwise.
 *
 * The shape for copy that has already been assembled around the noun and only
 * needs the letter, as in `` `${n} match${pluralSuffix(n) && 'es'}` ``. Prefer
 * {@link pluralNoun} when the whole noun is available.
 *
 * @param count - How many.
 * @returns `''` when `count` is exactly `1`, otherwise `'s'`.
 */
export function pluralSuffix(count: number): string {
  return count === 1 ? '' : 's';
}

/**
 * The noun alone, in the form the count calls for — no number.
 *
 * @param count - How many.
 * @param noun - Singular string, or explicit {@link NounForms} for an irregular.
 * @returns The singular form at a count of one, the plural form otherwise.
 *
 * @example
 * pluralNoun(1, 'group'); // => 'group'
 * pluralNoun(0, 'group'); // => 'groups'
 * pluralNoun(1, { one: 'Policy', other: 'Policies' }); // => 'Policy'
 */
export function pluralNoun(count: number, noun: Noun): string {
  const { one, other } = forms(noun);
  return count === 1 ? one : other;
}

/**
 * A count and its noun as one phrase, with the number localised.
 *
 * @param count - How many. Rendered with `toLocaleString()` — see the module
 *   note on where number formatting lives.
 * @param noun - Singular string, or explicit {@link NounForms} for an irregular.
 * @returns `"<count> <noun>"`, e.g. `'1 group'`, `'1,204 applications'`.
 *
 * @example
 * pluralize(1, 'application'); // => '1 application'
 * pluralize(3, { one: 'Policy', other: 'Policies' }); // => '3 Policies'
 */
export function pluralize(count: number, noun: Noun): string {
  return `${count.toLocaleString()} ${pluralNoun(count, noun)}`;
}

/**
 * Best-effort singular of a regular English plural.
 *
 * For call sites that hold the plural noun and need the singular — the org
 * snapshot names its collections in the plural (`applications`, `group rules`)
 * because most of its sentences are plural, and only the denominator line needs
 * the other form.
 *
 * This handles regular plurals only: `-ies → -y`, `-sses/-shes/-ches/-xes/-zes`
 * drop the `es`, a word ending in a doubled `ss` (`access`) is left alone, and
 * anything else drops a trailing `s`. It is **not** an inflector
 * — it will not know `people` or `indices`. A caller with an irregular noun
 * states both forms explicitly via {@link NounForms} instead of relying on this.
 *
 * @param plural - The plural noun, e.g. `'group rules'`.
 * @returns The derived singular, or `plural` unchanged when it does not end in `s`.
 *
 * @example
 * singularOf('applications'); // => 'application'
 * singularOf('policies');     // => 'policy'
 * singularOf('group rules');  // => 'group rule'
 */
export function singularOf(plural: string): string {
  if (!plural.endsWith('s')) return plural;
  if (plural.length > 3 && plural.endsWith('ies')) return `${plural.slice(0, -3)}y`;
  if (/(sse|she|che|xe|ze)s$/.test(plural)) return plural.slice(0, -2);
  // `access`, `status`, `bypass` — a word ending in a doubled s is never a
  // regular plural, and slicing one produces a word that does not exist.
  if (plural.endsWith('ss')) return plural;
  return plural.slice(0, -1);
}
