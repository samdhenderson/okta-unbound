/**
 * @module reel/comp/TitleCard
 * @description The title, written by hand onto a frame the overture has
 * already built. Step 5 of the opening: the console has retracted, the solid
 * panel is alone at the right, and the film says its name.
 *
 * ## What this file used to be, and why it is not that any more
 *
 * It used to be the whole of C1: a browser tab sketched in graphite, a panel
 * docked along its edge, a `pencil/Convert` wipe turning that panel from
 * drawing into product, and then the type *docking* in over the result. All of
 * that except the type has moved into the overture - the single continuous
 * opening that draws the console full-frame, brings the panel in from the
 * right, climbs it up a fidelity ladder, and retracts the console away. Those
 * shots own the geometry now (`comp/Overture`, `comp/Console`, and the panel
 * components beside them), so `TAB`, `PANEL`, `WIPE`, the placeholder rows, the
 * `SketchBox` fact frames and the `Convert` are all gone from here rather than
 * left behind disabled.
 *
 * What changed about the type is not only where it lives. It used to arrive as
 * finished type sliding into place - `verbs/Dock`, the grammar's verb for a
 * populated UI element taking its position. It is now *written*, glyph edge by
 * glyph edge, through `pencil/Written`. The overture spends four moves
 * establishing that this world is drawn by a hand; a title that arrived already
 * set would be the one object in the opening that nobody made.
 *
 * ## Knowledge carried over from the card this replaces
 *
 * `DesignDocs/design_handoff_title_animation/` is explicit that it is "a
 * general idea, not a spec". These four rejections were recorded on the old
 * card and still bind whatever draws the title:
 *
 * - **The pencil tip.** A visible graphite tick travelling along the wordmark's
 *   reveal edge. It is the treatment's highest cheesiness risk - the moment the
 *   metaphor stops being a texture and starts being a cartoon - and cutting it
 *   is also what keeps this cue short. `Written`'s clip edge does the same
 *   narrative work with nothing drawn at the edge itself.
 * - **The solidify crossfade.** As authored it ran `inkIn` up while `pencilOut`
 *   ran down for 19 frames, two renderings of the same object both visible for
 *   most of them. That is a crossfade between synthetic objects, which this
 *   film never does. It is not needed here at all - by the time this cue starts
 *   the panel is already solid - but the rule is what stops it coming back.
 * - **Roughly ten raw opacity ramps** (`claimIn`, `factAText`, `factBText`,
 *   `labelIn` and friends). Nothing fades up. Every block below is revealed by
 *   a clip rect whose width grows; no block's opacity is ever animated.
 * - **The camera settle.** A continuous 1.016 to 1.0 zoom held across the whole
 *   piece. On a flat backdrop with 1px hairlines that does not read as a slow
 *   push, it reads as crawl, and nothing in the grammar authorises it. There is
 *   no camera move here and the type does not move once written.
 *
 * The handoff's `feTurbulence`/`feDisplacementMap` wobble is also gone
 * film-wide; see `pencil/wobble.ts`. Geometry wobble is cacheable and does not
 * creep sub-pixel between frames.
 *
 * One more piece of hard-won geometry knowledge, recorded here because the code
 * that needed it has moved and the trap has not: **a `Convert` bbox must be
 * drawn larger than the object it wipes.** A pencil stroke overshoots its
 * nominal endpoints by `over` px and wobbles off its own line by `amplitude`
 * px, so a bbox drawn tight to the panel shears those overshoots off the moment
 * the wipe mounts, which reads as the drawing being trimmed rather than
 * converted. The old card used panel-30/-30 by panel+30/frame+60. Whoever owns
 * the fidelity ladder now owns that margin.
 *
 * ## The seam is not drawn here
 *
 * The film carries a 4px accent seam at the frame's right edge, hoisted above
 * every chapter so it outlives them (`comp/Seam`). This cue is composed knowing
 * it will be drawn over: nothing load-bearing sits in the rightmost pixels.
 *
 * ## No `<Sequence>`, ever
 *
 * Every cue below is an absolute composition frame offset from the `from` prop.
 * Remotion's `<Sequence>` remaps `useCurrentFrame()` to zero, which does not
 * throw - it silently freezes the whole cue on its first pose. `from` is a
 * number this component adds to, and that is deliberately the only mechanism.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { GRAPHITE, Written, draw } from '../pencil';
import { FRAME, INTER, STAGE, TYPE } from '../theme';

/**
 * This cue's length, in frames. 216f = 3.6s at 60fps.
 *
 * A literal, not a sum of the cue table below, for the same reason every other
 * length in this film is: the number is a budget the edit is held to, and a
 * computed one silently absorbs any cue that overruns instead of failing
 * loudly against the script.
 *
 * About 1.6s of writing and 2.0s of hold. The hold is not padding - it is the
 * reading time a wordmark, a two-line claim and two privacy facts need when
 * there is no narration to carry them.
 */
