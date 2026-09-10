/**
 * @module reel/AdRoot
 * @description Compositions for the store page advertisement, and why they are
 * behind their own entry point.
 *
 * `Root.tsx` imports `Reel`, which builds its chapter table at **module scope**
 * from the captures. That is the right design for the film and it means the
 * whole bundle refuses to evaluate when any capture is incomplete: one failed
 * walk takes down every composition in the entry, including ones that never
 * touch footage.
 *
 * The ad has no captures at all. Wiring it into the film's entry would have made
 * a synthetic, capture-free advertisement unrenderable whenever a chapter needed
 * re-shooting, which is a coupling with nothing on the other side of it. So it
 * gets `src/ad-entry.ts`, and the two projects share components, tokens and
 * verbs without sharing a failure mode.
 *
 * Everything else is the film's shape: a delivery composition at 2560x1440
 * scaled by transform (see `Root.tsx` for why a `--scale` flag cannot express
 * 4/3), and one preview composition per stab, derived from the registry rather
 * than hand-listed, because a hand-kept list beside a registry falls behind.
 */
import React from 'react';
import { AbsoluteFill, Composition } from 'remotion';
import { Ad, AD_FRAMES } from './ad/Ad';
import { STABS, stab } from './ad/stabs';
import { FRAME, STAGE } from './theme';

/** Delivery size, matching the film's. See `Root.tsx`'s note on the 4/3 transform. */
const DELIVERY = { width: 2560, height: 1440 } as const;

const Delivery: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE.back }}>
    <div
      style={{
        width: FRAME.width,
        height: FRAME.height,
        transform: `scale(${DELIVERY.width / FRAME.width})`,
        transformOrigin: 'top left',
      }}
    >
      <Ad />
    </div>
  </AbsoluteFill>
);

/** See `Root.tsx`: `Object.keys` widens to `string[]` and loses the id types. */
const STAB_IDS = Object.keys(STABS) as (keyof typeof STABS)[];

/**
 * One stab, previewed on its own.
 *
 * A props-free wrapper per id, not a component passed through `defaultProps`:
 * Remotion serialises those to JSON and silently drops every function in them.
 */
function stabPreview(id: keyof typeof STABS): React.FC {
  const { component: Stab, frames } = stab(id);
  const Preview: React.FC = () => <Stab frames={frames} />;
  return Preview;
}

export const AdRoot: React.FC = () => (
  <>
    <Composition
      id="ad-delivery"
      component={Delivery}
      durationInFrames={AD_FRAMES}
      fps={FRAME.fps}
      width={DELIVERY.width}
      height={DELIVERY.height}
    />
    <Composition
      id="ad"
      component={Ad}
      durationInFrames={AD_FRAMES}
      fps={FRAME.fps}
      width={FRAME.width}
      height={FRAME.height}
    />
    {STAB_IDS.map((id) => (
      <Composition
        key={`stab-${id}`}
        id={`stab-${id}`}
        component={stabPreview(id)}
        durationInFrames={stab(id).frames}
        fps={FRAME.fps}
        width={FRAME.width}
        height={FRAME.height}
      />
    ))}
  </>
);
