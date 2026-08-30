/**
 * @module reel/comp/Overture
 * @description The film's opening, as one continuous move.
 *
 * The console you work in today is drawn full-frame in graphite. The extension
 * arrives from the right and squeezes it narrower. The panel is drawn, and then
 * climbs out of graphite into the real thing. The console retracts and goes.
 * The film writes its name beside what is left. Then the panel pushes out of
 * frame, and the premise card takes over.
 *
 * ## Why this is one component and not three cards
 *
 * It used to be three: `ColdOpen`, `TitleCard` and `PremiseCard`, each a
 * self-contained composition with a hard cut between them. The cuts were the
 * problem. `ColdOpen` drew the console at 1740 wide and `TitleCard` drew a
 * *different* console at 1240 wide with the panel already docked beside it, so
 * the cut between them was a jump between two drawings of the same room at two
 * sizes. Nothing squeezed, because nothing could: the console's size was a
 * constant inside each file rather than a thing either shot could animate.
 *
 * `comp/Console` fixed the mechanism (its rect is a prop and every interior
 * coordinate derives from it) and this file is what the mechanism was for. The
 * console is one object for the whole opening, and the squeeze is the panel
 * taking room from it rather than a cut hiding the difference.
 *
 * ## The seam keeps `ColdOpen`'s timing exactly
 *
 * The film carries a 4px accent seam at the frame's right edge, hoisted above
 * every chapter by `Reel.tsx` so it outlives them. This shot draws its own, at
 * the same x and on the same cues the cold open used, so the handover into the
 * chapters is the same pixels either side of the cut.
 *
 * That the seam and the panel's outer edge coincide is the point rather than a
 * collision. {@link PANEL_RECT} runs to the frame's right edge, so once the
 * panel lands, the seam *is* its leading edge - which is what the seam was
 * introduced to be.
 *
 * ## No `<Sequence>`, anywhere in here
 *
 * Every cue below is an absolute composition frame and every child takes its
 * frame as a prop or an offset. Remotion's `<Sequence>` remaps
 * `useCurrentFrame()` to zero inside it, which does not throw - it silently
 * freezes whatever it wraps on that child's first pose. On a shot this long
 * that is a full second of a still image with nothing to point at.
 */
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Console, CONSOLE_RETRACT } from './Console';
import { DrawnTitle } from './TitleCard';
import { Convert, GRAPHITE, Stroke, draw } from '../pencil';
import { PanelInk, PANEL_INK_FRAMES, PANEL_INK_RECT } from './PanelInk';
import { EASING } from '../verbs';
import type { Rect } from '../layout';
import { FRAME, STAGE } from '../theme';

/**
 * The console's two rectangles: full frame, and squeezed to make room.
 *
 * `wide` is `ColdOpen`'s `CONSOLE` unchanged, so the opening frames of this
 * shot and of the old cold open are the same drawing.
 *
 * `narrow` is 1104 rather than a rounder number because the console's own
 * measured floor decides it. `comp/Console` records `MIN_CONTENT_W = 700`: the
 * nav column does not reflow under a squeeze (a real console clips its nav, it
 * does not reshape it), so the whole 636px loss comes out of the content
 * column, and the longest string in the drawing sits in the narrowest card.
 * 1104 leaves the content column at 818 - clear of the floor with room that a
 * later copy change can eat into without the cards colliding.
 */
const CONSOLE_RECT = {
  wide: { x: 88, y: 104, width: 1740, height: 872 } as Rect,
  narrow: { x: 88, y: 104, width: 1104, height: 872 } as Rect,
} as const;

/**
 * Where the panel lands: a browser side panel, full frame height, bleeding off
 * the top and bottom and docked to the right edge.
 *
 * Full height rather than the capture's 840x980 aspect, and that is a
 * deliberate divergence from how the chapters draw the panel. A chapter shows
 * it as a 720x840 rounded card on the *left* at x=76, because a chapter is a
 * presentation of the panel. This shot is the panel arriving in a browser
 * window, and a side panel in a browser window is full height and pushes the
 * page over. The two never have to reconcile: the panel leaves frame before
 * chapter one starts and re-enters at its own home.
 *
 * The 48px gap to {@link CONSOLE_RECT}.narrow is air, not a rule. Nothing is
 * drawn in it.
 */
export const PANEL_RECT: Rect = PANEL_INK_RECT;

/**
 * The wipe region for anything converting inside the panel.
 *
 * Deliberately larger than {@link PANEL_RECT} on every side. A pencil stroke
 * overshoots its nominal endpoints and wobbles off its own line, so a bbox
 * drawn tight to the panel shears both off the moment a wipe mounts, which
 * reads as the drawing being trimmed rather than converted. This is the one
 * piece of geometry knowledge carried over from the card this shot replaces.
 */
export const PANEL_WIPE: Rect = {
  x: PANEL_RECT.x - 30,
  y: -30,
  width: PANEL_RECT.width + 60,
  height: FRAME.height + 60,
};

/**
 * Every cue in the shot, as absolute composition frames.
 *
 * Read this table top to bottom and you have the shot. Nothing below computes a
 * cue from another cue except where one move must not start before another
 * finishes, and those cases say so.
 */
