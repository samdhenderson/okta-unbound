/**
 * @module reel/pencil/Written
 * @description A word that writes itself: real SVG `<text>` revealed by a
 * clip rect whose width grows with progress, so it reads as handwriting under
 * the pencil layer's jitter.
 *
 * Ported from `Written` in `ConsoleDoodlePiece.jsx`, with two defects fixed.
 *
 * ## Defect 1: global clip-path ids
 *
 * The reference mints `'w' + id` from a hand-written `id` string and calls
 * `Written` roughly thirty times across one composition, every id chosen by
 * a person reading the file top to bottom. One collision - two labels both
 * passed `id: 'ml0'`, say - silently truncates whichever mounts second,
 * because SVG `id`s are global to the document and the second `<clipPath>`
 * either overwrites the first or is itself shadowed. That risk is worse in
 * Remotion than it was in the reference's single-page `.dc.html`: Remotion
 * Studio mounts multiple compositions (and multiple instances of the same
 * composition, at different scrub positions) into one document at once, so
 * two unrelated title cards built from this module could collide on an id
 * neither author knew the other had used.
 *
 * Fixed by minting the clip id from React's `useId()` instead of an
 * author-supplied string. `useId()` is guaranteed unique per component
 * instance for the lifetime of the render tree, so the id-collision class of
 * bug is structurally impossible rather than merely unlikely. The `id` prop
 * is gone; nothing else changes for a caller beyond not having to invent and
 * track one.
 *
 * ## Defect 2: width from a character-count guess
 *
 * The reference computes the reveal-clip's width as
 * `text.length * size * 0.62 + 12` - a monospace approximation. Inter is not
 * monospace: `'Illililil'` (all narrow glyphs) and `'Notifications'` (a mix,
 * several wide) are both 13 characters and would get the *identical* clip
 * width under that formula, so one of the two either finishes revealing with
 * visible dead space after the last glyph, or clips the last glyph before it
 * fully appears. At the sizes this module runs at (16-30px in the two
 * handoffs, but callers are not restricted to that range) the error compounds
 * with weight, too - 600 and 700 are measurably wider than 400 at the same
 * character count, and the reference's formula has no weight term at all.
 *
 * Fixed with a real measurement: `CanvasRenderingContext2D.measureText`,
 * using the same Inter font family, size, and weight the `<text>` itself
 * renders with. This is exact (not an approximation with a smaller error
 * bar) and still synchronous and deterministic - it depends only on the
 * (text, size, weight, font family) tuple, never on wall-clock time or a
 * network round trip, so the "any frame renders identically" contract holds.
 * It does depend on the font actually being loaded by the time a frame
 * renders; `reel/theme.ts`'s `INTER` is loaded through `@remotion/google-fonts`,
 * which registers a `delayRender` that Remotion's renderer already waits on
 * before capturing any frame, so that dependency is already satisfied by the
 * time this component's caller has anything to draw.
 *
 * A canvas context is unavailable in a couple of edge environments (a plain
 * Node unit test with no DOM, for instance). Rather than throw there, a
 * character-count estimate is used as a last-resort fallback - but it is
 * never the silent default the reference shipped: it only runs when
 * `measureText` itself is unavailable, and is documented at its call site
 * as a fallback, not a design choice.
 */
import React, { useId, useMemo } from 'react';
import { GRAPHITE } from './colors';
import { INTER } from '../theme';

/** A single canvas, reused across every `Written` measurement in the tab. */
let measureCanvas: HTMLCanvasElement | undefined;

/**
 * Real text width via `measureText`, falling back to a character-count
 * estimate only when no canvas 2D context is available at all. See the
 * module doc's "Defect 2" section for why the estimate is a fallback and not
 * the primary path.
 */
function measureTextWidth(text: string, size: number, weight: number): number {
  if (typeof document === 'undefined') {
    return text.length * size * 0.6;
  }
  measureCanvas ??= document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) {
    return text.length * size * 0.6;
  }
  ctx.font = `${weight} ${size}px ${INTER}`;
  return ctx.measureText(text).width;
}

