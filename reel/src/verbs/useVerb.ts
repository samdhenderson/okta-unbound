/**
 * @module reel/verbs/useVerb
 * @description The one hook every verb in this directory is built on: turn the
 * film's absolute frame into a verb's own eased progress.
 *
 * `DesignDocs/REEL DESIGN AND REWORK/README.md`, "Section A - the animation
 * grammar", names six verbs, each with a fixed frame budget and a fixed curve.
 * `useVerb(name, from)` is that table made callable: it reads
 * `useCurrentFrame()` itself, clamps to `[from, from + <the verb's own frame
 * count>]`, and hands back the eased `[0, 1]` progress for that verb - never a
 * raw linear ramp, so a component built on this hook cannot forget to ease it.
 *
 * **Never wrap a verb's contents in Remotion's `<Sequence>`.** `<Sequence>`
 * remaps `useCurrentFrame()` to start at 0 inside it, and every verb here -
 * this hook included - is authored in the composition's own absolute frames.
 * The failure is silent: nothing throws, the child simply free-runs its own
 * internal clock from 0 instead of tracking `from`, so it renders its very
 * first pose for the entire shot with no error to point at. If a verb needs to
 * start later, pass a later `from`; that is the entire mechanism.
 *
 * `count` is deliberately absent from the table this hook drives internally
 * (see `VERBS` below) even though it is one of the six -
 * its roll (`standard`) and its settle (`affirm`) are two different curves
 * over two different windows with a per-column stagger on top, which is more
 * than one `[0,1]` number can carry. `Count.tsx` computes its own per-column
 * timeline directly from `FRAMES`/`EASING` instead of calling this hook, and
 * says so in its own doc comment.
 */
import { interpolate, useCurrentFrame } from 'remotion';
import { EASING, FRAMES } from './ease';

/**
 * The verbs this hook can drive a single `[0,1]` progress for: how long each
 * one runs, and the curve it runs on.
 *
 * One table, not two keyed the same way. A verb used to be declared in a
 * `VERB_TOTAL` map and again in a `VERB_EASE` map, so adding one meant editing
 * both and a verb with a budget but no curve was a `TypeError` at render
 * rather than an error at build. Here a verb is one entry that cannot be half
 * declared, and {@link VerbName} is derived from the table rather than being a
 * third place to list the same five names. (ADR-0074 §4.)
 */
const VERBS = {
  dock: { frames: FRAMES.dockTotal, ease: EASING.entrance },
  lift: { frames: FRAMES.lift, ease: EASING.standard },
  split: { frames: FRAMES.split, ease: EASING.standard },
  fan: { frames: FRAMES.fanTotal, ease: EASING.entrance },
  recede: { frames: FRAMES.recede, ease: EASING.exit },
} as const satisfies Record<string, { frames: number; ease: (input: number) => number }>;

/** The verbs this hook knows how to drive a single `[0,1]` progress for. */
export type VerbName = keyof typeof VERBS;

/**
 * A verb's bezier progress in `[0, 1]` over its own frame count, measured from
 * absolute composition frame `from`. Before `from` this is `0`; after
 * `from + <total>` it is `1` - `interpolate`'s clamp, not a manual branch, so
 * a verb holds its resting pose indefinitely on either side without a caller
 * having to gate rendering on a frame range first.
 */
export function useVerb(name: VerbName, from: number): number {
  const frame = useCurrentFrame();
  const verb = VERBS[name];
  const linear = interpolate(frame, [from, from + verb.frames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return verb.ease(linear);
}

/**
 * A child's release frame offset for a stagger, relative to its group's own
 * `from`. `release(i, step)` is `i * step` - stated as a function rather than
 * inlined at each call site so a stagger reads as "the third child, four
 * frames apart" instead of a bare multiplication repeated at every verb that
 * releases children (`fan`'s 4f, `count`'s 3f-per-column, any set piece that
 * docks a list of rows).
 */
export function release(i: number, step: number): number {
  return i * step;
}
