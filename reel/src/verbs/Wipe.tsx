/**
 * @module reel/verbs/Wipe
 * @description wipe - a reveal that travels, with a lit edge.
 *
 * The film reveals by arrival: an object docks in from the panel's own edge.
 * That is honest and slow. An ad needs a reveal that costs nothing in travel
 * distance, because there is no room in a two second stab for something to
 * cross the frame before it can be read.
 *
 * A wipe unmasks the object in place. Nothing moves; a hard edge sweeps across
 * it and the object is simply there behind the edge. The lit hairline riding
 * that edge (the `edge` part) is what makes it read as deliberate rather than
 * as a rendering glitch: a wipe with no leading edge looks like a partially
 * loaded image, which is the exact impression a product ad cannot afford.
 *
 * `clipPath` rather than a translated mask element, so the child never moves
 * and never re-lays-out. That matters for the mock panel, whose text would
 * otherwise reflow mid wipe.
 *
 * Never wrap this in Remotion's `<Sequence>` - see `useVerb.ts`'s module doc
 * for why that fails silently instead of throwing.
 */
import React from 'react';
import { interpolate } from 'remotion';
import { STAGE } from '../theme';
import { useVerb } from './useVerb';

export type WipeDirection = 'right' | 'left' | 'down' | 'up';

export interface WipeProps {
  /** Absolute composition frame the wipe begins on. */
  from: number;
  /** Which way the edge travels. Default `'right'`. */
  direction?: WipeDirection;
  /** The colour of the hairline riding the leading edge. Default the stage accent. */
  edgeColor?: string;
  /** Hairline thickness in px. `0` to suppress the edge entirely. */
  edgeWidth?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** The inset that hides everything the edge has not reached yet, per direction. */
function maskFor(direction: WipeDirection, hidden: number): string {
  const pct = `${hidden * 100}%`;
  if (direction === 'right') return `inset(0 ${pct} 0 0)`;
  if (direction === 'left') return `inset(0 0 0 ${pct})`;
  if (direction === 'down') return `inset(0 0 ${pct} 0)`;
  return `inset(${pct} 0 0 0)`;
}

/** Where the leading edge is, as a CSS position for the hairline. */
function edgeStyle(direction: WipeDirection, revealed: number, width: number): React.CSSProperties {
  const pct = `${revealed * 100}%`;
  const vertical = direction === 'down' || direction === 'up';
  const base: React.CSSProperties = vertical
    ? { left: 0, right: 0, height: width }
    : { top: 0, bottom: 0, width };
  if (direction === 'right') return { ...base, left: pct };
  if (direction === 'left') return { ...base, right: pct };
  if (direction === 'down') return { ...base, top: pct };
  return { ...base, bottom: pct };
}

/**
 * wipe. The object is unmasked in place by a travelling edge.
 */
export const Wipe: React.FC<WipeProps> = ({
  from,
  direction = 'right',
  edgeColor = STAGE.accent,
  edgeWidth = 4,
  style,
  children,
}) => {
  const t = useVerb('wipe', from);

  // The hairline leads the mask slightly, so the lit edge is always sitting on
  // *unrevealed* ground rather than on top of the content it just uncovered.
  const lead = Math.min(1, t * 1.04);
  // It also fades out over the last third rather than reaching the far side and
  // vanishing on a single frame, which reads as a dropped frame.
  const edgeAlpha = interpolate(t, [0, 0.15, 0.7, 1], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'relative', ...style }}>
      <div style={{ clipPath: maskFor(direction, 1 - t) }}>{children}</div>
      {edgeWidth > 0 && (
        <div
          style={{
            position: 'absolute',
            background: edgeColor,
            opacity: edgeAlpha,
            boxShadow: `0 0 24px ${edgeColor}`,
            pointerEvents: 'none',
            ...edgeStyle(direction, lead, edgeWidth),
          }}
        />
      )}
    </div>
  );
};
