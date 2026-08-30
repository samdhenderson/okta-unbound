/**
 * @module reel/Root
 * @description Compositions: the whole reel, and one per chapter.
 *
 * Per-chapter compositions are not a convenience. They are how the dev loop
 * gets short: opening `chapter-attributes` in the studio scrubs twenty seconds
 * of one argument instead of ninety of everything, and rendering it produces a
 * standalone clip for docs without a second pipeline.
 */
import React from 'react';
import { AbsoluteFill, Composition } from 'remotion';
import { SCRIPT } from './script';
import { Chapter, chapterLength } from './comp/Chapter';
import { LedgerPreview, LEDGER_FRAMES } from './pieces/Ledger';
import { UnpackingPreview, UNPACKING_FRAMES } from './pieces/Unpacking';
import { TitleCardPreview, TITLE_CARD_FRAMES } from './comp/TitleCard';
import { ColdOpenPreview, COLD_OPEN_FRAMES } from './comp/ColdOpen';
import { PremiseCardPreview, PREMISE_CARD_FRAMES } from './comp/PremiseCard';
import { SeamPreview } from './comp/Seam';
import { REEL_FRAMES, Reel } from './comp/Reel';
import { Verbs, VERBS_FRAMES } from './comp/Verbs';
import { FRAME } from './theme';

/**
 * Delivery size, and why it is a composition rather than a `--scale` flag.
 *
 * The brief asks for 2560x1440 out of a 1920x1080 design space. That is a
 * factor of exactly 4/3, which has no finite decimal form, and Remotion
 * requires integer output dimensions: `--scale=1.3333` yields 1439.964 and
 * `stitchFramesToVideo` rejects it. No decimal fixes that, because 4/3 is not
 * one.
 *
 * So the scale-up is a CSS transform inside a composition that is already the
 * delivery size. The transform takes a float happily, the output dimensions are
 * integers by construction, and because the whole page is rasterised at
 * 2560x1440 the type, hairlines and SVG stay sharp exactly as `--scale` would
 * have made them. The video is upscaled either way.
 */
const DELIVERY = { width: 2560, height: 1440 } as const;

const Delivery: React.FC = () => (
  <AbsoluteFill>
    <div
      style={{
        width: FRAME.width,
        height: FRAME.height,
        transform: `scale(${DELIVERY.width / FRAME.width})`,
        transformOrigin: 'top left',
      }}
    >
      <Reel />
    </div>
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
    <Composition
      id="reel-delivery"
      component={Delivery}
      durationInFrames={REEL_FRAMES}
      fps={FRAME.fps}
      width={DELIVERY.width}
      height={DELIVERY.height}
    />
    <Composition
      id="reel"
      component={Reel}
      durationInFrames={REEL_FRAMES}
      fps={FRAME.fps}
      width={FRAME.width}
      height={FRAME.height}
    />
    <Composition
      id="verbs"
      component={Verbs}
      durationInFrames={VERBS_FRAMES}
      fps={FRAME.fps}
      width={FRAME.width}
      height={FRAME.height}
    />
    {/*
      Preview compositions for work in flight. Registered ahead of the work so
      six authors can build six files in parallel without racing on this one.
      Each entry points at a props-free `*Preview` wrapper, because Remotion
      serialises `defaultProps` to JSON and silently drops anything that is not.
    */}
    {(
      [
        ['piece-ledger', LedgerPreview, LEDGER_FRAMES],
        ['piece-unpacking', UnpackingPreview, UNPACKING_FRAMES],
        ['card-title', TitleCardPreview, TITLE_CARD_FRAMES],
        ['cold-open', ColdOpenPreview, COLD_OPEN_FRAMES],
        ['card-premise', PremiseCardPreview, PREMISE_CARD_FRAMES],
        ['seam', SeamPreview, 60],
      ] as const
    ).map(([id, component, durationInFrames]) => (
      <Composition
        key={id}
        id={id}
        component={component}
        durationInFrames={durationInFrames}
        fps={FRAME.fps}
        width={FRAME.width}
        height={FRAME.height}
      />
    ))}
    {SCRIPT.map((scene) => (
      <Composition
        key={scene.id}
        id={`chapter-${scene.id}`}
        component={Chapter}
        defaultProps={{ id: scene.id }}
        durationInFrames={chapterLength(scene)}
        fps={FRAME.fps}
        width={FRAME.width}
        height={FRAME.height}
      />
    ))}
  </>
);
