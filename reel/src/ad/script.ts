/**
 * @module reel/ad/script
 * @description The advertisement's cut: nine shots, in order, with their sound.
 *
 * The film's `script.ts` is a director's document - scenes, acts, beat plans,
 * marks, a ramp over real footage. This is a much smaller thing on purpose: an
 * ad has no footage to retime and no argument to build, so its cut is a list of
 * ids, the holds it disagrees with the stab about, and where the sound lands.
 *
 * ## Why the order is this order
 *
 * The first three shots are a claim, and the next three are the proof. `hook`
 * is the viewer's own week, `arrive` says where the product lives (the single
 * most misunderstood thing about it), and `why` shows the one screen no
 * competitor has. Then `compare`, `predict` and `fix` are the same story told
 * three ways: found it, tested it, fixed it. `prove` exists because half of this
 * work ends in an auditor's inbox, `trust` because the viewer will have to
 * defend the install to somebody, and `end` because an ad that does not say what
 * to do next has wasted the other seventeen seconds.
 *
 * ## Retuning it
 *
 * A shot's `holds` are seconds, by the stab's own cue names, exactly as the
 * film's set-piece holds work: the stab states the pacing it was built at and
 * the cut gets to disagree without opening the component. A name that is not a
 * cue is ignored rather than throwing, because a throw on the length path takes
 * down the bundle.
 */
import type { StabId } from './stabs';
import type { SoundName } from './sfx';

/** One sound, cued on one of the stab's own cue names. */
export interface Cued {
  /** A cue name from the stab's tempo sheet. An unknown name plays nothing. */
  cue: string;
  /** Which sound. An id the generator has not rendered plays nothing. */
  sound: SoundName;
  /** Playback gain, `1` being the recipe's own level. */
  gain?: number;
  /** Frames after the cue, for a sound that should land just behind its picture. */
  delay?: number;
}

/** One shot of the ad. */
export interface Shot {
  stab: StabId;
  /** Per-cue hold overrides in seconds, by cue name. The cut's opinion, not the stab's. */
  holds?: Record<string, number>;
  /** What this shot sounds like. */
  sound?: readonly Cued[];
}

/**
 * The cut.
 *
 * Roughly eighteen seconds, which is the length a store page listing will
 * actually be watched to the end of. Every shot is between one and three
 * seconds; nothing here is allowed to become a scene.
 */
export const AD: readonly Shot[] = [
  {
    stab: 'hook',
    sound: [
      { cue: 'ask', sound: 'impact' },
      { cue: 'ask', sound: 'drop', gain: 0.9 },
      { cue: 'tabs', sound: 'tick', gain: 0.7 },
      { cue: 'dim', sound: 'swell', gain: 0.5 },
    ],
  },
  {
    stab: 'arrive',
    sound: [
      { cue: 'dock', sound: 'whoosh' },
      { cue: 'focus', sound: 'click', gain: 0.7 },
      { cue: 'pinned', sound: 'tick', gain: 0.6 },
    ],
  },
  {
    stab: 'why',
    sound: [
      { cue: 'roster', sound: 'click', gain: 0.6 },
      { cue: 'mark', sound: 'impact', gain: 0.8 },
      { cue: 'beat', sound: 'latch', gain: 0.7 },
    ],
  },
  {
    stab: 'compare',
    sound: [
      { cue: 'card', sound: 'whoosh', gain: 0.6 },
      { cue: 'clause', sound: 'swell', gain: 0.6 },
      { cue: 'resolved', sound: 'swell', gain: 0.7 },
      { cue: 'mark', sound: 'impact' },
    ],
  },
  {
    stab: 'predict',
    sound: [
      { cue: 'arm', sound: 'click' },
      { cue: 'preview', sound: 'swell' },
      { cue: 'count', sound: 'impact', gain: 0.9 },
      { cue: 'consequence', sound: 'drop', gain: 0.6 },
    ],
  },
  {
    stab: 'fix',
    sound: [
      { cue: 'field', sound: 'click', gain: 0.7 },
      { cue: 'edit', sound: 'swell', gain: 0.8 },
      { cue: 'save', sound: 'click' },
      { cue: 'land', sound: 'latch' },
    ],
  },
  {
    stab: 'prove',
    sound: [
      { cue: 'report', sound: 'click', gain: 0.6 },
      { cue: 'columns', sound: 'tick', gain: 0.8 },
      { cue: 'arm', sound: 'click' },
      { cue: 'rows', sound: 'swell' },
    ],
  },
  {
    stab: 'trust',
    sound: [{ cue: 'lines', sound: 'impact', gain: 0.7 }],
  },
  {
    stab: 'end',
    sound: [
      { cue: 'mark', sound: 'impact' },
      { cue: 'cta', sound: 'latch', gain: 0.9 },
    ],
  },
];
