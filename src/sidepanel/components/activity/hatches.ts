/**
 * @module sidepanel/components/activity/hatches
 * @description The repeating-gradient patterns the activity bar's tracks are
 * filled with, in one place.
 *
 * ## Why these are patterns rather than tints
 *
 * The activity bar has to separate four or five states on a track eight pixels
 * tall, and it may not lean on hue to do it: a reader who cannot tell the danger
 * hue from the warning one, or the indigo fill from its own pale remainder, still
 * has to be able to read the lane. **Form is the carrier.** Solid, dashed and
 * hatched are distinguishable at that size to everyone, and each pattern below
 * takes a deliberately different *angle* so two of them are never confusable even
 * when their colours are close.
 *
 * | Pattern                    | Angle  | Says                                  |
 * | -------------------------- | ------ | ------------------------------------- |
 * | {@link QUEUED_DASHES}      | 90°    | work waiting its turn                 |
 * | {@link COOLDOWN_HATCH}     | 135°   | this bucket is gated                  |
 * | {@link UNKNOWN_HATCH}      | 135°   | there is no budget reading to draw    |
 * | {@link PLANNED_HATCH}      | 135°   | declared but not yet enqueued         |
 *
 * ## Why they live here
 *
 * Three near-identical `repeating-linear-gradient(135deg, …, 3px …)` strings had
 * already been written out by hand in `BucketRow` (twice) and `PipelineMeter`,
 * with no shared home and no way to tell an intentional difference from a typo.
 * The rack's redesign would have made that five. A pattern that encodes a
 * *meaning* is a token, not a style detail, and two lanes that mean the same
 * thing must not be able to drift apart.
 *
 * Every stop is an Odyssey custom property — no raw hex reaches this file
 * (`docs/design-system.md`).
 *
 * ## Motion
 *
 * All four are static. There is no marching-ants animation to suppress under
 * `prefers-reduced-motion`, which is why the rack has exactly one form rather
 * than a reduced-motion variant (ADR-0027).
 */

/**
 * Vertical dashes marking the **queued** extension of a lane — the work that has
 * been enqueued (or declared by a plan) but has not been dispatched.
 *
 * Vertical, where every other pattern here is diagonal, because this one sits
 * *immediately adjacent* to the solid running fill in the same indigo family.
 * A shared angle would have let the two segments read as one; a different axis
 * separates them without needing a border or a third hue.
 */
export const QUEUED_DASHES =
  'repeating-linear-gradient(90deg, var(--color-primary-highlight) 0 3px, var(--color-primary-light) 3px 6px)';

/**
 * Diagonal hatch laid over a **gated** lane, whole-track.
 *
 * A thin danger rule on a wide `danger-light` ground: heavy enough to read as a
 * stop at a glance, light enough that the countdown riding beside it stays
 * legible. The lane is hatched *and* says "cooling down · 24s" in words — the
 * pattern is the fast signal, never the only one.
 */
export const COOLDOWN_HATCH =
  'repeating-linear-gradient(135deg, var(--color-danger) 0 3px, var(--color-danger-light) 3px 9px)';

/**
 * Faint hatch for a lane whose **budget is unknown** while work is running
 * against it.
 *
 * This is the pattern that keeps ADR-0070 §6 honest. A bucket Okta has not
 * reported on — and a remembered bucket whose window has expired — has `limit`
 * and `remaining` of `null`, so the lane has no denominator and *may not invent
 * one*. But an empty track beside the words "4 running" reads as a bug rather
 * than as an absence, so the unknown state gets a form of its own: barely-there,
 * deliberately unlike both the solid fills and the empty at-rest ground, and
 * saying nothing about magnitude because there is nothing to say.
 */
export const UNKNOWN_HATCH =
  'repeating-linear-gradient(135deg, var(--color-neutral-200) 0 1px, transparent 1px 5px)';

/**
 * Diagonal hatch for the **planned** share of an operation's pipeline meter —
 * requests a plan has declared but not yet enqueued (ADR-0060).
 *
 * Hatched rather than tinted because "provisional" is the thing being said, and
 * a fourth solid fill on a six-pixel meter would not survive the reader.
 */
export const PLANNED_HATCH =
  'repeating-linear-gradient(135deg, var(--color-neutral-400) 0 3px, transparent 3px 6px)';
