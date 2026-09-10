/**
 * @module reel/ad/sfx
 * @description The advertisement's sound, and the one rule about how it is cued.
 *
 * **An effect is cued on a cue name, never on a frame.** `script.ts` says
 * `{ cue: 'mark', sound: 'impact' }`, and `Ad.tsx` resolves that through the
 * same {@link stabSheet} the stab itself drew from. So a hold retuned in the cut
 * moves the picture and the sound together, by construction, and there is no
 * second place where the number 47 is written down.
 *
 * That is worth the indirection because audio drift is the hardest kind of
 * mistake to see in a still and the easiest to hear: a whoosh four frames after
 * the panel lands does not look wrong on any contact sheet, and sounds broken
 * immediately.
 *
 * The WAVs are build output under `captures/sfx/`, rendered by
 * `scripts/make-sfx.mjs` from `sfx.json`. An id the generator has not written
 * resolves to `undefined` and plays nothing, so a cut can name a sound that does
 * not exist yet without failing a render.
 */
import { staticFile } from 'remotion';
import { SFX } from '../sfx.generated';

/** Every sound the generator has rendered. */
export type SoundName = keyof typeof SFX;

/** One sound's measured length in seconds, or `undefined` if it was never rendered. */
export function sfxSeconds(name: SoundName): number | undefined {
  return (SFX as Record<string, { file: string; seconds: number }>)[name]?.seconds;
}

/**
 * The clip source for one sound, or `undefined` if it has not been rendered.
 *
 * Resolves through `staticFile` against `captures/sfx/` exactly the way
 * `voClip` resolves narration and `clip` resolves footage: the public dir is
 * pointed at `../captures` in `remotion.config.ts`, so this reads the build's
 * own output directory rather than a copy of it.
 */
export function sfxClip(name: SoundName): string | undefined {
  const entry = (SFX as Record<string, { file: string; seconds: number }>)[name];
  return entry ? staticFile(`sfx/${entry.file}`) : undefined;
}
