/**
 * @module reel/verbs/Drag
 * @description drag - an object is picked up, carried, and put down somewhere else.
 *
 * The grammar had no verb for this and the ad needed one, because the profile
 * display editor's whole argument is that you rearrange it *by hand*. A `snap`
 * with a translate is not the same event: a snap arrives, and an arrival has no
 * agent. A drag has one. The difference is entirely in the two ends - the object
 * lifts off the surface before it travels and settles back onto it after - and
 * those ends are what make a viewer read a hand rather than an animation.
 *
 * So the verb is a `travel` budget with two named windows cut out of it. `lift`
 * runs at the head: scale up a little, tilt a little, and raise the shadow.
 * `settle` runs at the tail and puts all three back. In between the object is
 * simply in the air, and the translate runs across the whole thing on
 * `standard` - the film's own move curve, so a dragged row accelerates and
 * arrives like every other object in the film rather than like a cursor.
 *
 * The tilt is the cheapest part and does the most work. A row that translates
 * with no rotation reads as a diagram element being repositioned; the same row
 * with 0.6 degrees on it reads as being held. It is small enough that nobody
 * notices it and wrong enough by itself that removing it flattens the shot.
 *
 * ## `DropGap` is here rather than in the stab that uses it
 *
 * A drag into a list is two motions, not one: the object moves, and the list
 * *makes room*. Shipping only the first would leave every caller hand-rolling
 * the second with its own numbers and its own curve, which is the drift the
 * verb table exists to stop. {@link DropGap} opens a slot to a stated height on
 * the same `from` and the same curve, so the row lands exactly as the space
 * finishes opening without anybody adding two frame counts together.
 *
 * Never wrap either in Remotion's `<Sequence>` - see `useVerb.ts`'s module doc
 * for why that fails silently instead of throwing.
 */
import React from 'react';
import { useVerb, useVerbPart } from './useVerb';

/** The shadow a lifted object casts at the top of its arc. Raised, not merely larger. */
export const DRAG_SHADOW = '0 18px 34px -10px rgba(20,22,40,.34)';

export interface DragProps {
  /** Absolute composition frame the drag begins on. */
  from: number;
  /** Where the object ends up, in px relative to where it started. */
  to: { x?: number; y?: number };
  /** How much larger the object is while it is off the surface. `0.03` is 3%. */
  lift?: number;
  /** How far the object tilts in the hand, in degrees. */
  tilt?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * drag. Picked up, carried, put down.
 */
export const Drag: React.FC<DragProps> = ({
  from,
  to,
  lift = 0.03,
  tilt = 0.6,
  style,
  children,
}) => {
  const t = useVerb('drag', from);
  const up = useVerbPart('drag', 'lift', from);
  const down = useVerbPart('drag', 'settle', from);

  // One number for "how far off the surface", built from the two windows rather
  // than from `t`: the object has to be fully lifted for the whole middle of
  // the travel, which a single progress cannot express. `up` reaches 1 while
  // `down` is still 0, so this is 1 across everything between them.
  const held = up - down;

  return (
    <div
      style={{
        transform: `translate(${(to.x ?? 0) * t}px, ${(to.y ?? 0) * t}px) scale(${1 + lift * held}) rotate(${tilt * held}deg)`,
        boxShadow: held > 0.01 ? DRAG_SHADOW : undefined,
        borderRadius: held > 0.01 ? 10 : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export interface DropGapProps {
  /** The same absolute frame the drag it receives was cued at. */
  from: number;
  /** How tall the slot is when open, in px. */
  height: number;
  /**
   * Run the other way: start open and close, for the slot the object *left*.
   *
   * A drag between two lists is three motions, and this is the third. Without
   * it the source list keeps a hole the width of the row that moved out, which
   * no editor does and which reads as the row having been copied rather than
   * moved. Same verb, same curve, so the hole closes exactly as the space at
   * the far end finishes opening.
   */
  closing?: boolean;
  /**
   * Let the contents leave the slot instead of being clipped by it.
   *
   * For the one case where the slot holds the object that is departing: the
   * source list has to collapse the row's own space as the row travels, and a
   * row cannot both be laid out in a list and be somewhere else, because a
   * transform moves paint and leaves the layout box exactly where it was. So
   * the row is positioned inside a `closing` slot and allowed to spill out of
   * it while the slot shuts underneath.
   */
  spill?: boolean;
  /** What sits in the slot. A drop indicator, or the object on its way out. */
  children?: React.ReactNode;
}

/**
 * The space a list opens to receive a dragged object, or closes behind one.
 *
 * Driven by the same verb, so the gap finishes opening on the frame the row
 * finishes arriving. The child is clipped rather than scaled, so a drop
 * indicator inside it keeps its own weight all the way open.
 */
export const DropGap: React.FC<DropGapProps> = ({ from, height, closing, spill, children }) => {
  const t = useVerb('drag', from);
  const landing = useVerbPart('drag', 'settle', from);
  const open = closing ? 1 - t : t;
  return (
    <div
      style={{
        height: height * open,
        overflow: spill ? 'visible' : 'hidden',
        position: 'relative',
        // The marker says where the object *will* land, so it has to be gone by
        // the time it has. It fades over the same `settle` window the object
        // comes back down on: the first draft left it lit under the dropped row
        // for the rest of the shot, where it read as a stray rule sticking out
        // of both ends of the row rather than as a target that had been met.
        //
        // A `spill` slot is exempt, because what it holds is the object itself
        // rather than a marker for it. Fading that is how the dragged row
        // vanished on the frame it landed.
        opacity: spill ? 1 : 1 - landing,
      }}
    >
      {children}
    </div>
  );
};
