/**
 * @module reel/pencil/convert
 * @description The graphite-to-ink transition - the moment a pencil drawing
 * becomes the real thing. Not a crossfade.
 *
 * The reference (`TitleCardPencilPiece.jsx`, `ConsoleDoodlePiece.jsx`)
 * solidifies by running two opacity ramps against each other for about 19
 * frames: `inkIn` rises from 0 to 1 while `pencilOut` falls from 1 to 0, both
 * layers mounted and both partially visible for most of that window. That is
 * a crossfade, and this film does not use crossfades anywhere else in its
 * grammar (`reel/verbs/`) - "nothing fades up" is a house rule for a reason:
 * a fade is soft in a way nothing else about this film's motion is, and here
 * specifically it means there is a stretch of frames where the same object
 * is drawn twice, faintly overlapping, which reads as flicker rather than
 * transformation once you're looking for it.
 *
 * `convert` replaces both ramps with a single hard-edged wipe: one edge,
 * travelling in the drawing's own direction over {@link PENCIL_FRAMES}.convert
 * frames, that reveals the ink rendering behind it while occluding the
 * graphite rendering ahead of it. Both are clipped by the *same* moving
 * position each frame, so there is no frame in which a pixel shows both -
 * the ink side of the edge never overlaps the graphite side. Conceptually
 * this is a modifier on {@link draw}: the same edge that drew the shape runs
 * a second time, this time converting rather than creating, which is why it
 * shares `draw`'s easing and default duration rather than defining its own.
 */
import React, { useId } from 'react';
import type { Rect } from '../layout';
import { draw, PENCIL_FRAMES } from './draw';

/**
 * The direction the wipe edge travels, matching the direction the shape was
 * originally drawn in. `'right'`/`'down'` start the edge at the bbox's
 * left/top and sweep to its right/bottom; `'left'`/`'up'` sweep the other way.
 * Whichever direction, ink is revealed on the side of the edge the wipe has
 * already passed, and graphite remains visible on the side it hasn't reached
 * yet.
 */
export type ConvertDirection = 'left' | 'right' | 'up' | 'down';

/** The two clip rects for one frame's wipe position within `bbox`. */
function wipeRects(
  direction: ConvertDirection,
  bbox: Rect,
  p: number,
): { ink: Rect; graphite: Rect } {
  const { x, y, width, height } = bbox;
  switch (direction) {
    case 'right': {
      const edge = x + width * p;
      return {
        ink: { x, y, width: edge - x, height },
        graphite: { x: edge, y, width: x + width - edge, height },
      };
    }
    case 'left': {
      const edge = x + width * (1 - p);
      return {
        ink: { x: edge, y, width: x + width - edge, height },
        graphite: { x, y, width: edge - x, height },
      };
    }
    case 'down': {
      const edge = y + height * p;
      return {
        ink: { x, y, width, height: edge - y },
        graphite: { x, y: edge, width, height: y + height - edge },
      };
    }
    case 'up': {
      const edge = y + height * (1 - p);
      return {
        ink: { x, y: edge, width, height: y + height - edge },
        graphite: { x, y, width, height: edge - y },
      };
    }
  }
}

export interface ConvertProps {
  /** The current composition frame, as from `useCurrentFrame()`. */
  frame: number;
  /** The absolute frame the wipe begins at. */
  start: number;
  /** Defaults to {@link PENCIL_FRAMES}.convert (22f), the same as `draw`. */
  duration?: number;
  /** The region the wipe travels across, in the same coordinate space as `ink`/`graphite`. */
  bbox: Rect;
  /** Which way the edge sweeps. Defaults to `'right'`. */
  direction?: ConvertDirection;
  /** The solidified rendering, revealed behind the edge. */
  ink: React.ReactNode;
  /** The pencil rendering, occluded ahead of the edge. */
  graphite: React.ReactNode;
}

/**
 * The graphite-to-ink transition: a single hard-edged wipe, never a
 * crossfade. See the module doc.
 */
export const Convert: React.FC<ConvertProps> = ({
  frame,
  start,
  duration = PENCIL_FRAMES.convert,
  bbox,
  direction = 'right',
  ink,
  graphite,
}) => {
  const id = useId();
  const p = draw(frame, start, duration);
  const { ink: inkRect, graphite: graphiteRect } = wipeRects(direction, bbox, p);

  return (
    <g>
      <defs>
        <clipPath id={`${id}-ink`}>
          <rect x={inkRect.x} y={inkRect.y} width={inkRect.width} height={inkRect.height} />
        </clipPath>
        <clipPath id={`${id}-graphite`}>
          <rect
            x={graphiteRect.x}
            y={graphiteRect.y}
            width={graphiteRect.width}
            height={graphiteRect.height}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-graphite)`}>{graphite}</g>
      <g clipPath={`url(#${id}-ink)`}>{ink}</g>
    </g>
  );
};
