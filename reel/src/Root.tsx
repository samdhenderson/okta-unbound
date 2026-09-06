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
import { CARDS } from './comp/cards';
import { PIECES } from './pieces';
import { piecePreview } from './pieces/Preview';
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

/**
 * The registries' keys, hoisted so the composition list below is a plain map.
 *
 * `Object.keys` widens to `string[]`, which would lose the id types that make
 * `PIECES[id]` and `CARDS[id]` check; the assertion restores what the `as
 * const satisfies` on each registry already guarantees.
 */
const PIECE_IDS = Object.keys(PIECES) as (keyof typeof PIECES)[];
const CARD_IDS = Object.keys(CARDS) as (keyof typeof CARDS)[];

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
      A preview composition per set piece, derived from the registry rather
      than listed here. This was a hand-kept list of tuples, and `PIECES` had
      grown two entries past it: `exploded-plates` and `placeholder` were
      registered and unpreviewable, which is to say the two pieces most likely
      to be under construction were the two nobody could look at. Deriving is
      the only version of this that cannot fall behind. (ADR-0074 3.)
    */}
    {PIECE_IDS.map((id) => (
      <Composition
        key={`piece-${id}`}
        id={`piece-${id}`}
        component={piecePreview(id)}
        durationInFrames={PIECES[id].frames}
        fps={FRAME.fps}
        width={FRAME.width}
        height={FRAME.height}
      />
    ))}
    {/* The film's furniture, same shape, same reasoning. */}
    {CARD_IDS.map((id) => (
      <Composition
        key={id}
        id={id}
        component={CARDS[id].component}
        durationInFrames={CARDS[id].frames}
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
