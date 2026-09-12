/**
 * @module reel/verbs/Pulse
 * @description pulse - look here, once.
 *
 * Every other verb in the grammar changes an object's state: it arrives, it
 * parts, it counts, it leaves. `pulse` changes nothing. The object is the same
 * before and after; for 13 frames it is emphatic.
 *
 * That is the verb an ad needs most and the film needs least. In an explanatory
 * reel the narration says which of five things on screen matters. With no
 * narration and no time, the picture has to say it, and the only honest way to
 * say it without moving anything is to beat once.
 *
 * A ring is drawn outside the object rather than a glow on it, because a glow
 * on a white product surface reads as a blown highlight at video bitrates,
 * while a ring survives compression at any size.
 *
 * Never wrap this in Remotion's `<Sequence>` - see `useVerb.ts`'s module doc
 * for why that fails silently instead of throwing.
 */
import React from 'react';
import { STAGE } from '../theme';
import { useVerbPart } from './useVerb';

export interface PulseProps {
  /** Absolute composition frame the pulse begins on. */
  from: number;
  /** The ring's colour. Default the stage accent. */
  color?: string;
  /** How far the object swells at the peak. `0.04` is 4%. */
  swell?: number;
  /** Corner radius of the ring, to match the object it surrounds. */
  radius?: number;
  /** Suppress the ring and keep only the swell. */
  ring?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * pulse. One beat: swell out, settle back, a ring expanding away as it goes.
 */
export const Pulse: React.FC<PulseProps> = ({
  from,
  color = STAGE.accent,
  swell = 0.04,
  radius = 14,
  ring = true,
  style,
  children,
}) => {
  const out = useVerbPart('pulse', 'expand', from);
  const back = useVerbPart('pulse', 'settle', from);

  // Two windows, not one folded curve: the swell out is fast and the settle is
  // slower, which is what makes a beat feel like a heartbeat instead of a
  // wobble. Folding a single ramp in half gives them equal time and reads wrong.
  const scale = 1 + swell * (out - back);

  // The ring keeps expanding after the object has settled, and fades as it
  // goes - it is the wave leaving, not an outline of the object.
  const ringScale = 1 + 0.16 * out + 0.1 * back;
  // Up with the swell, out with the settle, and **zero at rest**. The previous
  // shape was `interpolate(out - back * 0.8, [0, 0.4, 1], [0, 0.5, 0])`, whose
  // input settles at 0.2 once both windows have run - which lands on the rising
  // half of that ramp and leaves the ring lit at a quarter opacity for the rest
  // of the shot. Invisible around a badge, which is every other call site; two
  // blue rules across the frame around a full width row, which is how it was
  // finally noticed. A product of the two windows cannot do that: it is 0
  // whenever either end is at rest, by construction.
  const ringAlpha = 0.5 * out * (1 - back);

  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <div style={{ transform: `scale(${scale})` }}>{children}</div>
      {ring && (
        <div
          style={{
            position: 'absolute',
            inset: -6,
            border: `2px solid ${color}`,
            borderRadius: radius,
            transform: `scale(${ringScale})`,
            opacity: ringAlpha,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};
