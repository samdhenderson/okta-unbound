/**
 * @module reel/verbs/ease
 * @description The motion tokens, and the flat frame view over the verb table.
 *
 * This module is now two things joined: it re-exports everything
 * `verbs/tokens.ts` parsed out of the app's `DUR`/`EASE` tokens, and it derives
 * {@link FRAMES} from `verbs/registry.ts`'s {@link VERBS}.
 *
 * ## `FRAMES` is a view, not a declaration
 *
 * Every number below is read out of the verb table. Nothing here states a
 * duration of its own, and nothing may start doing so: a verb's timing is
 * declared once, in `registry.ts`, where its total, curve, sub-windows and
 * stagger sit together and cannot be half filled in. This flat shape survives
 * because 95 call sites across 19 files read it, and rewriting all of them to
 * reach through the table would have been a large diff whose only gate is that
 * the picture did not move. New code should prefer `VERBS`, {@link useVerb} and
 * {@link useVerbPart}, which say which verb a number belongs to.
 *
 * The old key names are kept exactly - `dockTotal` beside `lift` beside
 * `fanTotal`, three conventions for one idea - because renaming them is churn
 * with no reader on the other side of it. `registry.ts` is where the naming is
 * consistent.
 */
import { VERBS } from './registry';

export * from './tokens';
export * from './registry';

/**
 * Every verb's frame budget, flat.
 *
 * Derived from {@link VERBS}. See this module's doc for why the shape and the
 * key names are what they are.
 */
export const FRAMES = {
  /** dock: 22f total. */
  dockTotal: VERBS.dock.frames,
  /** dock: opacity 0 to 1 within the first 8f of the 22. */
  dockOpacity: VERBS.dock.parts.opacity.over,
  /** lift: 220ms `move` = 13f at 60fps. */
  lift: VERBS.lift.frames,
  /** lift: the stage dims to 55% over the first 8f of the hold. */
  liftStageDim: VERBS.lift.parts.stageDim.over,
  /** count: 500ms `tell` = 30f roll at 60fps. */
  countRoll: VERBS.count.parts.roll.over,
  /** count: the affirm settle after the roll. */
  countAffirmSettle: VERBS.count.parts.settle.over,
  /** count: digit columns settle 3f apart. */
  countColumnOffset: VERBS.count.stagger,
  /** split: 320ms `travel` = 19f at 60fps. */
  split: VERBS.split.frames,
  /** split: the delta bar strikes in at frame 14 of the 19, over 5f. */
  splitDeltaBarAt: VERBS.split.parts.deltaBar.at,
  splitDeltaBarDuration: VERBS.split.parts.deltaBar.over,
  /** fan: 26f total. */
  fanTotal: VERBS.fan.frames,
  /** fan: each child's own release animation runs 14f. */
  fanChild: VERBS.fan.parts.child.over,
  /** fan: children are released 4f apart. */
  fanStagger: VERBS.fan.stagger,
  /** recede: 320ms `travel` = 19f at 60fps. */
  recede: VERBS.recede.frames,
  /** recede: opacity 1 to 0 only in the last 6f of the 19. */
  recedeOpacityWindow: VERBS.recede.parts.opacity.over,
} as const;
