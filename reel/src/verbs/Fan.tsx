/**
 * @module reel/verbs/Fan
 * @description Verb 5 of 6: fan - derivation, consequence.
 *
 * `DesignDocs/REEL DESIGN AND REWORK/README.md`, the verb table: 26f total,
 * "children released 4f apart along a ±12 degree arc, 14f each; the parent
 * scales to .92 at f6 and holds. The stagger is the causality."
 *
 * **A render prop, not a React context.** A context would let a distant
 * descendant read its release frame without the parent's JSX showing it, but
 * that is exactly the wrong tradeoff for a timing value: a set piece's beats
 * are written down as absolute frame numbers (`f76-112 fan two, four group
 * rows 4f apart` - the design doc's own language), and a reviewer checking
 * those numbers against the code needs to see, at the `<Fan>` call site,
 * which frame child 3 releases on. It also has to work in the preview
 * harness, which scrubs one child at a time; a context value sourced from a
 * provider three components up does not scrub in isolation the way a plain
 * number handed to a render prop does.
 *
 * `Fan` only owns the parent's `.92` scale and the release schedule.
 * `FanChild` is the per-child travel-arc entrance; the two are split because
 * a caller occasionally needs the schedule (to timeline a non-`FanChild`
 * consequence, e.g. a tally that counts in on its own release frame) without
 * wanting fan's specific ±12-degree arc.
 *
 * Never wrap either in Remotion's `<Sequence>` - see `useVerb.ts`'s module
 * doc for why that fails silently instead of throwing.
 */
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { EASING, FRAMES } from './ease';
import { release } from './useVerb';

/** fan parent's shadow recipe, from the spec's shadow-recipe table. */
export const FAN_PARENT_SHADOW = '0 50px 100px -36px rgba(0,0,0,.95)';
/** fan child's shadow recipe, from the spec's shadow-recipe table. */
export const FAN_CHILD_SHADOW = '0 40px 90px -40px rgba(0,0,0,.9)';

export interface FanProps {
  /** Absolute composition frame the fan begins on. */
  from: number;
  /** How many children to release. */
  count: number;
  /** Frames between releases. Default 4f, per the verb table. */
  step?: number;
  style?: React.CSSProperties;
  /** Render prop: given a child's index and its absolute release frame, render it. */
  children: (index: number, releaseFrame: number) => React.ReactNode;
}

/**
 * fan. Scales its own box to .92 (settling at f6, then holding) and hands each
 * child its release frame via a render prop - see the module doc for why not
 * a context.
 */
export const Fan: React.FC<FanProps> = ({
  from,
  count,
  step = FRAMES.fanStagger,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const scaleT = EASING.standard(
    interpolate(frame, [from, from + 6], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const scale = interpolate(scaleT, [0, 1], [1, 0.92]);

  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'left center', ...style }}>
      {Array.from({ length: count }, (_, i) => {
        const releaseFrame = from + release(i, step);
        return <React.Fragment key={i}>{children(i, releaseFrame)}</React.Fragment>;
      })}
    </div>
  );
};

export interface FanChildProps {
  /** Absolute composition frame this child releases on - `Fan`'s render-prop argument. */
  from: number;
  /** The tilt this child settles to, in degrees. Alternate sign per index for a fanned look. */
  angle?: number;
  /** The starting travel arc added on top of `angle`. Default 12, per the verb table's ±12 degrees. */
  arc?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * A single fanned child: travels from `angle + arc` (or `angle - arc` for a
 * negative `angle`) down to its resting `angle` over 14f on `entrance`, with
 * an opacity ramp riding the same motion (never standalone - "nothing fades
 * up").
 */
export const FanChild: React.FC<FanChildProps> = ({
  from,
  angle = 0,
  arc = 12,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const t = EASING.entrance(
    interpolate(frame, [from, from + FRAMES.fanChild], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const sign = angle < 0 ? -1 : 1;
  const startAngle = angle + sign * arc;
  const rotation = interpolate(t, [0, 1], [startAngle, angle]);
  // Reuses dock's 8f opacity window rather than a new constant: both are "an
  // entrance's opacity ramp," and the spec never gives fan's own children a
  // different one.
  const opacity = interpolate(frame, [from, from + FRAMES.dockOpacity], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        transform: `rotate(${rotation}deg)`,
        opacity,
        boxShadow: FAN_CHILD_SHADOW,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