export const DRAWN_TITLE_FRAMES = 216;

/**
 * Where the solid panel is assumed to stand when this cue runs.
 *
 * **FLAGGED ASSUMPTION - another agent owns the real number.** The panel's
 * rect is set by the overture's fidelity ladder, not here, and nothing in this
 * file reads it. 1240 is taken from the old card's docked panel (its left edge
 * sat at 1360) minus room for the wider panel the overture squeezes the console
 * around. All this file does with it is stay left of it: the type column below
 * is placed against {@link COLUMN}, and the only thing that breaks if the real
 * panel edge moves is how much air sits between the claim's longest line and
 * the panel. If the panel lands left of ~1180, the claim needs re-breaking, not
 * re-positioning.
 */
const ASSUMED_PANEL_LEFT = 1240;

/**
 * The type column: left margin, and the rightmost pixel the type may reach.
 *
 * The old card hung its type at x=214 because it was writing *inside* a
 * sketched browser tab that started at x=120. There is no tab by the time this
 * cue runs - the console has retracted and gone - so the column is placed
 * against the frame instead, on the film's own left margin (76, matching
 * `layout.INDEX.x`) plus a step, and it is given the whole of the empty half of
 * frame to breathe in.
 */
const COLUMN = {
  x: 152,
  /** A hard limit, checked by eye at render: nothing written may cross it. */
  right: ASSUMED_PANEL_LEFT - 96,
} as const;

/**
 * Baselines, top to bottom. `Written` positions on the text baseline, not on a
 * box's top edge, so these are baselines and not `top`s.
 *
 * The block is optically centred against the 1080 frame rather than
 * mathematically centred: the wordmark's 92px cap height carries far more
 * visual weight than the two dim facts at the bottom, so a mathematically
 * centred block sits low. Everything is nudged up accordingly.
 */
const BASELINE = {
  mark: 430,
  claimA: 546,
  claimB: 606,
  factA: 712,
  factB: 754,
} as const;

/**
 * The copy, verbatim. Do not rewrite any of this: the wordmark, the claim's two
 * lines and both privacy facts are the product owner's own wording, and the
 * facts' terminal full stops are deliberate.
 */
const COPY = {
  mark: 'Okta Unbound',
  claim: ['Group and user administration', 'right inside your active session.'],
  facts: ['No external servers.', 'Your data never leaves the browser tab.'],
} as const;

/**
 * Every cue, as an offset from `from` in composition frames, paired with how
 * long that block takes to write.
 *
 * Durations scale with how much there is to write rather than being one
 * constant: `Written` reveals at a uniform rate across its measured width, so a
 * 12-character wordmark and a 39-character fact given the same budget would be
 * written by two different hands at two different speeds. `pencil/draw`'s 22f
 * default is the length of *one stroke*, which is why nothing here uses it
 * unchanged.
 *
 * The claim's second line starts before the first has finished. That is how a
 * hand writes a sentence that runs over a line break - it does not pause at the
 * break - and it is what keeps the whole cue under two seconds of writing.
 */
const CUE = {
  mark: { at: 0, over: 38 },
  claim: [
    { at: 34, over: 30 },
    { at: 52, over: 30 },
  ],
  facts: [
    { at: 74, over: 20 },
    { at: 84, over: 26 },
  ],
} as const;