export interface WrittenProps {
  x: number;
  y: number;
  text: string;
  /** Reveal progress, 0..1. */
  p: number;
  size?: number;
  weight?: number;
  color?: string;
  /**
   * Reveal one glyph at a time rather than by a single travelling edge.
   *
   * Opt-in, and off by default, because the two are not interchangeable at
   * every size. The single edge is right for small type: at 16-30px, which is
   * where the two handoffs use this, a glyph is a few pixels wide and the edge
   * reads as a nib moving. It stops being right as the type gets large. At the
   * wordmark's 92px the edge takes several frames to cross a single letter, so
   * what is on screen is a letter sliced vertically down the middle - visibly a
   * mask, not a hand, and worst on round glyphs where the cut is longest.
   *
   * Per-glyph reveals each letter through its own window, in sequence, with the
   * windows overlapping so the phrase still flows rather than ticking out like
   * a teleprinter. Kerning is untouched: this is still one `<text>` element, so
   * the shaping engine sees the whole string and the clip is applied after. An
   * earlier attempt at one `<text>` per glyph positioned from cumulative widths
   * lost every kern pair, which on `Okta Unbound` is visible at the `Un`.
   */
  perGlyph?: boolean;
}

/**
 * How long one glyph takes to reveal, as a fraction of the whole cue.
 *
 * Small on purpose. The count of glyphs in flight at once is roughly
 * `span / step`, and with `step = (1 - span) / (n - 1)` that is about
 * `span * (n - 1) / (1 - span)` - so at 12 glyphs, `0.14` puts under two
 * letters in flight and reads as a hand moving along the line. The first
 * attempt used `0.6`, which put *ten* in flight: every letter revealing its
 * own left slice simultaneously, which renders the wordmark as a row of
 * vertical shards rather than as writing. Raising this does not make the
 * writing slower, it makes it less sequential.
 */
const GLYPH_SPAN = 0.14;

/** A word that writes itself. See the module doc for both fixed defects. */
export const Written: React.FC<WrittenProps> = ({
  x,
  y,
  text,
  p,
  size = 24,
  weight = 400,
  color = GRAPHITE.primary,
  perGlyph = false,
}) => {
  const clipId = useId();
  const textWidth = useMemo(() => measureTextWidth(text, size, weight), [text, size, weight]);
  // A little padding past the last glyph's measured edge, matching the
  // reference's `+ 12` - without it the clip rect's edge lands exactly on
  // the last glyph's ink and can hairline-clip a serif/overshoot pixel.
  const clipWidth = textWidth + 12;
  const clampedP = Math.min(1, Math.max(0, p));

  /**
   * One rect per glyph, each spanning that glyph's measured slice of the line
   * and widening across its own window.
   *
   * Measured by prefix (`measureText` of the first `i` characters) rather than
   * per character summed, so kerning and any advance the shaper applies are
   * included: the slices tile the line exactly with no seam and no drift by the
   * last letter, which summing isolated character widths does not give.
   */
  const glyphRects = useMemo(() => {
    if (!perGlyph) return null;
    const edges = [...Array(text.length + 1)].map((_, i) =>
      measureTextWidth(text.slice(0, i), size, weight),
    );
    // Windows are laid out so the LAST one closes exactly at p=1: with n glyphs
    // each `span` long and each starting `step` after the last, the final start
    // is `1 - span`, so `step = (1 - span) / (n - 1)`. Getting this wrong by
    // hand is how a reveal ends up finishing early and holding on a static
    // frame that the cue table says is still being written.
    const n = text.length;
    const span = n > 1 ? Math.min(1, GLYPH_SPAN) : 1;
    const step = n > 1 ? (1 - span) / (n - 1) : 0;
    return edges.slice(0, n).map((left, i) => {
      const start = i * step;
      const local = span > 0 ? (clampedP - start) / span : 1;
      const g = Math.min(1, Math.max(0, local));
      // Each glyph's slice starts a hair left of its own edge for the same
      // reason the whole-line clip does: an exact edge hairline-clips ink.
      const slice = edges[i + 1] - left + 2;
      return { x: x + left - 1, width: slice * g };
    });
  }, [perGlyph, text, size, weight, clampedP, x]);

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          {glyphRects ? (
            glyphRects.map((r, i) => (
              <rect key={i} x={r.x} y={y - size} width={r.width} height={size * 1.6} />
            ))
          ) : (
            <rect x={x - 6} y={y - size} width={clipWidth * clampedP} height={size * 1.6} />
          )}
        </clipPath>
      </defs>
      <text
        x={x}
        y={y}
        clipPath={`url(#${clipId})`}
        fill={color}
        fontFamily={INTER}
        fontSize={size}
        fontWeight={weight}
        opacity={0.95}
      >
        {text}
      </text>
    </g>
  );
};
