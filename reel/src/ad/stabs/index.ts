/**
 * @module reel/ad/stabs
 * @description The advertisement's shots, and the registry the cut names them through.
 *
 * A **stab** is what the ad has instead of an act: one full frame idea, held for
 * between one and three seconds, cut hard against the next. The film's acts are
 * retimed footage with marks cued on beats; a stab is synthetic from the first
 * pixel and has no footage to be timed against, so the two are deliberately not
 * the same type and do not share a renderer.
 *
 * The shape of this registry is the film's, though, and for the film's reasons
 * (ADR-0074): a stab is addressed by **string id** because `<Composition>`
 * `defaultProps` are serialised to JSON and a component passed as a value would
 * arrive missing; its length is a **literal computed by `tempo()`**, which is
 * total and cannot throw, because `Ad.tsx` resolves every length at module scope
 * and anything that can throw there takes down the whole bundle rather than one
 * composition; and the preview compositions in `AdRoot.tsx` are **derived from
 * this object**, so a stab cannot exist without being viewable.
 *
 * The order the ad plays them in is not here. It is `ad/script.ts`, which names
 * ids out of this object, so a stab can be built and looked at before anybody
 * has decided where in the cut it goes.
 */
import type { FC } from 'react';
import type { Cue, Sheet } from '../../tempo';
import { tempo } from '../../tempo';
import type { StabProps } from '../types';
import { Hook, HOOK_CUES, HOOK_FRAMES } from './Hook';
import { Arrive, ARRIVE_CUES, ARRIVE_FRAMES } from './Arrive';
import { Arrange, ARRANGE_CUES, ARRANGE_FRAMES } from './Arrange';
import { Why, WHY_CUES, WHY_FRAMES } from './Why';
import { Compare, COMPARE_CUES, COMPARE_FRAMES } from './Compare';
import { Weigh, WEIGH_CUES, WEIGH_FRAMES } from './Weigh';
import { Blast, BLAST_CUES, BLAST_FRAMES } from './Blast';
import { Predict, PREDICT_CUES, PREDICT_FRAMES } from './Predict';
import { Fix, FIX_CUES, FIX_FRAMES } from './Fix';
import { Prove, PROVE_CUES, PROVE_FRAMES } from './Prove';
import { Trust, TRUST_CUES, TRUST_FRAMES } from './Trust';
import { End, END_CUES, END_FRAMES } from './End';

/** One entry: what to render, how long it runs at its own pacing, and its cues. */
export interface Stab {
  component: FC<StabProps>;
  /** Frames at the stab's own pacing. A literal from `tempo()`, never a computation that can throw. */
  frames: number;
  /**
   * The stab's tempo sheet.
   *
   * Required here, unlike the film's `PIECES` where it is optional. Two things
   * need it: the cut, to retune a stab's holds without opening its file, and the
   * sound, which takes every effect's frame from the same sheet that drives the
   * picture. A stab with no sheet could not be scored.
   */
  cues: Record<string, Cue>;
}

/** Every stab the ad may name, in no particular order. `script.ts` decides the order. */
export const STABS = {
  /** The question, and the six tabs that will not answer it. */
  hook: { component: Hook, frames: HOOK_FRAMES, cues: HOOK_CUES },
  /** The panel arrives beside the tab you already had open. */
  arrive: { component: Arrive, frames: ARRIVE_FRAMES, cues: ARRIVE_CUES },
  /** Twenty five fields, and you decide which ones matter. */
  arrange: { component: Arrange, frames: ARRANGE_FRAMES, cues: ARRANGE_CUES },
  /** Every row says how it got there. */
  why: { component: Why, frames: WHY_FRAMES, cues: WHY_CUES },
  /** The difference is one character. */
  compare: { component: Compare, frames: COMPARE_FRAMES, cues: COMPARE_CUES },
  /** One field, and everything standing on it. */
  weigh: { component: Weigh, frames: WEIGH_FRAMES, cues: WEIGH_CUES },
  /** Find out what breaks before you break it. */
  predict: { component: Predict, frames: PREDICT_FRAMES, cues: PREDICT_CUES },
  /** Press save, and see who moves before you do. */
  blast: { component: Blast, frames: BLAST_FRAMES, cues: BLAST_CUES },
  /** Fix it where you found it, and watch the rule reread it. */
  fix: { component: Fix, frames: FIX_FRAMES, cues: FIX_CUES },
  /** The evidence walks out as a file. */
  prove: { component: Prove, frames: PROVE_FRAMES, cues: PROVE_CUES },
  /** The three facts that get it installed. */
  trust: { component: Trust, frames: TRUST_FRAMES, cues: TRUST_CUES },
  /** The name, and the one thing to do about it. */
  end: { component: End, frames: END_FRAMES, cues: END_CUES },
} as const satisfies Record<string, Stab>;

/** A stab with a component behind it. */
export type StabId = keyof typeof STABS;

/** Look a stab up, or fail naming what the ad does have. */
export function stab(id: StabId): Stab {
  const found: Stab | undefined = STABS[id];
  if (!found) {
    throw new Error(`No stab "${id}". Known: ${Object.keys(STABS).join(', ')}`);
  }
  return found;
}

/**
 * A stab's sheet with the cut's hold overrides applied.
 *
 * The one accessor both the picture and the sound go through, which is the
 * point: an effect cued on `SHEET.at.mark` and a strike drawn on `SHEET.at.mark`
 * are reading the same number, so retuning a hold moves them together. Sound
 * that drifts from motion is the failure this shape exists to make impossible.
 */
export function stabSheet(id: StabId, holds?: Record<string, number>): Sheet<string> {
  return tempo(stab(id).cues, holds);
}

/** How long a stab runs for one shot, given that shot's hold overrides. */
export function stabFrames(id: StabId, holds?: Record<string, number>): number {
  if (!holds) return stab(id).frames;
  return stabSheet(id, holds).frames;
}
