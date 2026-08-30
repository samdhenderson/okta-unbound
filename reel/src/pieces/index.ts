/**
 * @module reel/pieces
 * @description The set pieces, and the registry a script names them through.
 *
 * A set piece is a synthetic composition that takes the frame while the panel
 * is gone: the product's own components recreated at 2x to 6x, exploded,
 * counted, compared. `SCRIPT.md`, "The synthetic layer", carries the three
 * rules it is held to - every figure comes from the capture, a synthetic object
 * is never mistakable for a screenshot, and the footage carries every claim of
 * capability. A piece dramatises what the camera just did; it never stands in
 * for the doing.
 *
 * A piece is addressed by id from `script.ts`, the same way a chapter is
 * addressed by id from `Root.tsx`, and for the same reason: `defaultProps` on a
 * `<Composition>` are serialized to JSON and every function in them is silently
 * dropped, so a component handed through the script as a value would arrive
 * missing. An id survives the round trip.
 *
 * ## Why a length is a literal and never a computation
 *
 * `Reel.tsx` builds `CHAPTERS` at module scope, which means every act's length
 * is resolved while the bundle is being evaluated, before any composition
 * renders. A piece whose length came from a manifest read, a figure lookup, or
 * a measurement would therefore be able to throw during module evaluation - and
 * that failure takes down the whole bundle, so the studio shows one error page
 * instead of the nine chapters that were fine. `capture()` and `figure()` throw
 * by design; that is exactly why neither may be on the path to a piece's
 * length. Each piece exports its frames as a constant, and the registry reads
 * the constant.
 */
import type { FC } from 'react';
import type { Manifest } from '../captures';
import type { Rect } from '../layout';
import { ExplodedPlates, EXPLODED_PLATES_FRAMES } from './ExplodedPlates';
import { Ledger, LEDGER_FRAMES } from './Ledger';
import { Placeholder, PLACEHOLDER_FRAMES } from './Placeholder';

/** What every set piece is handed. */
export interface PieceProps {
  /** The piece's own id, so a piece can name itself on camera when that is the point. */
  id: PieceId;
  /** The piece's whole slot, in frames. Its own exit is timed against this. */
  frames: number;
  /** The rectangle to draw into: the `focus` stage's plot, since the panel is gone. */
  plot: Rect;
  /**
   * The footage this piece dramatises, for its figures.
   *
   * A piece plays none of these frames - it is on the dark stage with the panel
   * away - but every number it prints has to be one the rig read off the panel
   * on camera. That is the first rule of the synthetic layer, and passing the
   * manifest rather than loose values is what keeps `figure()`'s refusal in the
   * path: an unread key fails the render instead of printing a number nobody
   * measured.
   */
  manifest: Manifest;
}

/** One entry in the registry: what to render, and how long it runs. */
export interface Piece {
  component: FC<PieceProps>;
  /** Frames. A literal from the piece's own module - see this file's module doc. */
  frames: number;
}

/** Every set piece the script may name. */
export const PIECES = {
  /** B1, after the Users chapter's `cause` beat: the cause card, exploded. */
  'exploded-plates': { component: ExplodedPlates, frames: EXPLODED_PLATES_FRAMES },
  ledger: { component: Ledger, frames: LEDGER_FRAMES },
  /** Still registered: the slots B2 and B3 will take are placeholders until they are built. */
  placeholder: { component: Placeholder, frames: PLACEHOLDER_FRAMES },
} as const satisfies Record<string, Piece>;

/** A set piece with a component behind it. */
export type PieceId = keyof typeof PIECES;

/** Look a piece up, or fail naming what the film does have. */
export function piece(id: PieceId): Piece {
  const found = PIECES[id];
  if (!found) {
    throw new Error(`No set piece "${id}". Known: ${Object.keys(PIECES).join(', ')}`);
  }
  return found;
}