/**
 * How the title is set.
 *
 * ## Why this is graphite and not ink
 *
 * The first version set all three blocks in `STAGE.ink`, which rendered a
 * finished, solid, product-coloured wordmark wiped in from the left. That is
 * the docked title with a different entrance, and it breaks the rule the whole
 * overture is built on: `pencil/draw` may only touch something the product has
 * not made yet. The panel beside this type has just climbed the fidelity ladder
 * and become real. The title is not part of the product - it is the film's own
 * voice, naming the thing - so it stays a drawing, and the contrast between a
 * solid panel and a hand-written name beside it is the film's thesis stated in
 * one frame rather than argued.
 *
 * It also bracket-matches: the console that opened the film was graphite, and
 * the end card returns the tab outline to graphite. The title belongs to that
 * layer, not to the panel's.
 *
 * The facts drop to `GRAPHITE.second` - the lighter second pass, the hand going
 * back over its own line - because they are supporting evidence and want to sit
 * behind the claim without changing material.
 */
const SET = {
  /**
   * The wordmark is the film's largest type and its only 700, and the only
   * block big enough to need {@link WrittenProps.perGlyph}: at 92px a single
   * travelling clip edge spends several frames bisecting one letter, which is
   * visibly a mask rather than a hand. Measured on `Okta Unbound`, the edge sat
   * mid-`d` for four frames.
   */
  mark: { size: TYPE.chapter, weight: 700, color: GRAPHITE.primary, perGlyph: true },
  claim: { size: TYPE.claim, weight: 600, color: GRAPHITE.primary, perGlyph: true },
  /**
   * The facts keep the single travelling edge. They are set at `TYPE.body`,
   * inside the range the edge was designed for, and per-glyph on a 39-character
   * line reads as a teleprinter rather than a hand.
   */
  fact: { size: TYPE.body, weight: 400, color: GRAPHITE.second },
} as const;

/**
 * The title, written.
 *
 * ## Why there is no `letterSpacing` here
 *
 * The docked version set the wordmark at `letterSpacing: -3` and the claim at
 * `-0.9`, which is right for type that arrives finished. It is wrong for type
 * that is being revealed, and not merely as taste: `pencil/Written` measures
 * its reveal width with `measureText`, which has no tracking term at all. Under
 * negative tracking the measurement runs wide of the rendered text by roughly
 * one tracking step per glyph - about 36px across `Okta Unbound` at -3 - so the
 * clip finishes its travel with visible dead space after the last letter, and
 * the wordmark appears to stop being written a beat before the animation ends.
 * Inter's own metrics at 700 are tight enough at 92px that dropping the
 * tracking costs very little, and the alternative (teaching `Written` about
 * tracking) is a change to a shared primitive that several cues depend on.
 */
export interface DrawnTitleProps {
  /**
   * The absolute composition frame this cue begins on. Never a `<Sequence>`
   * offset - see the module doc.
   */
  from: number;
}

/** The title, written onto whatever the overture has already put on screen. */
export const DrawnTitle: React.FC<DrawnTitleProps> = ({ from }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ fontFamily: INTER }}>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
        <Written
          x={COLUMN.x}
          y={BASELINE.mark}
          text={COPY.mark}
          p={draw(frame, from + CUE.mark.at, CUE.mark.over)}
          {...SET.mark}
        />

        {COPY.claim.map((line, i) => (
          <Written
            key={line}
            x={COLUMN.x}
            y={i === 0 ? BASELINE.claimA : BASELINE.claimB}
            text={line}
            p={draw(frame, from + CUE.claim[i].at, CUE.claim[i].over)}
            {...SET.claim}
          />
        ))}

        {COPY.facts.map((fact, i) => (
          <Written
            key={fact}
            x={COLUMN.x}
            y={i === 0 ? BASELINE.factA : BASELINE.factB}
            text={fact}
            p={draw(frame, from + CUE.facts[i].at, CUE.facts[i].over)}
            {...SET.fact}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * The studio's preview of the cue.
 *
 * This component draws nothing of the world, by design - in the film it is
 * written over a frame the overture has already built. So the preview supplies
 * a stand-in for that frame: the stage's backdrop, and a flat plate at
 * {@link ASSUMED_PANEL_LEFT} standing where the solid panel will be. Both exist
 * only so the placement can be judged while scrubbing; neither is imported by
 * anything, and neither is what ships.
 */
export const DrawnTitlePreview: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE.back }}>
    <div
      style={{
        position: 'absolute',
        left: ASSUMED_PANEL_LEFT,
        top: 0,
        width: FRAME.width - ASSUMED_PANEL_LEFT,
        height: FRAME.height,
        background: STAGE.plate,
        borderLeft: `1px solid ${STAGE.rule}`,
      }}
    />
    <DrawnTitle from={0} />
  </AbsoluteFill>
);
