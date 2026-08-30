/**
 * @module reel/comp/Reel
 * @description Every chapter, in order, under one continuous index band.
 *
 * `<Series>` rather than hand-computed offsets: each chapter declares its own
 * length from its ramp, so retiming a beat moves everything after it without a
 * single number changing here.
 *
 * The index band is the exception, and deliberately sits *outside* the series.
 * It is the one piece of furniture that belongs to the film rather than to a
 * chapter, and the only way its progress rule can slide from one chapter to the
 * next is for something that outlives both to draw it. So chapters are rendered
 * with `rail={false}` and one band is drawn over the top of all of them.
 */
import React from 'react';
import { AbsoluteFill, Series, interpolate, useCurrentFrame } from 'remotion';
import { SCRIPT } from '../script';
import { Chapter, actLabelAt, chapterLength, chapterTab } from './Chapter';
import { FilmIndex } from './FilmIndex';
import { END_CARD_FRAMES, EndCard } from './EndCard';
import { OPENING_FRAMES, Opening } from './Opening';

/** Frames the index band takes to hand over from one chapter to the next. */
const SLIDE_FRAMES = 30;

/** Where each chapter starts, and what the band should say while it runs. */
const CHAPTERS = SCRIPT.map((scene, i) => ({
  scene,
  at: i,
  tab: chapterTab(scene),
  from: SCRIPT.slice(0, i).reduce((total, earlier) => total + chapterLength(earlier), 0),
  length: chapterLength(scene),
}));

export const REEL_FRAMES =
  OPENING_FRAMES + CHAPTERS.reduce((total, c) => total + c.length, 0) + END_CARD_FRAMES;

/**
 * The band, driven by the film's own clock rather than any chapter's.
 *
 * Its clock starts at the first chapter, not at the first frame. `CHAPTERS`
 * offsets are relative to the start of the series of chapters, and the opening
 * sits in front of them — so the opening's frames are subtracted here rather
 * than added to every offset above. The band is also hidden across the opening
 * outright: it counts chapters, and the opening is not one.
 */
const Band: React.FC = () => {
  const frame = useCurrentFrame() - OPENING_FRAMES;
  if (frame < 0) return null;
  const index = Math.max(
    0,
    CHAPTERS.reduce((found, c, i) => (frame >= c.from ? i : found), 0),
  );
  const current = CHAPTERS[index]!;
  const before = CHAPTERS[index - 1] ?? current;

  const t = interpolate(frame - current.from, [0, SLIDE_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const slide = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

  // The slate flips at the midpoint rather than crossfading. Two chapter names
  // dissolving through each other is unreadable at this size, and the highlight
  // is already carrying the continuity.
  const shown = slide > 0.5 ? current : before;

  // Out over the end card: the film has stopped being a tour of the product.
  const lastFrame = CHAPTERS[CHAPTERS.length - 1]!;
  const closes = lastFrame.from + lastFrame.length;
  const opacity = interpolate(frame, [closes - 20, closes], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ opacity }}>
      <FilmIndex
        at={before.at + (current.at - before.at) * slide}
        tab={before.tab + (current.tab - before.tab) * slide}
        count={CHAPTERS.length}
        title={shown.scene.title}
        label={actLabelAt(shown.scene, frame - shown.from)}
      />
    </div>
  );
};

export const Reel: React.FC = () => (
  <AbsoluteFill>
    <Series>
      <Series.Sequence durationInFrames={OPENING_FRAMES}>
        <Opening />
      </Series.Sequence>
      {CHAPTERS.map(({ scene, length }) => (
        <Series.Sequence key={scene.id} durationInFrames={length}>
          <Chapter id={scene.id} rail={false} />
        </Series.Sequence>
      ))}
      <Series.Sequence durationInFrames={END_CARD_FRAMES}>
        <EndCard />
      </Series.Sequence>
    </Series>
    <Band />
  </AbsoluteFill>
);
