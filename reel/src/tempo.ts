/**
 * @module reel/tempo
 * @description Named cues instead of derived frame constants: a set piece's
 * choreography, written down.
 *
 * ## The problem this replaces
 *
 * A set piece used to open with a wall of absolute frame constants - 18 of them
 * in `ExplodedPlates`, 21 in `Ledger`, 26 in `Unpacking` - and a separate
 * hand-typed total:
 *
 * ```ts
 * const DOCK_AT = 0;   const LIFT_AT = 34;  const SPLIT_AT = 54;
 * const BAND_AT = 80;  const BAND_OUT = 164; const CLOSE_AT = 186;
 * export const EXPLODED_PLATES_FRAMES = 222;
 * ```
 *
 * Every one of those numbers is a sum somebody worked out once, and **every
 * pause in the piece is an implicit subtraction** the reader has to perform:
 * how long the plates stay apart is `CLOSE_AT - SPLIT_AT - 19`, which appears
 * nowhere. So "hold the split a beat longer before it rejoins" meant retuning
 * four constants by hand, fixing the total separately, and hoping nothing else
 * keyed off the old numbers. Nothing checked the arithmetic, and a piece whose
 * cues overran its total simply stopped playing the end of itself.
 *
 * A sheet says the same choreography as a sequence of **named cues**, each
 * starting where the last one finished:
 *
 * ```ts
 * const SHEET = tempo({
 *   dock:   { verb: 'dock' },
 *   lift:   { verb: 'lift', gap: 12 },
 *   split:  { verb: 'split', hold: 5 },   // the plates stay apart 5 seconds
 *   rejoin: { verb: 'split', frames: 12 },
 *   settle: { hold: 4 },                  // and rest 4 seconds before the cut
 *   out:    { verb: 'recede' },
 * });
 * ```
 *
 * `SHEET.at.split` is the frame the split opens on and `SHEET.frames` is the
 * piece's length. Nobody adds anything up, the holds are stated rather than
 * implied, and changing one moves everything after it.
 *
 * ## Two units, and why they are not the same unit
 *
 * `gap` is in **frames** and `hold` is in **seconds**, deliberately.
 *
 * A gap is spacing between two moves - the 12 frames between the card arriving
 * and it lifting - and it is read against the verb budgets on either side of
 * it, which are 13 to 26 frames. Written in seconds it would be `0.2` and
 * comparable to nothing. A hold is a pause the viewer actually experiences, the
 * thing an editor asks for in the language of the cut ("hold it five seconds"),
 * and at 60fps writing that as `300` buries the intent in arithmetic. So each
 * quantity is stated in the unit the person choosing it is thinking in.
 *
 * ## It cannot throw
 *
 * This matters more here than it looks. `Reel.tsx` builds its chapter table at
 * **module scope**, so every act's length resolves while the bundle evaluates,
 * and anything that can throw on that path takes down the whole bundle - one
 * error page instead of the compositions that were fine. That is why a piece's
 * length was required to be a bare literal.
 *
 * `tempo()` is safe to sit on that path because it is **total**: it reads no
 * manifest, no figure and no capture, only plain numbers and a `VerbName` that
 * a typo makes a type error rather than a runtime lookup miss. A cue naming a
 * `with` target that has not been defined yet resolves to the current cursor
 * rather than failing. There is no input to this function that produces an
 * exception, which is what lets a piece export `SHEET.frames` directly and stop
 * maintaining its length by hand.
 */
import { FRAME } from './frame';
import { VERBS } from './verbs/registry';
import type { VerbName } from './verbs/registry';

/** Seconds to whole frames at the film's rate. */
const seconds = (value: number): number => Math.round(value * FRAME.fps);

