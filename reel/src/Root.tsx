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
import { Composition } from 'remotion';
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

export const Root: React.FC = () => (
  <>
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
