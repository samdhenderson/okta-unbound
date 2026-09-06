/**
 * @module reel/pieces/Preview
 * @description One preview wrapper for every set piece, derived rather than
 * written per piece.
 *
 * A set piece takes `PieceProps` - an id, its frame budget, the plot it draws
 * into and the manifest its figures come from - and a `<Composition>` cannot
 * supply those, because Remotion serialises `defaultProps` to JSON and drops
 * every function and every non-JSON value in them. So each piece needed a
 * props-free wrapper before it could be looked at in isolation, and each
 * wrapper was written by hand.
 *
 * Three things went wrong with that, all of them the same thing:
 *
 * - Two of the four registered pieces (`exploded-plates`, `placeholder`) never
 *   got a wrapper, so the two pieces most likely to be under construction were
 *   the two that could not be previewed.
 * - Both wrappers that did exist passed `id="placeholder"`, copied from
 *   whichever was written first. A piece is handed its own id so it can name
 *   itself on camera; both were being handed the wrong one.
 * - Every wrapper restated the same four props.
 *
 * All three are the cost of writing by hand what the registry already knows.
 * Every prop here is derived: the id is the key, the frames come from `PIECES`,
 * the plot is the `focus` stage's - the stage a piece plays on by definition,
 * since a piece is what happens when the panel is gone - and the manifest comes
 * from the act that names the piece. (ADR-0074 §3.)
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { capture, type CaptureId } from '../captures';
import { STAGES } from '../layout';
import { SCRIPT } from '../script';
import { STAGE } from '../theme';
import { PIECES, type PieceId } from './index';

/**
 * The capture a preview falls back to when no act names the piece.
 *
 * A piece that is registered but not yet cut into the film has no act to take
 * a manifest from, and `placeholder` and `unpacking` are both in that state
 * today - one is scaffolding, the other is built but its slot was cut. They
 * are still worth looking at, so the preview borrows footage rather than
 * refusing to render.
 *
 * This is a preview affordance and nothing more. It never reaches the film:
 * `Chapter` renders a piece with the manifest its own `PieceAct.from` names,
 * so the honesty rule - every figure a piece prints was read off the panel on
 * camera - is enforced where it matters, by the act, not here.
 */
const FALLBACK_CAPTURE: CaptureId = 'users-fix';

/**
 * Which footage a piece's figures come from, according to the script.
 *
 * The first act that names the piece wins. A piece cut into the film twice
 * from different captures would be a script that means two different things by
 * one id, which the preview cannot resolve and should not guess at; the first
 * is the one the film reaches first.
 */
export function previewCapture(id: PieceId): CaptureId {
  for (const scene of SCRIPT) {
    for (const act of scene.acts) {
      if (act.kind === 'piece' && act.piece === id) return act.from;
    }
  }
  return FALLBACK_CAPTURE;
}

/**
 * Build a props-free preview component for one registered piece.
 *
 * A factory rather than a component taking an `id` prop, for the reason this
 * whole file exists: `<Composition>` would have to pass that prop through
 * `defaultProps`, and the point is to need none.
 */
export function piecePreview(id: PieceId): React.FC {
  const { component: Piece, frames } = PIECES[id];
  const Preview: React.FC = () => (
    <AbsoluteFill style={{ background: STAGE.back }}>
      <Piece
        id={id}
        frames={frames}
        plot={STAGES.focus.plot}
        manifest={capture(previewCapture(id))}
      />
    </AbsoluteFill>
  );
  Preview.displayName = `PiecePreview(${id})`;
  return Preview;
}
