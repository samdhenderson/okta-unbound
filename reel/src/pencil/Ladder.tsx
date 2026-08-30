/**
 * @module reel/pencil/Ladder
 * @description A staircase of hard edged wipes: one object climbing through
 * several renderings of itself, each a further step toward real.
 *
 * `convert` (`pencil/convert.tsx`) solves the two level case: graphite on one
 * side of a moving edge, ink on the other, no frame where a pixel shows both.
 * The overture needs the same guarantee across five renderings rather than two,
 * and the obvious generalisation is the wrong one.
 *
 * ## What was rejected
 *
 * **Nesting `Convert`s.** The first attempt wrapped level 0 in a `Convert` whose
 * ink was a `Convert` whose ink was a `Convert`, one per step, all mounted for
 * the whole shot. It renders correctly and it is a trap: every level is mounted
 * on every frame, so the cost of the final hold is the cost of drawing the panel
 * five times, and worse, the clip rects compose. A pixel outside step 3's ink
 * rect but inside step 2's is showing level 2 through a hole in level 3, which
 * is not a wipe between two levels, it is a stencil of one over the other. The
 * moment two steps overlap in time that becomes visible as a torn band.
 *
 * **Crossfading between levels.** Not considered for more than a second, and
 * recorded here because it is the thing a reader will reach for: a level N and
 * a level N+1 rendering of the same panel visible simultaneously at partial
 * opacity is a crossfade between two synthetic objects, which is the one
 * transition this film never uses (`SCRIPT.md`, decisions log). It also looks
 * exactly like a render fault, because the two levels are in register.
 *
 * ## What this does instead
 *
 * At most one step is ever in flight, so at most one `Convert` is ever mounted.
 * The ladder finds the last step that has started and renders that step alone:
 * its graphite side is the level below, its ink side the level above, and
 * `draw`'s clamping does the rest. A frame past the step's end shows `p = 1`,
 * which is the upper level whole; a frame before the first step shows level 0
 * directly. Every frame renders correctly in isolation, which Remotion requires
 * because it may render frame 900 without ever having rendered 899.
 *
 * That "at most one" is a real precondition rather than a hope, so it is
 * checked. Two overlapping steps would silently drop the earlier one's second
 * half, which reads on screen as a level being skipped, and a skipped level in
 * a piece whose entire subject is the staircase is the failure worth throwing
 * over.
 *
 * Never wrap a ladder in Remotion's `<Sequence>`. Every cue here is an absolute
 * composition frame; `<Sequence>` remaps `useCurrentFrame()` to 0 and would
 * freeze the climb on level 0 without raising anything.
 */
import React from 'react';
import type { Rect } from '../layout';
import { Convert, type ConvertDirection } from './convert';
import { PENCIL_FRAMES } from './draw';

/** One rung of the climb: the wipe that replaces level `i` with level `i + 1`. */
export interface LadderStep {
  /** The absolute composition frame the wipe begins at. */
  at: number;
  /** Which way the edge sweeps. Defaults to `'down'`, the way a panel is read. */
  direction?: ConvertDirection;
  /** Defaults to {@link PENCIL_FRAMES}.convert (22f). */
  duration?: number;
}

export interface LadderProps {
  /** The current composition frame, as from `useCurrentFrame()`. */
  frame: number;
  /**
   * The region every wipe travels across, in the coordinate space the levels
   * are drawn in. Draw it wider than the object: a graphite stroke overshoots
   * its endpoints and wobbles off its own line, and a bbox drawn tight shears
   * both off the moment a wipe mounts.
   */
  bbox: Rect;
  /**
   * One renderer per fidelity level, lowest first. Each takes the current
   * frame, because the bottom level typically draws itself on; every level
   * above it arrives by wipe and is free to ignore it.
   */
  levels: readonly ((frame: number) => React.ReactNode)[];
  /** The wipes between them. Exactly one shorter than `levels`. */
  steps: readonly LadderStep[];
}

/** A staircase of hard edged wipes. See the module doc. */
export const Ladder: React.FC<LadderProps> = ({ frame, bbox, levels, steps }) => {
  if (steps.length !== levels.length - 1) {
    throw new Error(
      `Ladder: ${levels.length} levels need ${levels.length - 1} steps, got ${steps.length}. ` +
        `A missing step is a level the climb can never reach.`,
    );
  }
  for (let i = 1; i < steps.length; i += 1) {
    const previous = steps[i - 1];
    const end = previous.at + (previous.duration ?? PENCIL_FRAMES.convert);
    if (steps[i].at < end) {
      throw new Error(
        `Ladder: step ${i} starts at ${steps[i].at}, before step ${i - 1} ends at ${end}. ` +
          `Only one wipe may be in flight, or a level is skipped on screen.`,
      );
    }
  }

  let active = -1;
  for (let i = 0; i < steps.length; i += 1) {
    if (frame >= steps[i].at) active = i;
  }

  if (active === -1) return <g>{levels[0](frame)}</g>;

  const step = steps[active];
  return (
    <Convert
      frame={frame}
      start={step.at}
      duration={step.duration ?? PENCIL_FRAMES.convert}
      bbox={bbox}
      direction={step.direction ?? 'down'}
      graphite={levels[active](frame)}
      ink={levels[active + 1](frame)}
    />
  );
};
