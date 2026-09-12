/**
 * @module reel/ad/Ad
 * @description The advertisement, assembled.
 *
 * Twelve stabs in a `<Series>`, each in its own sequence, each with its sound
 * cued off the same tempo sheet the stab drew itself from.
 *
 * ## Why a stab is not wrapped a second time
 *
 * `<Series.Sequence>` already remaps `useCurrentFrame()` to start at 0 on the
 * stab's first frame, and that is the clock every verb in `reel/verbs` is
 * authored against. A further `<Sequence>` inside a stab would remap it again to
 * 0 and the stab would free-run its own animation from the beginning on every
 * frame, silently, rendering its first pose forever with nothing to point at.
 * This is the film's set-piece rule and it applies here identically; see
 * `verbs/useVerb.ts`'s module doc.
 *
 * The one exception is the audio below, which is *supposed* to be shifted: an
 * `<Audio>` inside a `<Sequence from={n}>` starts n frames in, which is exactly
 * how a cue is scheduled. No verb is inside those sequences.
 *
 * ## Lengths resolve at module scope
 *
 * {@link AD_FRAMES} is computed while the bundle evaluates, so nothing on the
 * path to it may throw: `stabFrames` goes through `tempo()`, which is total.
 * The film learned this the expensive way (`pieces/index.ts`'s module doc) and
 * the ad inherits the rule rather than rediscovering it.
 */
import React from 'react';
import { AbsoluteFill, Audio, Sequence, Series } from 'remotion';
import { FRAME, STAGE } from '../theme';
import { AD } from './script';
import type { Cued } from './script';
import { stab, stabFrames, stabSheet } from './stabs';
import { sfxClip, sfxSeconds } from './sfx';

/** One shot, with everything the renderer needs already resolved. */
interface Shot {
  id: string;
  component: React.FC<{ frames: number }>;
  frames: number;
  /** Cue name to its frame within this shot. */
  at: Record<string, number>;
  sound: readonly Cued[];
}

const SHOTS: Shot[] = AD.map((shot) => ({
  id: shot.stab,
  component: stab(shot.stab).component,
  frames: stabFrames(shot.stab, shot.holds),
  at: stabSheet(shot.stab, shot.holds).at,
  sound: shot.sound ?? [],
}));

/** The whole ad, in frames. Derived, never authored. */
export const AD_FRAMES = SHOTS.reduce((total, shot) => total + shot.frames, 0);

/**
 * The sound for one shot: an `<Audio>` per cue, each in a sequence that starts
 * on the cue's own frame.
 *
 * A cue naming something the stab's sheet does not have, or a sound the
 * generator has not rendered, draws nothing. Both are deliberately silent
 * rather than fatal: the first is a cut being edited, the second is an ad being
 * scored, and neither is worth failing a render over.
 */
const ShotSound: React.FC<{ shot: Shot }> = ({ shot }) => (
  <>
    {shot.sound.map((cued, i) => {
      const at = shot.at[cued.cue];
      const src = sfxClip(cued.sound);
      const seconds = sfxSeconds(cued.sound);
      if (at === undefined || src === undefined || seconds === undefined) return null;
      const from = at + (cued.delay ?? 0);
      return (
        <Sequence
          key={`${cued.cue}-${cued.sound}-${i}`}
          from={from}
          durationInFrames={Math.ceil(seconds * FRAME.fps)}
        >
          <Audio src={src} volume={cued.gain ?? 1} />
        </Sequence>
      );
    })}
  </>
);

/**
 * The advertisement.
 */
export const Ad: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE.back }}>
    <Series>
      {SHOTS.map((shot, i) => {
        const Stab = shot.component;
        return (
          <Series.Sequence key={`${shot.id}-${i}`} durationInFrames={shot.frames}>
            <Stab frames={shot.frames} />
            <ShotSound shot={shot} />
          </Series.Sequence>
        );
      })}
    </Series>
  </AbsoluteFill>
);
