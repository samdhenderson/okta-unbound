/**
 * @module reel/verbs/useVerb
 * @description Turn the film's absolute frame into a verb's own eased progress.
 *
 * `useVerb(name, from)` is `verbs/registry.ts`'s table made callable: it reads
 * `useCurrentFrame()` itself, clamps to `[from, from + <the verb's own frame
 * count>]`, and hands back the eased `[0, 1]` progress for that verb - never a
 * raw linear ramp, so a component built on this hook cannot forget to ease it.
 * {@link useVerbPart} does the same for a verb's named sub-window.
 *
 * **Never wrap a verb's contents in Remotion's `<Sequence>`.** `<Sequence>`
 * remaps `useCurrentFrame()` to start at 0 inside it, and every verb here -
 * this hook included - is authored in the composition's own absolute frames.
 * The failure is silent: nothing throws, the child simply free-runs its own
 * internal clock from 0 instead of tracking `from`, so it renders its very
 * first pose for the entire shot with no error to point at. If a verb needs to
 * start later, pass a later `from`; that is the entire mechanism.
 *
 * The table this drives lives in `registry.ts`, not here. A verb that cannot be
 * driven by a single `[0, 1]` says so there, in its `compound` field, and reads
 * its `parts` directly - `count` is the one that does.
 */
import { interpolate, useCurrentFrame } from 'remotion';
import { EASING } from './tokens';
import { VERBS } from './registry';
import type { PartName, VerbName } from './registry';

/**
 * A verb's bezier progress in `[0, 1]` over its own frame count, measured from
 * absolute composition frame `from`. Before `from` this is `0`; after
 * `from + <total>` it is `1` - `interpolate`'s clamp, not a manual branch, so
 * a verb holds its resting pose indefinitely on either side without a caller
 * having to gate rendering on a frame range first.
 */
export function useVerb(name: VerbName, from: number): number {
  const frame = useCurrentFrame();
  const spec = VERBS[name];
  const linear = interpolate(frame, [from, from + spec.frames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return EASING[spec.ease](linear);
}

/**
 * The linear `[0, 1]` progress of one of a verb's named sub-windows, measured
 * from the same absolute `from` the verb itself was cued at.
 *
 * Linear, deliberately. A sub-window is usually an opacity ramp or a bar
 * striking in - things the spec gives a window rather than a curve - and the
 * two callers that do want a curve (`dock`'s travel, `fan`'s contraction) ease
 * the result themselves with the curve they mean. Easing here would apply the
 * verb's own curve to a window it was never specified for.
 *
 * The point of this over hand-written arithmetic is that `at` is relative to
 * the verb, so a caller writes `useVerbPart('split', 'deltaBar', splitFrom)`
 * instead of `interpolate(frame, [from + FRAMES.splitDeltaBarAt, from +
 * FRAMES.splitDeltaBarAt + FRAMES.splitDeltaBarDuration], ...)` and cannot get
 * the addition wrong in one of the two places it appears.
 */
export function useVerbPart<V extends VerbName>(name: V, part: PartName<V>, from: number): number {
  const frame = useCurrentFrame();
  const parts = (VERBS[name] as { parts?: Record<string, { at: number; over: number }> }).parts;
  const window = parts?.[part as string];
  if (!window) {
    throw new Error(`Verb "${name}" has no part "${String(part)}".`);
  }
  return interpolate(frame, [from + window.at, from + window.at + window.over], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
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