const CUE = {
  /** The console draws itself on. `CONSOLE_CUE` runs 2 to 206, plus a 22f stroke. */
  consoleDone: 228,
  /** The seam, on `ColdOpen`'s own numbers. See the module doc. */
  seamDraw: 246,
  seamConvert: 278,
  /** The panel arrives and the console gives up the room. */
  squeeze: 300,
  squeezeOver: 26,
  /**
   * The panel's fidelity ramp begins: `comp/PanelInk` draws itself in graphite
   * and then climbs three wipes into the solid recreation. Its cues are offsets
   * from this frame, so the whole climb moves by moving this one number.
   */
  panel: 332,
  /**
   * The console withdraws, and **not before the panel is solid**.
   *
   * `PANEL_INK_FRAMES` is 252, so the climb finishes at `panel + 252` = 584.
   * Retracting earlier would take the console away while the panel was still a
   * drawing, which inverts the shot's argument: the world is supposed to stay a
   * drawing until the product has finished becoming real, and then leave
   * because it has been answered. This is the one ordering in the file that is
   * load-bearing rather than a matter of pacing.
   */
  retract: 590,
  /** The title is written into the space the console left. */
  title: 660,
  /** The panel pushes out to the right, and the premise card follows. */
  exit: 890,
  exitOver: 26,
} as const;

/**
 * The whole shot's length, as a literal.
 *
 * Every length in this film is a literal rather than a sum of its cue table,
 * and for a reason that is not style: `Reel.tsx` builds `CHAPTERS` at module
 * scope, so a length derived from anything that can throw takes the entire
 * bundle down rather than the one composition that wanted it. A literal cannot
 * fail. It is also a budget the edit is held to - a computed length silently
 * absorbs a cue that overruns instead of failing against the script.
 *
 * 930f = 15.5s. Against the 1080f the two type cards it replaces cost, plus the
 * premise card's 660 which is unchanged, the film's opening grows by 510 frames
 * - about 8.5 seconds.
 */
export const OVERTURE_FRAMES = 930;

/**
 * The frame the seam has finished converting on, for `Reel.tsx`'s hoisted one.
 *
 * The film carries exactly one seam, drawn over everything by `Reel.tsx` so it
 * outlives every cut. This shot draws its *own* because the seam has to be
 * introduced by the pencil - graphite first, then converted - and the hoisted
 * component cannot do that: it arrives by extending from mid-height, which is
 * right for a line that already exists and wrong for one being invented.
 *
 * So the hoisted seam waits, and takes over here. Both are 4px of `STAGE.accent`
 * at the same x, so the handover is invisible by construction rather than by
 * matching two curves. Left at its `arriveAt` default of 0 the hoisted seam
 * would instead grow in on the film's first frame, over a console that has not
 * been drawn yet, and the overture's own draw would land on a line already
 * there - two seams, one of them arriving twice.
 */
export const SEAM_LANDED = CUE.seamConvert + 22;

/** The film's opening. See the module doc. */
export const Overture: React.FC = () => {
  const frame = useCurrentFrame();

  // The one ordering in this shot that is load-bearing rather than pacing, so
  // it is checked rather than left to the comment on `CUE.retract`. Inside the
  // component and not at module scope on purpose: a module-scope throw takes
  // `Reel.tsx`'s whole chapter list down with it, and the studio then shows one
  // error page instead of the other nine chapters.
  if (CUE.retract < CUE.panel + PANEL_INK_FRAMES) {
    throw new Error(
      `Overture: the console retracts at ${CUE.retract}, before the panel finishes ` +
        `becoming real at ${CUE.panel + PANEL_INK_FRAMES}. The world may not leave ` +
        `while the product is still a drawing.`,
    );
  }

  // The squeeze. One interpolation, on the entrance curve, driving the
  // console's width directly - which is the whole reason `Console` takes a
  // rect rather than owning one.
  const squeezeT = interpolate(frame, [CUE.squeeze, CUE.squeeze + CUE.squeezeOver], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASING.entrance,
  });
  const consoleRect: Rect = {
    ...CONSOLE_RECT.wide,
    width:
      CONSOLE_RECT.wide.width + (CONSOLE_RECT.narrow.width - CONSOLE_RECT.wide.width) * squeezeT,
  };

  // The panel travels in from off the right edge on the same curve, so it
  // arrives exactly as the room for it appears. It leaves the same way.
  const panelIn = interpolate(
    frame,
    [CUE.squeeze, CUE.squeeze + CUE.squeezeOver],
    [FRAME.width - PANEL_RECT.x, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASING.entrance },
  );
  const panelOut = interpolate(
    frame,
    [CUE.exit, CUE.exit + CUE.exitOver],
    [0, FRAME.width - PANEL_RECT.x],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASING.exit,
    },
  );

  const pSeam = draw(frame, CUE.seamDraw, 26);

  return (
    <AbsoluteFill style={{ background: STAGE.back, color: STAGE.ink }}>
      <svg
        width={FRAME.width}
        height={FRAME.height}
        viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Console
          rect={consoleRect}
          frame={frame}
          retract={{ at: CUE.retract, span: CONSOLE_RETRACT.span }}
        />

        <g transform={`translate(${panelIn + panelOut}, 0)`}>
          <PanelInk frame={frame} from={CUE.panel} />
        </g>

        {/* The seam: drawn in graphite top to bottom, then converted downward
            into the film's accent. Same x and same cues as the cold open. */}
        <Convert
          frame={frame}
          start={CUE.seamConvert}
          duration={22}
          bbox={{ x: FRAME.width - 8, y: -20, width: 16, height: FRAME.height + 40 }}
          direction="down"
          graphite={
            <Stroke
              x1={FRAME.width - 2}
              y1={0}
              x2={FRAME.width - 2}
              y2={FRAME.height}
              p={pSeam}
              amplitude={0.6}
              color={GRAPHITE.primary}
            />
          }
          ink={
            <rect x={FRAME.width - 4} y={0} width={4} height={FRAME.height} fill={STAGE.accent} />
          }
        />
      </svg>

      <DrawnTitle from={CUE.title} />
    </AbsoluteFill>
  );
};

/** The studio's preview. Identical to what ships; the shot needs no stand-in. */
export const OverturePreview: React.FC = () => <Overture />;
