/**
 * @module reel/pencil/draw
 * @description `draw`, the seventh verb: a hairline extruding along its own path.
 *
 * The film's grammar (`reel/verbs/`, `DesignDocs/REEL DESIGN AND REWORK/README.md`)
 * names six verbs for things a *populated* UI does: dock, lift, count, split,
 * fan, recede. None of them describe a line coming into existence, because
 * until the pencil treatment nothing in the film ever did that - every prior
 * shot opens on real, already-rendered product chrome. `draw` is that
 * seventh verb, scoped to `pencil/` rather than `verbs/` because it is not
 * reusable grammar for populated data the way the other six are; it is
 * specific to the graphite world this module draws.
 *
 * `draw` uses `easeInOutSine`, not one of the four house beziers
 * (`EASING.standard/entrance/exit/affirm` in `verbs/ease.ts`). Every other
 * verb in the film animates a UI element that already has physical presence -
 * it moves, scales, or counts under the same spring/cubic-bezier physics a
 * real interface would use if it animated at all. A pencil line has no mass to
 * move; it has a hand's speed, which starts slow, accelerates through the
 * middle of the stroke, and decelerates into the corner - exactly the
 * accelerate-then-decelerate shape `easeInOutSine` produces and none of the
 * four house curves do (all four are asymmetric, tuned for UI motion, not for
 * a pencil stroke's roughly symmetric speed profile).
 *
 * **Governance, and this is the part that keeps the metaphor honest:** `draw`
 * only ever applies to something the product has not made yet - a claim
 * awaiting evidence, a state that does not exist, or the world before the
 * panel solidifies. It never applies to a rendering of real captured state.
 * Once a surface is showing actual product data (a showcase driven by
 * `figures`, or filmed footage), that surface has already been drawn - `draw`
 * would be lying about where the frame's information came from. This is the
 * same discipline `verbs/` already keeps about which verb touches which kind
 * of data; `draw` extends it to the graphite layer.
 */
import { interpolate } from 'remotion';

/**
 * `easeInOutSine`, ported directly from the reference's `Easing.easeInOutSine`
 * (`animate({ ease: Easing.easeInOutSine })` in both `.jsx` handoff files).
 * Remotion's own `Easing` object has no sine variant, only the four cubic
 * curves and a handful of named power/bounce/elastic ones, so this is
 * supplied directly rather than approximated with a bezier.
 */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * `draw`'s own frame budget - 22f, stated directly by the handoff's brief
 * rather than derived from a `DUR` token (the same "not every verb number is
 * a token" allowance `verbs/ease.ts`'s `FRAMES.dockTotal`/`FRAMES.fanTotal`
 * already use). Exported so a caller doesn't retype `22`, and named
 * `PENCIL_FRAMES` rather than folded into `verbs/ease.ts`'s `FRAMES` because
 * this module intentionally does not touch `reel/verbs/` - a different commit
 * is building that directory concurrently.
 */
export const PENCIL_FRAMES = {
  /** `draw`'s duration: a hairline's full extrusion along its path. */
  draw: 22,
  /** `convert`'s duration - the same edge, run a second time. See `convert.tsx`. */
  convert: 22,
} as const;

/**
 * `draw`'s progress at `frame`, given the extrusion's `start` frame and an
 * optional `duration` (defaults to {@link PENCIL_FRAMES}.draw).
 *
 * Returns 0..1, clamped on both sides so a frame before `start` is fully
 * undrawn and a frame after `start + duration` is fully drawn - the same
 * "any frame renders correctly in isolation" contract every verb in this
 * film keeps, since Remotion may render frame 900 without ever having
 * rendered frame 899.
 */
export function draw(frame: number, start: number, duration: number = PENCIL_FRAMES.draw): number {
  return interpolate(frame, [start, start + duration], [0, 1], {
    easing: easeInOutSine,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}
