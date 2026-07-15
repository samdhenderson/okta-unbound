/**
 * @module sidepanel/theme/chartPalette
 * @description Named data-visualization palettes for member-analytics charts.
 *
 * The one sanctioned home for multi-stop chart colors (see `docs/design-system.md`).
 * Stops reference Odyssey tokens via CSS custom properties wherever an equivalent
 * token exists; the remaining ramp stops are genuinely chart-only tints and are
 * documented here rather than inlined as hex in a component.
 */

/**
 * Sequential indigo ramp for named attribute segments, deepest first so the
 * largest share reads darkest. The second stop is the Odyssey `primary` token;
 * the surrounding stops are chart-only tints that extend it darker and lighter.
 */
export const INDIGO_RAMP: readonly string[] = [
  '#4356cf', // chart-only — one step darker than `primary`
  'var(--color-primary)', // #546be7
  '#7385ec', // chart-only ramp tint
  '#95a2f1', // chart-only ramp tint
  '#b7c0f6', // chart-only ramp tint
  '#d6dbfb', // chart-only ramp tint
];

/** Neutral tone for the "(none)" segment (members missing the value). */
export const CHART_NONE_COLOR = 'var(--color-neutral-300)';

/** Lighter neutral for the aggregated "Other" long-tail segment. */
export const CHART_OTHER_COLOR = '#e5e5e5'; // chart-only — a hair lighter than neutral-200
