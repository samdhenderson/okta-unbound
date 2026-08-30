/**
 * @module reel/verbs/Recede
 * @description Verb 6 of 6: recede - leaving.
 *
 * `DesignDocs/REEL DESIGN AND REWORK/README.md`, the verb table: 19f,
 * `exit (.3,0,1,1)`, "scale 1 to .96; shadow collapses to a 2px `#2a3050`
 * hairline; opacity 1 to 0 in the last 6f only. The exit is the entrance's
 * opposite in shape." "A crossfade between two synthetic objects is the one
 * transition the film never uses."
 *
 * **"Collapses to a hairline," not "fades to nothing."** The shadow's blur and
 * spread interpolate to `0` and its color interpolates from translucent black
 * to the stage's own opaque hairline color (`STAGE.rule`) - so the resting
 * state is a flat 2px line, not a soft shadow that has merely lost its alpha.
 * `fromShadow` defaults to the split/dock-primary recipe because that is the
 * shadow most objects in this film are already carrying when they recede.
 *
 * Never wrap this in Remotion's `<Sequence>` - see `useVerb.ts`'s module doc
 * for why that fails silently instead of throwing.
 */
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { STAGE } from '../theme';
import { FRAMES } from './ease';
import { useVerb } from './useVerb';

interface ShadowRecipe {
  y: number;
  blur: number;
  spread: number;
  alpha: number;
}

/** The shadow most objects in this film are carrying when they start to recede - the split/dock-primary recipe. */
const RECEDE_START_SHADOW: ShadowRecipe = { y: 60, blur: 110, spread: -36, alpha: 0.95 };

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Blends pure black at `fromAlpha` toward the opaque `toHex` - the shadow becoming a solid line rather than fading out. */
function collapsingColor(t: number, fromAlpha: number, toHex: string): string {
  const [r, g, b] = hexToRgb(toHex);
  const alpha = interpolate(t, [0, 1], [fromAlpha, 1]);
  const rr = interpolate(t, [0, 1], [0, r]);
  const gg = interpolate(t, [0, 1], [0, g]);
  const bb = interpolate(t, [0, 1], [0, b]);
  return `rgba(${Math.round(rr)}, ${Math.round(gg)}, ${Math.round(bb)}, ${alpha})`;
}

export interface RecedeProps {
  /** Absolute composition frame the recede begins on. */
  from: number;
  /** The shadow this object is carrying just before it recedes. Defaults to the split/dock-primary recipe. */
  fromShadow?: ShadowRecipe;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * recede. The entrance's opposite in shape: scale settles down instead of up,
 * the shadow collapses to a hairline instead of growing from one, and opacity
 * only moves in the closing window instead of the opening one.
 */
export const Recede: React.FC<RecedeProps> = ({
  from,
  fromShadow = RECEDE_START_SHADOW,
  style,
  children,
}) => {
  const t = useVerb('recede', from);
  const frame = useCurrentFrame();

  const scale = interpolate(t, [0, 1], [1, 0.96]);
  const y = interpolate(t, [0, 1], [fromShadow.y, 2]);
  const blur = interpolate(t, [0, 1], [fromShadow.blur, 0]);
  const spread = interpolate(t, [0, 1], [fromShadow.spread, 0]);
  const color = collapsingColor(t, fromShadow.alpha, STAGE.rule);
  const boxShadow = `0 ${y}px ${blur}px ${spread}px ${color}`;

  const opacity = interpolate(
    frame,
    [from + FRAMES.recede - FRAMES.recedeOpacityWindow, from + FRAMES.recede],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div style={{ transform: `scale(${scale})`, boxShadow, opacity, ...style }}>{children}</div>
  );
};
