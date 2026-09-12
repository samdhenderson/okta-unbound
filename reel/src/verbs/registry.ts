/**
 * @module reel/verbs/registry
 * @description Every verb the film has, and the only place its timing is declared.
 *
 * `DesignDocs/REEL DESIGN AND REWORK/README.md`, "Section A - the animation
 * grammar", names the verbs and gives each a fixed frame budget and a fixed
 * curve. This table is that grammar, made into data.
 *
 * ## Why one table and not four
 *
 * A verb's timing used to be spread across a flat `FRAMES` bag in `ease.ts`
 * (`dockTotal`, `dockOpacity`, `splitDeltaBarAt`, `fanStagger`, ...), a private
 * `VERBS` map in `useVerb.ts` holding five of the seven, a `VerbName` union,
 * and a hand-timed row in `comp/Verbs.tsx`. Nothing tied those together, so the
 * flat bag's keys drifted into three different naming conventions for the same
 * idea (`dockTotal` vs `lift` vs `fanTotal`), a verb could hold a budget in one
 * place and no curve in another, and the demo matrix could label a verb with a
 * duration it no longer ran at. Adding a verb meant five edits in four files
 * and there was no gate that noticed a missed one.
 *
 * Here a verb is **one entry that cannot be half declared**: its total, its
 * curve, its named sub-windows and its stagger, together. {@link VerbName}
 * derives from the table, `FRAMES` in `ease.ts` is a flat *view* over it rather
 * than a second declaration, `comp/Verbs.tsx` reads its labels from it, and
 * `check-verbs.mjs` fails a verb that is registered but not exported or not
 * demoed. Adding a verb is now the component file plus one entry here.
 *
 * ## Sub-windows are named, not arithmetic
 *
 * `split`'s delta bar strikes in at frame 14 of the 19 and runs 5. That used to
 * be two loose `FRAMES` keys the component added to its own `from` by hand, in
 * two places, and the same shape recurred in every verb that has an internal
 * moment. A {@link VerbPart} states the window once, relative to the verb's own
 * start, and {@link useVerbPart} resolves it - so a component never computes a
 * sub-window and a reader never has to check whether `at` is absolute or
 * relative.
 *
 * ## The two verbs that are not driven by a single progress
 *
 * Both are recorded here rather than silently absent, because "this verb is
 * special" is exactly the kind of fact that goes stale when it lives only in a
 * comment somewhere else.
 *
 * - **`count`** carries a `compound` note: its roll (`standard`) and its settle
 *   (`affirm`) are two curves over two windows with a per-column stagger on
 *   top, which is more than one `[0, 1]` number can carry. `Count.tsx` reads
 *   the parts directly instead of calling {@link useVerb}.
 * - **`draw`** and its `convert` modifier are the graphite treatment's, and
 *   live in `reel/pencil` with `PENCIL_FRAMES`. They are governed by a rule
 *   none of these six carry - `draw` only ever applies to something the product
 *   has not made yet - and shipping them beside the treatment is what keeps
 *   that rule enforceable. They are deliberately not in this table; see
 *   `verbs/index.ts`.
 */
import { EASING, framesFor } from './tokens';

/** Which curve a verb runs on, by name. Resolved through {@link EASING}. */
export type EaseName = keyof typeof EASING;

/**
 * A named moment inside a verb, in frames from the **verb's own start**.
 *
 * Relative, always. An `at` measured from the composition's frame 0 would be
 * wrong the moment the verb is cued anywhere but the start of a piece, which is
 * every real use of one.
 */
export interface VerbPart {
  /** Frames after the verb starts. */
  at: number;
  /** How long the window runs. */
  over: number;
}

/** One verb's whole timing. */
export interface Verb {
  /** The verb's total, in frames at {@link FRAME}'s fps. */
  frames: number;
  /** The curve its progress runs on. */
  ease: EaseName;
  /** Named sub-windows, relative to the verb's own start. */
  parts?: Record<string, VerbPart>;
  /** Frames between successive children, for a verb that releases a group. */
  stagger?: number;
  /**
   * Set when a single `[0, 1]` progress cannot drive this verb, with the reason.
   *
   * A verb carrying this is expected to read {@link Verb.parts} itself rather
   * than call {@link useVerb}, and the string says why so the exception reads as
   * a decision rather than as an omission.
   */
  compound?: string;
}

