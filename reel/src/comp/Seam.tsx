/**
 * @module reel/comp/Seam
 * @description The seam that outlives the series.
 *
 * Drawn by `Reel.tsx` beside `<Band/>`, outside the `<Series>`, for the same
 * reason `Band` is: the only way a progress rule can slide across a chapter
 * boundary with no seam of its own is for something that outlives every
 * chapter to draw it. The seam's boundary is worse than a chapter cut, though
 * - it spans the *opening*, where the panel does not exist yet, so there is no
 * shared "panel opacity" it could piggyback on even in principle. The cut into
 * chapter one comes from the premise card fading its own fill to zero while
 * the chapters' panel opacity is already 1 at their own frame 0; a seam driven
 * by either side would jump 0 to 1 exactly on the cut. Hoisted here, it has one
 * clock and no boundary to match.
 *
 * ## Why `frame` is a prop, not `useCurrentFrame()`
 *
 * Every verb in `verbs/` reads `useCurrentFrame()` itself, because a verb is
 * only ever mounted at the absolute frame it animates at (never inside a
 * `<Sequence>` - see `verbs/useVerb.ts`). The seam is mounted at the film's
 * absolute frame too, so reading the clock itself would work. It takes `frame`
 * as a prop instead, for one reason: `SeamPreview` is a self-contained
 * composition with no `Reel.tsx` around it, and the brief for this file asks
 * for a preview that "demonstrates the behaviour over its 60-frame
 * composition" - i.e. plays the whole arrive/hold/leave cycle compressed into
 * 60 frames, not the real film's timing. A component that reads its own clock
 * cannot be re-timed by a caller; a component that takes `frame` as a number
 * can be handed either the real film's frame or a compressed rehearsal of it,
 * and `Seam` itself does not need to know which. `SeamPreview` is the only
 * thing that calls `useCurrentFrame()` for this file's purposes.
 *
 * ## What the caller supplies versus what the seam derives
 *
 * `arriveAt` and `recedeAt` are boundaries the seam has no way to know on its
 * own: they depend on `OPENING_FRAMES` and the chapter run's own total length,
 * both owned by `script.ts`/`Reel.tsx`, which this file does not import (every
 * other piece of furniture in this film - `Band` included - takes its
 * boundaries from `CHAPTERS`, computed in `Reel.tsx`, not from a shared
 * import). Everything else - the verbs' own frame budgets, curves, and the
 * arithmetic that turns a boundary into a `[0, 1]` progress - is derived here
 * from `verbs/ease`, the one place that timing is allowed to be a number, so
 * `Reel.tsx` never has to hand this file a duration or an easing curve.
 */
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { STAGE } from '../theme';
import { EASING, FRAMES } from '../verbs/ease';

export interface SeamProps {
  /**
   * The film's own absolute frame. Not read via `useCurrentFrame()` inside
   * this component - see the module doc for why.
   */
  frame: number;
  /**
   * Absolute frame the arrival begins. Defaults to `0`: the seam is
   * introduced on the title card, which is the first thing the film shows.
   */
  arriveAt?: number;
  /**
   * Absolute frame the seam starts leaving. Required, because "the end" is a
   * fact about the chapter run's total length that only `Reel.tsx` knows.
   */
  recedeAt: number;
}

/**
 * The film's vertical seam: a 4px accent line, full height, hard against the
 * frame's right edge - the panel plane's leading edge, since the panel itself
 * is docked there for every chapter that follows.
 *
 * Three phases, all driven by `frame`:
 *
 * - **arrive** (`arriveAt` for `FRAMES.dockTotal`): the line extends from a
 *   single point at mid-height to its full height, eased on the same
 *   `entrance` curve `dock` uses elsewhere in this film. Extending rather than
 *   fading up is the point - nothing in this film fades up, and a line that
 *   grows reads as the edge being drawn in rather than materialising.
 * - **hold**: full height, full opacity, motionless. This is every chapter.
 * - **recede** (`recedeAt` for `FRAMES.recede`): the same shape `Recede.tsx`
 *   uses - opacity only moves in the closing `FRAMES.recedeOpacityWindow`
 *   frames, eased on `exit` - plus a slight scale-down to `0.96`, so the seam
 *   leaves the same way every other object in this film does instead of
 *   inventing a second exit grammar for one line.
 */
export const Seam: React.FC<SeamProps> = ({ frame, arriveAt = 0, recedeAt }) => {
  const arrive = interpolate(frame, [arriveAt, arriveAt + FRAMES.dockTotal], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scaleY = EASING.entrance(arrive);

  const leave = interpolate(frame, [recedeAt, recedeAt + FRAMES.recede], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const eased = EASING.exit(leave);
  const scaleX = interpolate(eased, [0, 1], [1, 0.96]);
  const opacity = interpolate(
    frame,
    [recedeAt + FRAMES.recede - FRAMES.recedeOpacityWindow, recedeAt + FRAMES.recede],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: 4,
        background: STAGE.accent,
        opacity,
        transform: `scaleY(${scaleY}) scaleX(${scaleX})`,
        transformOrigin: 'center',
      }}
    />
  );
};

/**
 * A 60-frame rehearsal of the whole lifecycle: arrive over the first
 * `FRAMES.dockTotal` frames, hold, then recede into the last `FRAMES.recede`
 * frames - so scrubbing this composition shows all three phases rather than
 * one frozen pose.
 */
const PREVIEW_FRAMES = 60;

export const SeamPreview: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: STAGE.back }}>
      <Seam frame={frame} arriveAt={0} recedeAt={PREVIEW_FRAMES - 1 - FRAMES.recede} />
    </AbsoluteFill>
  );
};
