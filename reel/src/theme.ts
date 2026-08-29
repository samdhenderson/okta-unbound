/**
 * @module reel/theme
 * @description The reel's palette and type scale.
 *
 * The product's tokens come from {@link module:reel/theme.generated}, which is
 * generated from `src/sidepanel/tailwind.css` — never transcribed, because a
 * brand blue one shade off the product's is worse than none. Everything added
 * here is reel-only: the stage the panel sits on has no counterpart in a
 * side panel, so there is no token to inherit.
 */
import { loadFont } from '@remotion/google-fonts/Inter';
import { COLOR, FONT } from './theme.generated';

export { COLOR, FONT };

/**
 * Inter, loaded rather than named.
 *
 * The panel's own text is baked into the video and is already Inter (the app's
 * `--font-primary`). The overlay must match it, and a CSS `font-family: Inter`
 * only matches on a machine that happens to have Inter installed — on a render
 * box it silently falls back to Helvetica, which is the difference between the
 * margin looking like the product and looking like a caption pasted on top.
 * Measured on the first render, which came out in the fallback.
 *
 * **Narrowed to what the reel actually sets.** Unfiltered, `loadFont()` fetched
 * every weight and subset: 63 requests per render tab, 126 on one, and Remotion
 * says so in its own warning. That is not just slow, it makes a render depend on
 * reaching Google's CDN, so a render box without egress produces a silently
 * unbranded film. Three weights and one subset is what `TYPE` and `STAGE` ask
 * for, and nothing here has ever set an italic.
 */
export const { fontFamily: INTER } = loadFont('normal', {
  weights: ['400', '600', '700'],
  subsets: ['latin'],
});

/** The film's own surfaces. Dark, so the white panel reads as a lit object. */
export const STAGE = {
  /** The backdrop. Near-black with a trace of the brand hue, not pure #000. */
  back: '#0d0f1a',
  /** A raised plane for diagrams and margin copy. */
  plate: '#161a2b',
  /** Hairlines and dividers on the backdrop. */
  rule: '#2a3050',
  /** Body copy on the backdrop. */
  ink: '#e8eaf4',
  /** Secondary copy: labels, units, counts. */
  inkDim: '#9aa1c4',
  /** The accent the margin argues in. The product's own primary, lifted to read on dark. */
  accent: '#8f9ff2',
  /** Where a figure lands. */
  affirm: COLOR.success,
  /** Where a figure is a gap rather than a win. */
  alert: '#ff7a5c',
} as const;

/** The frame. 1080p because that is what every surface this gets posted to wants. */
export const FRAME = { width: 1920, height: 1080, fps: 60 } as const;

/**
 * The type scale, in px at 1080p.
 *
 * Deliberately few sizes and deliberately large: this is read at a distance and
 * often at half size in a feed. Nothing below `unit` may carry meaning.
 */
export const TYPE = {
  chapter: 92,
  claim: 46,
  body: 27,
  label: 19,
  unit: 16,
  figure: 108,
  /** A figure printed in the margin. Smaller than `figure`: several may share a row. */
  readout: 76,
} as const;
