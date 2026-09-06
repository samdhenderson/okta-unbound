/**
 * @module reel/figures
 * @description The shapes the walks read off the panel, as the composition
 * casts them.
 *
 * `figure<T>(manifest, key)` returns whatever the walk recorded under a key,
 * and `T` is the composition's claim about what that is. The claim is not
 * checked - a manifest is JSON, and the walk that wrote it lives in another
 * project - so these interfaces are documentation with teeth only insofar as
 * they keep two readers of the same key agreeing with each other.
 *
 * Which is exactly why they live here rather than in whichever file happened
 * to read them first. `script.ts` used to declare all four locally, for casts
 * inside its `diagram` closures; when those closures moved into
 * `diagrams/registry.tsx` (ADR-0074 §1) the shapes were needed in both places,
 * and two local copies of an unchecked cast is how two readers of one key
 * quietly stop agreeing.
 *
 * A shape here is a *subset* of what the walk records: only the fields the
 * film actually draws. Adding a field to a walk does not oblige anything here
 * to change.
 */

/** A count the panel showed, and the total it was drawn from. */
export interface Counts {
  shown: number;
  total: number;
}

/** One attribute the roster varies along, with the values it takes. */
export interface Facet {
  attribute: string;
  distinct: number;
  values: { value: string; members: number; filterable: boolean }[];
}

/** A filter as the panel applied it: which attribute, which value, how many left. */
export interface Filter {
  attribute: string;
  value: string;
  members: number;
}

/** One rung of the factor-coverage ladder. */
export interface CoverageRow {
  label: string;
  count: number;
  pct: number;
}
