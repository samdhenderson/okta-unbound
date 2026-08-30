/**
 * @module reel/verbs/Dock
 * @description Verb 1 of 6: dock - arriving.
 *
 * `DesignDocs/REEL DESIGN AND REWORK/README.md`, the verb table: 22f,
 * `entrance (0,0,0,1)`, translate -160 to 0, opacity 0 to 1 within the first 8f
 * only, and "an accent hairline sweeps left to right beneath the object across
 * all 22f." "Nothing in this film fades up - objects enter from the left, the
 * edge the real panel is docked to."
 *
 * **`edge` defaults to `'left'` because leftward is the *meaning*, not just the
 * common case.** The spec's own set pieces reverse it - the ledger's rows dock
 * from the right, the title card's placeholder rows dock downward - but every
 * one of those is a *composition* choosing to violate the panel's own geometry
 * for its own beat. `left` is where the film's docked panel actually lives
 * (`layout.ts`'s stage), so it is the only direction a caller gets for free;
 * every other edge is an explicit, visible choice at the call site.
 *
 * Never wrap this in Remotion's `<Sequence>` - see `useVerb.ts`'s module
 * doc for why that fails silently instead of throwing.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { STAGE } from '../theme';
import { EASING, FRAMES } from './ease';

export type DockEdge = 'left' | 'right' | 'up' | 'down';

const AXIS: Record<DockEdge, 'x' | 'y'> = { left: 'x', right: 'x', up: 'y', down: 'y' };
/** Which direction is "off-stage" for each edge - the sign the travel distance carries. */
const SIGN: Record<DockEdge, 1 | -1> = { left: -1, right: 1, up: -1, down: 1 };

export interface DockProps {
  /** Absolute composition frame the dock begins on. */
  from: number;
  /** Which edge the object arrives from. Default `'left'` - see module doc. */
  edge?: DockEdge;
  /** How far off-stage the object starts, in px. */
  distance?: number;
  /** Override the verb table's 22f. Rare - most callers should take the default. */
  frames?: number;
  /** The accent hairline beneath the object. Default on. */
  rule?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * dock. The child is measured (via `ResizeObserver`, not a prop) so the
 * hairline can grow to the object's own width without the caller having to
 * know it - the spec gives dock exactly five props (`from`, `edge`,
 * `distance`, `frames`, `rule`) and a `width` prop would be a sixth that every
 * call site would have to keep in sync with whatever it is docking.
 */
export const Dock: React.FC<DockProps> = ({
  from,
  edge = 'left',
  distance = 160,
  frames = FRAMES.dockTotal,
  rule = true,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // Measured synchronously before paint, on every render, with no dependency
  // array and no `ResizeObserver`. Both of those were in the first draft and
  // both were wrong here: `children` is a fresh object each render, so keying
  // the effect on it rebuilt an observer for every frame of a 14,000 frame
  // film, and the observer never reported anything the synchronous `measure()`
  // had not already set. Remotion seeks frame by frame rather than playing, so
  // "measure again each render" is the honest rule - there is no steady state
  // an observer would be watching for.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setWidth(el.offsetWidth);
  });

  const linear = interpolate(frame, [from, from + frames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const eased = EASING.entrance(linear);
  const travel = (1 - eased) * distance * SIGN[edge];
  const opacity = interpolate(frame, [from, from + FRAMES.dockOpacity], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const transform = AXIS[edge] === 'x' ? `translateX(${travel}px)` : `translateY(${travel}px)`;

  // The hairline tracks the same eased progress as the translate, not the
  // linear frame count, so it finishes growing in lockstep with the arrival
  // rather than visibly outrunning or lagging it.
  const ruleWidth = eased * width;

  return (
    <div style={{ position: 'relative', ...style }}>
      <div ref={ref} style={{ transform, opacity }}>
        {children}
      </div>
      {rule && (
        // Anchored to the wrapper's static layout box, not the transformed
        // child - `transform` never moves a box's own layout position, so this
        // sits under the object's *resting* place for the whole 22f rather
        // than sliding in step with it. That reads as "this is where it
        // lands," which is the point of a hairline under an arrival.
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            marginTop: 22,
            width: ruleWidth,
            height: 3,
            background: STAGE.accent,
          }}
        />
      )}
    </div>
  );
};
