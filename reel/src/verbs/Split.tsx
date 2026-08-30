/**
 * @module reel/verbs/Split
 * @description Verb 4 of 6: split - comparison.
 *
 * `DesignDocs/REEL DESIGN AND REWORK/README.md`, the verb table: 19f,
 * `standard`, "one object becomes two; gap 0 to (composition-specific, 96 to
 * 200px); each half takes its own shadow; a delta bar in alert `#ff7a5c`
 * strikes in at f14 over 5f. Two things are never *cut* to side by side - they
 * start as one object and part."
 *
 * **`close` is a prop, not a seventh verb.** Set piece C1 option C rejoins the
 * cause card's two plates before it recedes as a whole (`f200-219 plates
 * rejoin over 12f and recede together`) - the exact same gap animation run
 * backwards, on the exact same pair of elements. Giving that its own
 * component (`Rejoin`) would duplicate every one of split's geometry
 * decisions - axis, tilt, shadow, delta-bar placement - a second time, and the
 * two would drift apart the first time only one of them got a bugfix. `close`
 * (the absolute frame the rejoin starts on) plus `closeOver` (its duration,
 * default matching the 19f open) keep it one component with one gap formula.
 *
 * Never wrap this in Remotion's `<Sequence>` - see `useVerb.ts`'s module doc
 * for why that fails silently instead of throwing.
 */
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { EASING, FRAMES } from './ease';

/** split half's shadow recipe, from the spec's shadow-recipe table. Identical for both halves. */
const SPLIT_HALF_SHADOW = '0 60px 110px -36px rgba(0,0,0,.95)';

export interface SplitProps {
  /** Absolute composition frame the split begins opening on. */
  from: number;
  /** The gap's target width in px. Spec bounds horizontal splits at 96-200; not enforced here since it is composition-specific. */
  gap: number;
  axis?: 'x' | 'y';
  /** `[negative, positive]` degrees each half settles to as the gap opens. Omit for no tilt. */
  tilt?: [number, number];
  /** The alert delta bar (and its caption) that strikes in at f14 over 5f. Omit to skip it. */
  delta?: React.ReactNode;
  left: React.ReactNode;
  right: React.ReactNode;
  /** Absolute composition frame the halves start rejoining on. Omit to stay split. */
  close?: number;
  /** Rejoin duration in frames. Defaults to the same 19f as the open. */
  closeOver?: number;
  style?: React.CSSProperties;
}

/**
 * split. One object becomes two along `axis`, each carrying its own shadow
 * and (optionally) its own settled tilt, with an alert delta bar striking in
 * between them.
 */
export const Split: React.FC<SplitProps> = ({
  from,
  gap,
  axis = 'x',
  tilt,
  delta,
  left,
  right,
  close,
  closeOver,
  style,
}) => {
  const frame = useCurrentFrame();

  const openT = EASING.standard(
    interpolate(frame, [from, from + FRAMES.split], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );

  // `openness` is the one number everything below scales by: the gap, the
  // tilt, and the delta bar. Rejoining is just this number heading back to 0
  // by the same `standard` curve, run over `close`/`closeOver` instead of
  // `from`/`split` - "split played backwards," per the module doc.
  let openness = openT;
  if (close !== undefined) {
    const dur = closeOver ?? FRAMES.split;
    const closeT = EASING.standard(
      interpolate(frame, [close, close + dur], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
    );
    openness = openT * (1 - closeT);
  }

  const gapPx = openness * gap;
  const [tiltNeg, tiltPos] = tilt ?? [0, 0];
  const leftTilt = tiltNeg * openness;
  const rightTilt = tiltPos * openness;

  const leftTransform =
    axis === 'x'
      ? `translateX(${-gapPx / 2}px) rotate(${leftTilt}deg)`
      : `translateY(${-gapPx / 2}px) rotate(${leftTilt}deg)`;
  const rightTransform =
    axis === 'x'
      ? `translateX(${gapPx / 2}px) rotate(${rightTilt}deg)`
      : `translateY(${gapPx / 2}px) rotate(${rightTilt}deg)`;

  const barRaw = interpolate(
    frame,
    [from + FRAMES.splitDeltaBarAt, from + FRAMES.splitDeltaBarAt + FRAMES.splitDeltaBarDuration],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  // Scaled by `openness` too, so the bar retreats with the halves on close
  // rather than hanging in mid-air over a gap that has already shut.
  const barT = barRaw * openness;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: axis === 'x' ? 'row' : 'column',
        ...style,
      }}
    >
      <div style={{ transform: leftTransform, boxShadow: SPLIT_HALF_SHADOW }}>{left}</div>
      <div style={{ transform: rightTransform, boxShadow: SPLIT_HALF_SHADOW }}>{right}</div>
      {delta && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            opacity: barT,
            ...(axis === 'x'
              ? {
                  transform: `translate(-50%, -50%) scaleX(${barT})`,
                  transformOrigin: 'left center',
                }
              : {
                  transform: `translate(-50%, -50%) scaleY(${barT})`,
                  transformOrigin: 'center top',
                }),
          }}
        >
          {delta}
        </div>
      )}
    </div>
  );
};
