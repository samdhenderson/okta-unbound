/**
 * @module reel/verbs/Lift
 * @description Verb 2 of 6: lift - emphasis.
 *
 * `DesignDocs/REEL DESIGN AND REWORK/README.md`, the verb table: 13f,
 * `standard (.2,0,0,1)`, scale 1 to 1.06, shadow y-offset 12 to 88px, "the
 * stage dims to 55 percent over the first 8f... holds at least 40f... shadow
 * means exactly one thing in this film: this is the object under discussion."
 *
 * **Two components, not one, because the dim plate is full-frame.** An
 * earlier draft dimmed the stage from inside `Lift` itself - an
 * absolutely-positioned `inset: 0` div nested under the lifted object. That
 * only dims whatever is *behind* `Lift` in paint order, which for an object
 * lifted out of a list or a card grid is the wrong side of most of the frame:
 * everything painted after it (siblings later in the tree, anything docked on
 * top) stays lit. A full-frame dim has to be a sibling near the composition
 * root, so `LiftPlate` is exported separately - the composition renders it
 * directly under an `<AbsoluteFill>`, and `Lift` only ever touches the one
 * object it is emphasizing.
 *
 * Never wrap either in Remotion's `<Sequence>` - see `useVerb.ts`'s module
 * doc for why that fails silently instead of throwing.
 */
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { STAGE } from '../theme';
import { FRAMES } from './ease';
import { useVerb } from './useVerb';

/**
 * The two named points on lift's shadow curve. `RESTING` is not in the spec's
 * shadow-recipe table (that table only names shadows a *verb* produces); it is
 * chosen to match the docked-primary recipe's blur/spread/alpha so the shadow
 * grows continuously into `LIFTED` rather than jump-cutting from nothing at
 * frame 0 of the 13f.
 */
const RESTING_SHADOW = { y: 12, blur: 60, spread: -34, alpha: 0.95 };
/** lift's shadow recipe, from the spec's shadow-recipe table. */
const LIFTED_SHADOW = { y: 88, blur: 150, spread: -40, alpha: 0.98 };

export interface LiftProps {
  /** Absolute composition frame the lift begins on. */
  from: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * lift. Scales and shadows the object under discussion. Deliberately does not
 * translate it - "the plane the object left stays visible behind it" means
 * the object stays put and only grows slightly toward the camera; a
 * `transform-origin` of the default centre keeps the growth symmetric rather
 * than reading as a shift to one side.
 */
export const Lift: React.FC<LiftProps> = ({ from, style, children }) => {
  const t = useVerb('lift', from);
  const scale = interpolate(t, [0, 1], [1, 1.06]);
  const y = interpolate(t, [0, 1], [RESTING_SHADOW.y, LIFTED_SHADOW.y]);
  const blur = interpolate(t, [0, 1], [RESTING_SHADOW.blur, LIFTED_SHADOW.blur]);
  const spread = interpolate(t, [0, 1], [RESTING_SHADOW.spread, LIFTED_SHADOW.spread]);
  const alpha = interpolate(t, [0, 1], [RESTING_SHADOW.alpha, LIFTED_SHADOW.alpha]);
  const boxShadow = `0 ${y}px ${blur}px ${spread}px rgba(0,0,0,${alpha})`;

  return <div style={{ transform: `scale(${scale})`, boxShadow, ...style }}>{children}</div>;
};

export interface LiftPlateProps {
  /** Absolute composition frame the dim begins ramping in on. */
  from: number;
  /**
   * Absolute composition frame the dim starts lifting back to 0, mirroring
   * the same 8f ramp. Omit to hold at 0.55 indefinitely - most compositions
   * unmount `<LiftPlate>` themselves once the next verb (typically `recede`)
   * takes the stage, which is cheaper than animating a plate nobody can see
   * change.
   */
  out?: number;
  /** The dim color. Defaults to the stage backdrop itself. */
  color?: string;
}

/**
 * The full-frame dim plate lift's emphasis reads against. Render as a sibling
 * near the composition root - see the module doc for why it cannot live
 * inside `Lift`.
 */
export const LiftPlate: React.FC<LiftPlateProps> = ({ from, out, color = STAGE.back }) => {
  const frame = useCurrentFrame();
  const opacity =
    out === undefined || frame < out
      ? interpolate(frame, [from, from + FRAMES.liftStageDim], [0, 0.55], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : interpolate(frame, [out, out + FRAMES.liftStageDim], [0.55, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: color,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};
