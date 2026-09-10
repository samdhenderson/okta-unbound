/**
 * @module reel/verbs/Snap
 * @description snap - arriving hard, in a third of dock's time.
 *
 * `dock` is the film's arrival: 22 frames, a translate of 160px, a hairline
 * growing underneath. It is built to be *read*, which is right for a six minute
 * explanatory reel and wrong for a store page ad that has to land nine ideas in
 * twenty seconds. `snap` is the same event with the reading time removed: 8
 * frames on `affirm`, so the object overshoots its resting scale and settles
 * back inside the same eighth of a second it appeared in.
 *
 * The overshoot is the whole point and it is why this is a separate verb rather
 * than `dock` with a smaller `frames` prop. A dock run in 8 frames is just a
 * rushed dock; it still decelerates into place and still reads as gentle. An
 * object that arrives 6% too large and springs back reads as *impact*, which is
 * the register an advertisement is in.
 *
 * `affirm`'s `y1` is 1.3, so its progress legitimately exceeds 1 mid curve.
 * Scale has no valid range ceiling and wants exactly that. Opacity does not, so
 * it runs on its own `opacity` part, which `useVerbPart` clamps.
 *
 * Never wrap this in Remotion's `<Sequence>` - see `useVerb.ts`'s module doc
 * for why that fails silently instead of throwing.
 */
import React from 'react';
import { useVerb, useVerbPart } from './useVerb';

export type SnapEdge = 'left' | 'right' | 'up' | 'down' | 'none';

const AXIS: Record<Exclude<SnapEdge, 'none'>, 'x' | 'y'> = {
  left: 'x',
  right: 'x',
  up: 'y',
  down: 'y',
};
const SIGN: Record<Exclude<SnapEdge, 'none'>, 1 | -1> = { left: -1, right: 1, up: -1, down: 1 };

export interface SnapProps {
  /** Absolute composition frame the snap begins on. */
  from: number;
  /**
   * Which edge the object arrives from, or `'none'` to snap in place.
   *
   * Defaults to `'none'`, unlike `dock`. A snap is usually a scale event on
   * something already in position (a badge landing on a row, a figure resolving);
   * travel is the exception here, where for `dock` it is the rule.
   */
  edge?: SnapEdge;
  /** How far off-stage the object starts, in px. Ignored when `edge` is `'none'`. */
  distance?: number;
  /** How far past its resting size the object arrives. `0.06` is 6% oversize. */
  overshoot?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * snap. Hard arrival: oversize, overshooting, settled in 8 frames.
 */
export const Snap: React.FC<SnapProps> = ({
  from,
  edge = 'none',
  distance = 64,
  overshoot = 0.06,
  style,
  children,
}) => {
  const t = useVerb('snap', from);
  const opacity = useVerbPart('snap', 'opacity', from);

  // `t` runs past 1 on `affirm` and comes back, so this is `1 + overshoot` at
  // rest, larger than 1 at the crossing, and settled at exactly 1 when `t` is 1.
  // Written as a lerp from the oversize pose rather than as a curve *added* to
  // 1, so the resting pose is 1 by construction and cannot drift with the
  // overshoot amount.
  const scale = 1 + overshoot * (1 - t);
  const travel = edge === 'none' ? 0 : (1 - t) * distance * SIGN[edge];
  const shift =
    edge === 'none' || AXIS[edge] === 'x' ? `translateX(${travel}px)` : `translateY(${travel}px)`;

  return <div style={{ transform: `${shift} scale(${scale})`, opacity, ...style }}>{children}</div>;
};
