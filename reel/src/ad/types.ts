/**
 * @module reel/ad/types
 * @description What every stab is handed, in its own module.
 *
 * Separate from `stabs/index.ts` so a stab can import the type without importing
 * the registry that imports it back. The film's `PieceProps` lives in its
 * registry and gets away with it because nothing else in that file is imported
 * by a piece; the ad's registry also carries the ad's cue names, which the stabs
 * do need, so the cycle would be real here rather than hypothetical.
 */

/** What a stab is handed. */
export interface StabProps {
  /**
   * The stab's whole slot, in frames.
   *
   * Every stab is rendered inside its own `<Series.Sequence>`, so its own clock
   * starts at 0 and this is where it ends. A stab that wants to leave before the
   * cut (rare in an ad, where the cut *is* the exit) times its own exit against
   * this rather than against a constant it would have to keep in sync.
   */
  frames: number;
}
