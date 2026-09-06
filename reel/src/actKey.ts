/**
 * @module reel/actKey
 * @description How an act is named, in one place.
 *
 * An act's key identifies it everywhere outside the composition: it is the
 * narration WAV's filename (`captures/vo/<key>.wav`), the heading in
 * `NARRATION.md`, the id in `plan.generated.json`, and what
 * `npm run reel:look -- --at <key>` resolves.
 *
 * ## Why this is its own file
 *
 * The formula existed three times: in `comp/Chapter.tsx`, which owns act
 * layout; in `vo.ts`, copied deliberately because `Chapter.tsx` imports
 * `voClip` and importing back would have been a cycle; and in
 * `scripts/lib/parse-script.mjs`, because a build script could not import
 * TypeScript at all. Three copies of the rule that decides what a recording is
 * called - and a rename that missed one would not fail a build, it would
 * silently orphan a WAV.
 *
 * A leaf module breaks the cycle instead of duplicating around it: nothing is
 * imported here, so anything may import this. Same reasoning that split
 * `frame.ts` out of `theme.ts`. (ADR-0074 §5.)
 *
 * The build scripts do not import this file directly - they read the key out
 * of `plan.generated.json`, which `emit-plan.mjs` produces by compiling and
 * running the real composition source. So there is one formula, and everything
 * else is downstream of it.
 */

/** The shape of an act this formula needs. Structural, so `Act` satisfies it. */
interface Named {
  kind?: 'film' | 'piece';
  piece?: string;
  capture?: string;
}

/**
 * A stable key for an act within its chapter.
 *
 * The index is part of the key because a chapter may film the same capture
 * twice - `users-fix` is both the third and the sixth act of the Users chapter
 * - and those are two different acts with two different things said over them.
 * A piece has no capture to name, so it names its piece.
 */
export function actKey(act: Named, index: number): string {
  return `${act.kind === 'piece' ? `piece-${act.piece}` : act.capture}-${index}`;
}