/** The film's verb grammar. */
export const VERBS = {
  /** dock: arrive from an edge. 22f is stated by the verb table, not a token. */
  dock: {
    frames: 22,
    ease: 'entrance',
    parts: {
      /** Opacity 0 to 1 inside the first 8f of the 22. */
      opacity: { at: 0, over: 8 },
    },
  },
  /** lift: this is the object under discussion. 220ms `move`. */
  lift: {
    frames: framesFor('move'),
    ease: 'standard',
    parts: {
      /** The stage dims to 55% over the first 8f of the hold. */
      stageDim: { at: 0, over: 8 },
    },
  },
  /** count: a figure rolls up and settles. 500ms `tell`, then an affirm settle. */
  count: {
    frames: framesFor('tell') + 8,
    ease: 'standard',
    parts: {
      roll: { at: 0, over: framesFor('tell') },
      settle: { at: framesFor('tell'), over: 8 },
    },
    /** Digit columns settle 3f apart, so a wide figure runs past `frames`. */
    stagger: 3,
    compound:
      'roll runs on `standard` and the settle on `affirm`, over two windows, with a ' +
      'per-column stagger on top. Count.tsx reads `parts` directly.',
  },
  /** split: one object becomes two. 320ms `travel`. */
  split: {
    frames: framesFor('travel'),
    ease: 'standard',
    parts: {
      /** The alert delta bar strikes in at f14 of the 19, over 5f. */
      deltaBar: { at: 14, over: 5 },
    },
  },
  /** fan: a stack releases its children. 26f is stated by the verb table. */
  fan: {
    frames: 26,
    ease: 'entrance',
    parts: {
      /** Each child's own release animation. */
      child: { at: 0, over: 14 },
      /** The parent contracts to 0.92 as the first child leaves. */
      contract: { at: 0, over: 6 },
    },
    /** Children are released 4f apart. */
    stagger: 4,
  },
  /** recede: the object goes back. The same 320ms `travel` as split, reversed in shape. */
  recede: {
    frames: framesFor('travel'),
    ease: 'exit',
    parts: {
      /** Opacity 1 to 0 only in the last 6f of the 19. */
      opacity: { at: framesFor('travel') - 6, over: 6 },
    },
  },
  /**
   * snap: arrive hard, in a third of dock's time. 140ms `quick`, on `affirm`.
   *
   * The six verbs from here down were added for the store page advertisement
   * (`src/ad/`), which has to land a dozen ideas in half a minute and cannot
   * afford an arrival built to be read. They are registered here rather than
   * in an ad-local table for the same reason the first six are: a verb with a
   * budget nothing else can see is a number somebody will pick again by eye.
   * The film may use them; it currently does not.
   */
  snap: {
    frames: framesFor('quick'),
    ease: 'affirm',
    parts: {
      /** Opacity 0 to 1 inside the first 4f, so it is legible before it settles. */
      opacity: { at: 0, over: 4 },
    },
  },
  /** stamp: type lands from oversize and out of focus. 220ms `move`, on `affirm`. */
  stamp: {
    frames: framesFor('move'),
    ease: 'affirm',
    parts: {
      /** The flash at contact: the last 5f of the 13. */
      impact: { at: 8, over: 5 },
    },
  },
  /** wipe: a masked reveal travelling across the object. 220ms `move`. */
  wipe: {
    frames: framesFor('move'),
    ease: 'entrance',
    parts: {
      /** The lit hairline riding the leading edge, for the whole travel. */
      edge: { at: 0, over: 13 },
    },
  },
  /** strike: a hairline shoots across the thing it is about. 140ms `quick`. */
  strike: {
    frames: framesFor('quick'),
    ease: 'standard',
    parts: {
      /** The flare on arrival: the last 4f of the 8. */
      flash: { at: 4, over: 4 },
    },
  },
  /** pulse: one beat of emphasis, changing nothing. 220ms `move`, on `affirm`. */
  pulse: {
    frames: framesFor('move'),
    ease: 'affirm',
    parts: {
      /** Out fast. */
      expand: { at: 0, over: 6 },
      /** Back slower, which is what makes it read as a beat. */
      settle: { at: 6, over: 7 },
    },
  },
  /**
   * drag: picked up, carried, put down. The same 320ms `travel` as split.
   *
   * The two windows are the whole verb. A translate with no lift at the head
   * and no settle at the tail reads as an element being repositioned by a
   * layout engine; the same translate with them reads as an object being
   * held. `Drag.tsx` builds one "off the surface" number out of both, because
   * the object has to stay lifted across the middle of the travel and a single
   * `[0, 1]` progress cannot say that.
   */
  drag: {
    frames: framesFor('travel'),
    ease: 'standard',
    parts: {
      /** Off the surface: scale, tilt and shadow up, over the first 5f of the 19. */
      lift: { at: 0, over: 5 },
      /** And back onto it, over the last 5f. */
      settle: { at: framesFor('travel') - 5, over: 5 },
    },
  },
} as const satisfies Record<string, Verb>;

/** Every verb in the grammar, by name. */
export type VerbName = keyof typeof VERBS;

/** A verb's named sub-windows, for a verb that has any. */
export type PartName<V extends VerbName> = (typeof VERBS)[V] extends { parts: infer P }
  ? keyof P
  : never;

/**
 * Look a verb up, or fail naming what the grammar does have.
 *
 * Typed lookups (`VERBS.split`) are the normal path and cannot miss. This is
 * for the places that carry a verb name as data - the demo matrix, a tempo
 * sheet - where a bad name would otherwise surface as `undefined.frames`.
 */
export function verb(name: VerbName): Verb {
  const found: Verb | undefined = VERBS[name];
  if (!found) {
    throw new Error(`No verb "${name}". Known: ${Object.keys(VERBS).join(', ')}`);
  }
  return found;
}
