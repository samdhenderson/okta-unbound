/**
 * @module reel/comp/Opening
 * @description How the film introduces itself: the overture, then the premise.
 *
 * Two movements. `comp/Overture` is one continuous shot - the console you work
 * in today drawn by hand, the extension arriving from the right and squeezing
 * it, the panel climbing out of graphite into the real thing, the console
 * withdrawing, the film writing its name, the panel pushing out of frame.
 * `comp/PremiseCard` follows: three claims about environmental decay that
 * become facts as the product's own measurements land on them.
 *
 * ## What this file used to be
 *
 * Two type cards. A centred headline on a backdrop, and a `Margin` slide with a
 * headline and two points, both arriving on a spring. They said the right
 * things and they looked like every other slide in the film, which was the
 * problem: the opening asserted the film's claim in the same voice the chapters
 * use to demonstrate it, so there was nothing to distinguish the argument from
 * its evidence.
 *
 * **No copy was lost in the replacement, and this is worth checking rather than
 * trusting.** The title card's wording is in `comp/TitleCard`'s `COPY`. The
 * premise headline and its two points are in `comp/PremiseCard`, with the line
 * carrying two claims ("Stale mapping rules." and "Manual attribute typos.")
 * split onto a plate each, because a plate holds one claim and one exhibit.
 * Every string the old cards displayed is still displayed.
 *
 * ## Why the overture must be the film's first sequence
 *
 * Every cue in `Overture` is an absolute composition frame, and it is rendered
 * inside `Reel.tsx`'s `<Series>`, which remaps `useCurrentFrame()` to zero at
 * each sequence's start. That is harmless only because the opening is first, so
 * its zero and the film's zero are the same frame. Insert anything before it
 * and every cue in the overture silently shifts - no error, just a shot that
 * plays its console draw over the thing that now precedes it.
 *
 * The premise card is the opposite case: its cues are relative to its own start
 * and it *wants* the remap, which is why the two sit in separate sequences here
 * rather than sharing one clock.
 */
import React from 'react';
import { Series } from 'remotion';
import { Overture, OVERTURE_FRAMES } from './Overture';
import { PremiseCard, PREMISE_CARD_FRAMES } from './PremiseCard';

/**
 * The whole opening, before the first chapter.
 *
 * A sum of two literals, which is the one computed length this film allows:
 * neither operand can throw, so `Reel.tsx` can safely use it at module scope.
 * 930 + 660 = 1590f, 26.5s.
 */
export const OPENING_FRAMES = OVERTURE_FRAMES + PREMISE_CARD_FRAMES;

/** The film's opening. See the module doc. */
export const Opening: React.FC = () => (
  <Series>
    <Series.Sequence durationInFrames={OVERTURE_FRAMES}>
      <Overture />
    </Series.Sequence>
    <Series.Sequence durationInFrames={PREMISE_CARD_FRAMES}>
      <PremiseCard />
    </Series.Sequence>
  </Series>
);
