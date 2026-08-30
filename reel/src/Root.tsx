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
