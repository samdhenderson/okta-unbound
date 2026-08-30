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
}

/** A word that writes itself. See the module doc for both fixed defects. */
export const Written: React.FC<WrittenProps> = ({
  x,
  y,
  text,
  p,
  size = 24,
  weight = 400,
  color = GRAPHITE.primary,
}) => {
  const clipId = useId();
  const textWidth = useMemo(() => measureTextWidth(text, size, weight), [text, size, weight]);
  // A little padding past the last glyph's measured edge, matching the
  // reference's `+ 12` - without it the clip rect's edge lands exactly on
  // the last glyph's ink and can hairline-clip a serif/overshoot pixel.
  const clipWidth = textWidth + 12;
  const clampedP = Math.min(1, Math.max(0, p));

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={x - 6} y={y - size} width={clipWidth * clampedP} height={size * 1.6} />
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
