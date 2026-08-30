/**
 * @module reel/pieces/Placeholder
 * @description The set piece that stands in for a set piece.
 *
 * This is scaffolding with a face on it. The plumbing that lets a chapter cut
 * from footage to a synthetic composition and back (`PieceAct` in `script.ts`,
 * `ActPiece` in `comp/Chapter.tsx`, the registry beside this file) landed
 * before any of the three real pieces did, and infrastructure with nothing
 * running through it is infrastructure nobody has seen work. So this renders a
 * plate naming which piece is missing and how long its slot is, which makes a
 * wrong length or a mis-wired act visible in a still rather than in a render
 * three commits later.
 *
 * It is built from the real verbs (`Dock`, `Recede`) rather than from a bare
 * `<div>` on purpose: exercising the actual API is the only way scaffolding
 * proves the thing it is scaffolding for. It is deliberately not designed - a
 * placeholder that looked finished would get left in.
 *
 * Never wrap any of this in Remotion's `<Sequence>`. Every verb is authored in
 * absolute frames and `<Sequence>` remaps `useCurrentFrame()` to 0 inside it,
 * so the piece would hold its first pose for its whole slot, silently, with
 * nothing to point at. See `verbs/useVerb.ts`.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { STAGE, TYPE, FRAMES } from '../theme';
import { Dock, Recede } from '../verbs';
import type { PieceProps } from './index';

/**
 * How long the placeholder runs, as a literal.
 *
 * **Every piece states its length as a constant, never as something computed.**
 * `Reel.tsx` builds `CHAPTERS` at module scope, so a length derived from
 * anything that can throw - a manifest read, a figure lookup, a measurement -
 * takes the whole bundle down rather than the single composition that wanted
 * it, and the studio shows one error page instead of the other nine chapters.
 * A literal cannot fail.
 *
 * 210 frames is 3.5s at 60fps, close to what `SCRIPT.md` budgets the three real
 * pieces, so the cut either side of the slot is timed against something honest.
 */
export const PLACEHOLDER_FRAMES = 210;

/** A field of the plate: a label above the thing it names. */
const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div
      style={{
        fontSize: TYPE.unit,
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        color: STAGE.inkDim,
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: TYPE.claim, fontWeight: 600, color: STAGE.ink }}>{value}</div>
  </div>
);

/**
 * A plate naming the piece nobody has built yet, docked in and receded out so
 * the slot's own entrance and exit run at their real timings.
 *
 * The plate is drawn into `plot` - the same rectangle a showcase gets on the
 * `focus` stage - so the slot occupies the space a real piece will occupy, and
 * a piece that turns out not to fit is a thing to see rather than to imagine.
 */
export const Placeholder: React.FC<PieceProps> = ({ id, frames, plot, manifest }) => (
  <AbsoluteFill>
    <Recede
      // Minus one: a piece of N frames renders 0 through N-1, so a recede
      // ending on frame N leaves the object still visible on the last frame
      // that is actually shown. See ExplodedPlates for the full note.
      from={frames - FRAMES.recede - 1}
      style={{ position: 'absolute', left: plot.x, top: plot.y, width: plot.width }}
    >
      <Dock from={0}>
        <div
          style={{
            boxSizing: 'border-box',
            width: '100%',
            padding: '48px 56px',
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            background: STAGE.plate,
            border: `1px solid ${STAGE.rule}`,
            borderRadius: 16,
          }}
        >
          <div style={{ fontSize: TYPE.body, color: STAGE.accent }}>Set piece not built yet</div>
          <Field label="piece" value={id} />
          <Field label="slot" value={`${frames} frames`} />
          <Field label="dramatises" value={manifest.id} />
        </div>
      </Dock>
    </Recede>
  </AbsoluteFill>
);
