/**
 * @module reel/verbs/Strike
 * @description strike - a rule that shoots across the thing it is about.
 *
 * `dock` grows a hairline under an object over its full 22 frames, as part of
 * the arrival. `strike` is that hairline on its own, at 8 frames, used against
 * an object that is already there: underlining a value, crossing out a state
 * that no longer holds, connecting a claim to its evidence.
 *
 * The flash at the end (the `flash` part) is what separates a strike from a
 * progress bar. A line that grows and stops is a measurement. A line that grows
 * and then flares once has *hit* something, which is the reading every use of
 * this verb wants.
 *
 * Never wrap this in Remotion's `<Sequence>` - see `useVerb.ts`'s module doc
 * for why that fails silently instead of throwing.
 */
import React from 'react';
import { interpolate } from 'remotion';
import { STAGE } from '../theme';
import { useVerb, useVerbPart } from './useVerb';

export interface StrikeProps {
  /** Absolute composition frame the strike begins on. */
  from: number;
  /** The line's colour. Default the stage accent. */
  color?: string;
  /** Thickness in px. */
  weight?: number;
  /** Which end it grows from. */
  origin?: 'left' | 'right';
  style?: React.CSSProperties;
}

/**
 * strike. A hairline crosses its container in 8 frames and flares on arrival.
 *
 * Sized by its container rather than by a `width` prop: a strike is always
 * about something, and that something is what should be deciding how wide it
 * is. Position the parent, not the line.
 */
export const Strike: React.FC<StrikeProps> = ({
  from,
  color = STAGE.accent,
  weight = 3,
  origin = 'left',
  style,
}) => {
  const t = useVerb('strike', from);
  const flash = useVerbPart('strike', 'flash', from);

  const glow = interpolate(flash, [0, 0.4, 1], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: weight,
        background: color,
        transform: `scaleX(${t})`,
        transformOrigin: origin === 'left' ? 'left center' : 'right center',
        boxShadow: glow > 0.01 ? `0 0 ${18 * glow}px ${color}` : undefined,
        ...style,
      }}
    />
  );
};
