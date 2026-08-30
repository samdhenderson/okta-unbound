/**
 * @module reel/pencil/SketchBox
 * @description A rectangle, drawn as four sequenced strokes - never an SVG
 * `<rect>`.
 *
 * Ported from `SketchBox` in the reference handoff. A hand doesn't draw a
 * rectangle as one continuous stroke; it draws four sides, usually top then
 * clockwise. `q(n) = clamp(p * 4 - n, 0, 1)` turns one 0..1 progress value
 * into four sequential 0..1 progresses, each occupying a quarter of the
 * total: side 0 runs while `p` is in `[0, 0.25]`, side 1 while `p` is in
 * `[0.25, 0.5]`, and so on, with each `clamp`ed so a side that hasn't started
 * yet reads as `0` (via `Stroke`'s `p <= 0` opacity gate) rather than
 * negative.
 */
import React from 'react';
import { Stroke } from './Stroke';
import { GRAPHITE } from './colors';

export interface SketchBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Draw-on progress, 0..1, covering all four sides in sequence. */
  p: number;
  /** Base seed; the four sides use `seed`, `seed + 1`, `seed + 2`, `seed + 3`. */
  seed?: number;
  color?: string;
  /** Stroke width for all four sides. The brief's default box weight. */
  weight?: number;
  /** Passed through to each side's `Stroke`. */
  over?: number;
  /** Passed through to each side's `Stroke`, for a solidifying box. */
  amplitude?: number;
  segments?: number;
}

/** A rectangle, drawn as four sequenced strokes. See the module doc. */
export const SketchBox: React.FC<SketchBoxProps> = ({
  x,
  y,
  width,
  height,
  p,
  seed = 0,
  color = GRAPHITE.primary,
  weight = 2.6,
  over = 5,
  amplitude = 0,
  segments = 8,
}) => {
  const q = (n: number) => Math.min(1, Math.max(0, p * 4 - n));
  const common = { color, width: weight, over, amplitude, segments };
  return (
    <g>
      <Stroke x1={x} y1={y} x2={x + width} y2={y} p={q(0)} seed={seed} {...common} />
      <Stroke
        x1={x + width}
        y1={y}
        x2={x + width}
        y2={y + height}
        p={q(1)}
        seed={seed + 1}
        {...common}
      />
      <Stroke
        x1={x + width}
        y1={y + height}
        x2={x}
        y2={y + height}
        p={q(2)}
        seed={seed + 2}
        {...common}
      />
      <Stroke x1={x} y1={y + height} x2={x} y2={y} p={q(3)} seed={seed + 3} {...common} />
    </g>
  );
};
