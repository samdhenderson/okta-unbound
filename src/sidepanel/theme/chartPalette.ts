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

/**
 * Diagonal hatch for the aggregated "Other" segment of a *segmented* spread bar.
 *
 * {@link CHART_OTHER_COLOR} is the right answer where the tail is one row in a
 * list; it is the wrong one in a bar whose every other segment is a value,
 * because a flat fill reads as an (N+1)th value rather than as "the rest".
 * Hatching says aggregate at a glance and survives a greyscale print, so the
 * distinction is not carried by colour alone.
 *
 * Both stops are Odyssey tokens — there is no raw hex here and none is needed.
 * The stripe geometry (`45deg`, the 3px/6px stops) is not a colour and has no
 * token to consume; it lives here beside the colours it is made of rather than
 * as an arbitrary Tailwind value inlined in a component.
 */
export const CHART_TAIL_HATCH =
  'repeating-linear-gradient(45deg, var(--color-neutral-300) 0 3px, var(--color-neutral-100) 3px 6px)';

/**
 * Paint for the MFA enrollment partition, keyed by **bucket** rather than by
 * position in the row list.
 *
 * The sequential ramp above assigns its deepest stop to whichever row comes
 * first, which is the right rule for attribute values — there the order *is* the
 * ranking, largest share darkest. It is the wrong rule here. The enrollment rows
 * arrive worst-first (`none`, `single`, `multiple`), so a positional ramp would
 * paint "no factors enrolled" in the deepest, most-emphatic indigo whatever its
 * size, and paint the covered majority in the palest tint — a picture that reads
 * as importance while actually encoding nothing but row order.
 *
 * Keying on the bucket instead means the colour carries the meaning it looks
 * like it carries: the gap is warning-toned, the thin cover is neutral, and full
 * coverage takes the primary. The card states all three in words as well, so
 * nothing here is load-bearing on colour alone.
 */
export const MFA_ENROLLMENT_PAINT: Readonly<Record<string, string>> = {
  none: 'var(--color-warning)',
  single: 'var(--color-neutral-300)',
  multiple: 'var(--color-primary)',
};