/** One moment in a piece's choreography. */
export interface Cue<K extends string = string> {
  /**
   * The verb this cue runs. Its length comes from the registry, so a cue never
   * restates a budget the grammar already owns.
   */
  verb?: VerbName;
  /**
   * How long this cue's own motion runs, in frames.
   *
   * Overrides {@link verb}'s budget when both are given - which is how a
   * modifier of a verb is expressed, like a rejoin that closes faster than the
   * split opened. A cue with neither is a pure pause and runs zero frames of
   * its own.
   */
  frames?: number;
  /** Frames of stillness before this cue starts. Spacing between two moves. */
  gap?: number;
  /**
   * Seconds to hold after this cue's motion finishes, before the next one.
   *
   * The editorial pause, and the one thing in a piece that is worth naming: it
   * is what an act is doing when it is doing nothing, and it used to exist only
   * as the difference between two constants.
   */
  hold?: number;
  /**
   * Start at the same frame as an earlier cue instead of after it, for two
   * things that move together.
   *
   * Names a cue **defined above this one**, and combines with {@link gap}:
   * `{ with: 'split', gap: 26 }` starts 26 frames after the split did. That is
   * how a second track - bands sliding out from behind the plates while the
   * plates are apart - is written without it becoming the thing the main track
   * has to be measured against.
   *
   * A forward reference has no start yet and is treated as "now", because
   * resolving it properly would mean either two passes or an exception, and an
   * exception is not available on this code path - see the module doc.
   */
  with?: K;
}

/** A resolved sheet: where every cue lands, and how long the whole thing runs. */
export interface Sheet<K extends string> {
  /** The absolute frame each cue starts on. */
  at: Record<K, number>;
  /** The frame each cue's own motion finishes on, before its hold. */
  end: Record<K, number>;
  /** Each cue's resolved hold, in frames. */
  held: Record<K, number>;
  /** The whole piece, in frames. This is what a piece exports as its length. */
  frames: number;
}

/**
 * Resolve a set piece's choreography into absolute frames.
 *
 * Cues run in declaration order - object key order is insertion order for
 * string keys, which is what makes the sheet read top to bottom as the piece
 * plays.
 *
 * @param cues The choreography, in order.
 * @param holds Per-cue hold overrides in seconds, by cue name. This is how a
 *   script tunes a piece's pacing without opening the component: the piece
 *   states the holds it thinks are right, and the cut gets to disagree. Names
 *   that are not cues are ignored rather than throwing, since the overrides
 *   arrive from `script.ts` as data.
 */
export function tempo<K extends string>(
  cues: Record<K, Cue<NoInfer<K>>>,
  holds?: Partial<Record<string, number>>,
): Sheet<K> {
  const at = {} as Record<K, number>;
  const end = {} as Record<K, number>;
  const held = {} as Record<K, number>;

  /** The frame the next cue starts on, unless it says otherwise. */
  let cursor = 0;

  for (const name of Object.keys(cues) as K[]) {
    const cue = cues[name];
    const anchor = cue.with === undefined ? undefined : at[cue.with as K];
    const start = (anchor ?? cursor) + (cue.gap ?? 0);
    const own = cue.frames ?? (cue.verb ? VERBS[cue.verb].frames : 0);
    const hold = seconds(holds?.[name] ?? cue.hold ?? 0);

    at[name] = start;
    end[name] = start + own;
    held[name] = hold;

    // `Math.max` rather than assignment, so a cue running alongside an earlier
    // one cannot pull the sheet backwards when it finishes first.
    cursor = Math.max(cursor, start + own + hold);
  }

  // Plus one, and the one matters. A verb starting at `f` with a budget of `n`
  // reaches its final pose *on* frame `f + n`, and a piece of N frames renders
  // 0 through N-1 - so a piece sized at `cursor` never renders the frame its
  // last verb completes on. The last thing the film showed still had the object
  // on it at about 17 percent, composited over the first frame of the footage
  // the piece cut back to. Every piece used to carry its own `- 1` against its
  // own total to work around that, each one rediscovering it by rendering the
  // last frame rather than by reading the arithmetic. It is accounted for once,
  // here, for every sheet.
  return { at, end, held, frames: cursor + 1 };
}

/**
 * How much longer a piece runs once a script's hold overrides are applied.
 *
 * The cut needs a piece's length before it renders anything - `Reel.tsx`
 * resolves every act's length at module scope - so it cannot ask the component.
 * A piece registers its default sheet, and this replays the same arithmetic
 * over the overrides to get the new total. Same function, same rounding, so the
 * two cannot disagree.
 */
export function tempoFrames<K extends string>(
  cues: Record<K, Cue<NoInfer<K>>>,
  holds?: Partial<Record<string, number>>,
): number {
  return tempo(cues, holds).frames;
}
