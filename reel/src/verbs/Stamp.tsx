/**
 * @module reel/verbs/Stamp
 * @description stamp - type that lands rather than appears.
 *
 * The ad's supers (WHY, COMPARE, PREDICT, FIX, PROVE) are on screen for under
 * two seconds each, which rules out every gentle entrance the film owns: a word
 * that fades or slides is still arriving when its shot is over. A stamp starts
 * oversize and out of focus, collapses onto its resting size in 13 frames, and
 * carries a flash at the moment of contact - the same read as a rubber stamp
 * hitting paper, which is the one arrival the eye parses instantly at any size.
 *
 * The blur is what makes it work and what makes it expensive to fake: without
 * it the collapse reads as a zoom, with it the word appears to fall through
 * focus. `filter: blur()` is composited per frame, so this verb is deliberately
 * scoped to short text rather than offered for arbitrary subtrees.
 *
 * Never wrap this in Remotion's `<Sequence>` - see `useVerb.ts`'s module doc
 * for why that fails silently instead of throwing.
 */
import React from 'react';
import { interpolate } from 'remotion';
import { useVerb, useVerbPart } from './useVerb';

export interface StampProps {
  /** Absolute composition frame the stamp begins on. */
  from: number;
  /** How much larger than its resting size the word starts. `0.45` is 145%. */
  scaleFrom?: number;
  /** Peak blur in px at the start of the fall. */
  blur?: number;
  /**
   * The flash at contact, as an overlay colour. Omit for no flash.
   *
   * Drawn as a full-bleed wash over the word on the `impact` part, not as a
   * colour change on the text itself: a colour change reads as two words cut
   * together, a wash reads as one word being struck.
   */
  flash?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * stamp. Oversize and blurred, landing on its own size with a flash at contact.
 */
export const Stamp: React.FC<StampProps> = ({
  from,
  scaleFrom = 0.45,
  blur = 10,
  flash,
  style,
  children,
}) => {
  const t = useVerb('stamp', from);
  const impact = useVerbPart('stamp', 'impact', from);

  const scale = 1 + scaleFrom * (1 - t);
  // Blur clears before the scale finishes: focus arriving *ahead* of the
  // landing is what stops the settle looking like a soft focus pull.
  const blurPx = Math.max(0, blur * (1 - Math.min(1, t * 1.6)));
  const opacity = Math.min(1, t * 3);

  // The flash rises over the first half of the impact window and falls over the
  // second, so contact is a spike rather than a fade. `impact` is a `[0, 1]`
  // ramp across the whole window; this folds it in half.
  const flashAlpha = interpolate(impact, [0, 0.5, 1], [0, 0.55, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        transform: `scale(${scale})`,
        filter: blurPx > 0.01 ? `blur(${blurPx}px)` : undefined,
        opacity,
        ...style,
      }}
    >
      {children}
      {flash && (
        <div
          style={{
            position: 'absolute',
            inset: -8,
            background: flash,
            opacity: flashAlpha,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};
