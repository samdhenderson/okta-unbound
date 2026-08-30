/**
 * @module reel/pencil/Stroke
 * @description A line that draws itself on - the base primitive every other
 * shape in this module is built from.
 *
 * Ported from `Stroke` in `DesignDocs/design_handoff_title_animation/panel-only/
 * TitleCardPencilPiece.jsx` (identical in the console-doodle handoff). The
 * draw-on math is unchanged: `strokeDasharray` set to the line's own length,
 * `strokeDashoffset` retracted by `1 - p`, so the line appears to extrude from
 * its start point as `p` runs 0 to 1. Both ends overshoot past their nominal
 * position by `over` px along the line's own direction (a hand's sketch
 * corner never lands exactly on the target), and both ends carry a small
 * deterministic jitter so two strokes sharing an endpoint don't look
 * mechanically identical.
 *
 * One addition beyond the reference: `amplitude`. The reference wobbles its
 * *entire pencil layer* with an animated SVG filter (`feTurbulence` +
 * `feDisplacementMap`) - see `wobble.ts`'s module doc for why that is banned
 * here. `amplitude` gets the same visual result per-stroke, in geometry, at
 * zero filter cost: 0 (the default) renders a plain `<line>`, exactly the
 * reference's shape; any positive value subdivides the stroke into
 * `segments` points and renders a `<path>` instead, with the interior points
 * nudged off the straight line by `wobble.ts`'s `wobblePoints`. Animate
 * `amplitude` from 7 down to 0 to "solidify" a stroke - see `convert.tsx`.
 */
import React from 'react';
import { pathFromPoints, pathLength, wob, wobblePoints } from './wobble';
import { GRAPHITE } from './colors';

export interface StrokeProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Draw-on progress, 0..1. Values are clamped; `p <= 0` renders nothing. */
  p: number;
  /**
   * Deterministic jitter/wobble seed. Two strokes sharing a seed are jittered
   * identically - give every stroke in a scene its own seed (an incrementing
   * index is what the reference does, and is fine: `wob` is a scramble, not a
   * sequence, so adjacent seeds don't produce visibly-related offsets).
   */
  seed?: number;
  /** Stroke width in px. See the module doc for the widths in house use. */
  width?: number;
  color?: string;
  /** How far each end overshoots its nominal endpoint, in px. */
  over?: number;
  /**
   * Geometry wobble amplitude in px. `0` (default) is a straight `<line>`,
   * identical to the reference. A positive value subdivides the stroke into
   * `segments` points and displaces the interior ones - see the module doc.
   */
  amplitude?: number;
  /** Interior points when `amplitude > 0`. The brief's range is 6-10. */
  segments?: number;
}

/**
 * A line that draws itself on. See the module doc for the draw-on math and
 * why `amplitude` replaces the reference's SVG filter.
 */
export const Stroke: React.FC<StrokeProps> = ({
  x1,
  y1,
  x2,
  y2,
  p,
  seed = 0,
  width = 3.2,
  color = GRAPHITE.primary,
  over = 8,
  amplitude = 0,
  segments = 8,
}) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // Overshoot past each nominal endpoint, then jitter both ends. The four
  // `wob` seeds (seed, seed+7, seed+3, seed+11) are the reference's exact
  // offsets - kept so the two endpoints jitter independently of each other
  // rather than in lockstep.
  const ax = x1 - ux * over + wob(seed, 3);
  const ay = y1 - uy * over + wob(seed + 7, 3);
  const bx = x2 + ux * over + wob(seed + 3, 3);
  const by = y2 + uy * over + wob(seed + 11, 3);

  const clampedP = Math.min(1, Math.max(0, p));
  const opacity = p <= 0 ? 0 : 1;
  const strokeCommon = {
    stroke: color,
    strokeWidth: width,
    strokeLinecap: 'round' as const,
    opacity,
  };

  if (amplitude === 0) {
    const total = Math.hypot(bx - ax, by - ay);
    return (
      <line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        {...strokeCommon}
        strokeDasharray={total}
        strokeDashoffset={total * (1 - clampedP)}
      />
    );
  }

  const points = wobblePoints(ax, ay, bx, by, amplitude, seed, segments);
  const total = pathLength(points);
  return (
    <path
      d={pathFromPoints(points)}
      fill="none"
      {...strokeCommon}
      strokeDasharray={total}
      strokeDashoffset={total * (1 - clampedP)}
    />
  );
};
