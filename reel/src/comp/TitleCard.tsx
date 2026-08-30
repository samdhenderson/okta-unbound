/**
 * @module reel/comp/TitleCard
 * @description C1: the pencil title card. The film's geometry drawn as a
 * diagram before it is used as a layout.
 *
 * The film is a panel docked at one edge and an argument beside it. Every
 * chapter assumes that geometry; this is the one place it is *introduced*. So
 * the card draws it: a browser tab you are already inside, sketched in
 * graphite, and a panel docked along its edge. Then the panel - and only the
 * panel - converts out of graphite into the real thing, and the product's own
 * type docks in beside it. The world stays a drawing. The product does not.
 *
 * ## What was cut from the handoff, and why
 *
 * `DesignDocs/design_handoff_title_animation/` is explicit that it is "a
 * general idea, not a spec". Four of its ideas did not survive contact:
 *
 * - **The pencil tip.** A visible graphite tick travelling along the wordmark's
 *   reveal edge. It is the treatment's highest cheesiness risk - the moment the
 *   metaphor stops being a texture and starts being a cartoon - and cutting it
 *   is also what lands the card at 6.9s instead of the handoff's 8.5s.
 * - **The solidify crossfade.** As authored it runs `inkIn` up while
 *   `pencilOut` runs down for 19 frames, with two renderings of the same object
 *   both visible for most of them. That is a crossfade between synthetic
 *   objects, which this film never does. `pencil/Convert` replaces it: one hard
 *   edge, no frame where a pixel shows both.
 * - **Roughly ten raw opacity ramps** (`claimIn`, `factAText`, `factBText`,
 *   `labelIn` and friends). "Nothing fades up" - so every one of those that
 *   carries text is a `dock` instead. The plane's fill is not: a plane arriving
 *   is not an object entering, and the wipe delivers it anyway.
 * - **The camera settle.** A continuous 1.016 to 1.0 zoom held across the whole
 *   piece. On a flat backdrop with 1px hairlines that does not read as a slow
 *   push, it reads as crawl, and nothing in the grammar authorises it.
 *
 * The handoff's `feTurbulence`/`feDisplacementMap` wobble is also gone; see
 * `pencil/wobble.ts` for why. `Stroke`'s `amplitude` does the same job in
 * geometry, which is cacheable and does not creep sub-pixel between frames.
 *
 * ## The seam is not drawn here
 *
 * The film carries a 4px accent seam at the frame's right edge, hoisted above
 * every chapter so it outlives them (`comp/Seam`). This card is composed
 * knowing it will be drawn over: nothing load-bearing sits in the rightmost
 * pixels, and the card draws no seam of its own.
 *
 * Never wrap any of this in Remotion's `<Sequence>` - every cue below is an
 * absolute composition frame, and `<Sequence>` would silently remap them to
 * zero and freeze the card on its first pose.
 */
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Backdrop } from './Backdrop';
import type { Rect } from '../layout';
import { Convert, GRAPHITE, SketchBox, Stroke, Written, draw } from '../pencil';
import { Dock, FRAMES, useVerb } from '../verbs';
import { FRAME, INTER, STAGE, TYPE } from '../theme';

/**
 * This card's length, in frames. 414f = 6.9s at 60fps.
 *
 * The brief allots 7.0s. Cutting the handoff's pencil-tip travel is what buys
 * the last tenth back, so the number is 414 rather than a padded 420: the card
 * ends when it has finished, not when a round number says it has.
 */
export const TITLE_CARD_FRAMES = 414;

/** The tab you are already inside: the world, and it stays a drawing. */
const TAB: Rect = { x: 120, y: 110, width: 1240, height: 860 };

/** The tab's app bar rule. */
const BAR_Y = 184;

/** The panel, docked along the tab's edge and bleeding off the top and bottom of frame. */
const PANEL: Rect = {
  x: TAB.x + TAB.width,
  y: 0,
  width: FRAME.width - (TAB.x + TAB.width),
  height: FRAME.height,
};

/**
 * The wipe's region, deliberately larger than {@link PANEL}.
 *
 * `Convert` clips the graphite side to this box too, and a pencil stroke
 * overshoots its nominal endpoints by `over` px and wobbles off its own line by
 * `amplitude` px. A bbox drawn tight to the panel would shear those overshoots
 * off the moment the wipe mounted, which reads as the drawing being trimmed
 * rather than converted.
 */
const WIPE: Rect = { x: PANEL.x - 30, y: -30, width: PANEL.width + 30, height: FRAME.height + 60 };

/**
 * The panel's placeholder rows, with a descending emphasis down the column.
 *
 * Abstract on purpose: this is a diagram of a panel, not a screenshot of one,
 * and a card that drew plausible-looking rows of fake data would be claiming
 * evidence three seconds before the film has shown any. The opacity ladder is a
 * static rendering weight, not a ramp - it is the diagram convention for "and
 * the list carries on below the fold", which is the one true thing the shape
 * has to say.
 */
const ROWS: readonly (Rect & { weight: number })[] = [
  { x: 1416, y: 240, width: 448, height: 72, weight: 1 },
  { x: 1416, y: 340, width: 448, height: 52, weight: 1 },
  { x: 1416, y: 414, width: 448, height: 52, weight: 0.86 },
  { x: 1416, y: 488, width: 448, height: 52, weight: 0.72 },
  { x: 1416, y: 562, width: 448, height: 52, weight: 0.58 },
  { x: 1416, y: 636, width: 448, height: 52, weight: 0.44 },
  { x: 1416, y: 710, width: 448, height: 52, weight: 0.32 },
  { x: 1416, y: 784, width: 448, height: 52, weight: 0.22 },
] as const;

/** The two privacy facts, each in its own hairline box. */
const FACTS = [
  { box: { x: 214, y: 710, width: 306, height: 68 }, text: 'No external servers.' },
  {
    box: { x: 544, y: 710, width: 562, height: 68 },
    text: 'Your data never leaves the browser tab.',
  },
] as const;

/**
 * Every cue, in absolute composition frames.
 *
 * Read top to bottom this is the card's whole argument: the world is drawn
 * (0 to ~2.5s), the panel becomes real (~2.5 to 3.0s), the product speaks
 * (~3.0 to 4.6s), and the rest is hold - two seconds of settled frame, which is
 * the reading time three lines of copy need when there is no narration.
 */
const CUE = {
  tabTop: 4,
  tabRight: 16,
  tabBottom: 28,
  tabLeft: 40,
  bar: 52,
  annotation: 58,
  seam: 66,
  rows: 74,
  rowStagger: 5,
  panelLabel: 110,
  convert: 152,
  mark: 178,
  claim: 198,
  factBox: [218, 230],
  factText: [244, 256],
  /** The tab recedes at the very end. The panel does not: it becomes chapter one's frame. */
  exit: TITLE_CARD_FRAMES - FRAMES.recede,
} as const;

/** How long a box takes to draw all four of its sides. Four sides in sequence need longer than one stroke. */
const BOX_FRAMES = 30;

/** The wipe's own duration. Longer than `draw`'s 22f because it crosses the full 1080 of frame. */
const CONVERT_FRAMES = 30;

/** The graphite line's unsteadiness, in px. Enough to read as a hand, not enough to read as a fault. */
const SHAKE = 5;

/** Absolutely positioned wrapper for a docking block of type. `Dock` itself is `position: relative`. */
const At: React.FC<{ left: number; top: number; children: React.ReactNode }> = ({
  left,
  top,
  children,
}) => <div style={{ position: 'absolute', left, top }}>{children}</div>;

/**
 * The world: a tab rectangle, its app bar, and a written note naming it.
 *
 * Two passes, the way a hand actually draws - the first lays the line down, the
 * second goes back over it lighter and slightly off-register. Both stay
 * graphite for the whole card; nothing here ever converts, because the browser
 * tab is not the thing this film is selling.
 */
const TabDrawing: React.FC<{ frame: number }> = ({ frame }) => {
  const sides = [
    { x1: TAB.x, y1: TAB.y, x2: TAB.x + TAB.width, y2: TAB.y, at: CUE.tabTop },
    {
      x1: TAB.x + TAB.width,
      y1: TAB.y,
      x2: TAB.x + TAB.width,
      y2: TAB.y + TAB.height,
      at: CUE.tabRight,
    },
    {
      x1: TAB.x + TAB.width,
      y1: TAB.y + TAB.height,
      x2: TAB.x,
      y2: TAB.y + TAB.height,
      at: CUE.tabBottom,
    },
    { x1: TAB.x, y1: TAB.y + TAB.height, x2: TAB.x, y2: TAB.y, at: CUE.tabLeft },
  ];

  return (
    <g>
      <g opacity={0.9}>
        {sides.map((s, i) => (
          <Stroke
            key={i}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            p={draw(frame, s.at)}
            seed={i + 1}
            amplitude={SHAKE}
          />
        ))}
        <Stroke
          x1={TAB.x}
          y1={BAR_Y}
          x2={TAB.x + TAB.width}
          y2={BAR_Y}
          p={draw(frame, CUE.bar, 16)}
          seed={5}
          width={2.2}
          amplitude={SHAKE - 2}
        />
      </g>
      <g opacity={0.5} transform="translate(3 -2)">
        {sides.map((s, i) => (
          <Stroke
            key={i}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            p={draw(frame, s.at)}
            seed={31 + i}
            width={1.4}
            color={GRAPHITE.second}
            over={14}
            amplitude={SHAKE}
          />
        ))}
      </g>
      <Written
        x={TAB.x + 40}
        y={BAR_Y - 22}
        text="the tab you are already signed in to"
        p={draw(frame, CUE.annotation, 44)}
        size={TYPE.label}
        color={GRAPHITE.second}
      />
    </g>
  );
};

/** The panel as the hand drew it: a seam, five placeholder rows, a written label. */
const PanelGraphite: React.FC<{ frame: number }> = ({ frame }) => (
  <g>
    <Stroke
      x1={PANEL.x}
      y1={PANEL.y}
      x2={PANEL.x}
      y2={PANEL.y + PANEL.height}
      p={draw(frame, CUE.seam, 24)}
      seed={6}
      width={4}
      amplitude={SHAKE}
    />
    {ROWS.map((r, i) => (
      <g key={i} opacity={r.weight}>
        <SketchBox
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          p={draw(frame, CUE.rows + i * CUE.rowStagger, BOX_FRAMES)}
          seed={20 + i * 4}
          weight={2.2}
          over={3}
          amplitude={SHAKE - 2.5}
        />
      </g>
    ))}
    <Written
      x={1416}
      y={147}
      text="SIDE PANEL"
      p={draw(frame, CUE.panelLabel, BOX_FRAMES)}
      size={TYPE.label}
    />
  </g>
);

/**
 * The panel once it is real: a plate, hairlines, and the same label set in ink.
 *
 * The label's string, size and weight are identical on both sides of the wipe.
 * They have to be: the wipe is one object changing material, and an edge that
 * crossed from one piece of text to a different one would be a cut disguised
 * as a transition.
 */
const PanelInk: React.FC = () => (
  <g>
    <rect x={PANEL.x} y={PANEL.y} width={PANEL.width} height={PANEL.height} fill={STAGE.plate} />
    <line
      x1={PANEL.x}
      y1={PANEL.y}
      x2={PANEL.x}
      y2={PANEL.y + PANEL.height}
      stroke={STAGE.rule}
      strokeWidth={1}
    />
    {ROWS.map((r, i) => (
      <rect
        key={i}
        x={r.x}
        y={r.y}
        width={r.width}
        height={r.height}
        rx={10}
        fill={STAGE.back}
        stroke={STAGE.rule}
        strokeWidth={1}
        opacity={r.weight}
      />
    ))}
    <text
      x={1416}
      y={147}
      fill={STAGE.inkDim}
      fontFamily={INTER}
      fontSize={TYPE.label}
      fontWeight={400}
    >
      SIDE PANEL
    </text>
  </g>
);

/** The card. */
export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();

  // The exit is `recede`'s own shape, run on SVG geometry rather than on a
  // plate: scale settles down, opacity only moves in the closing 6f. The verb
  // component itself is not usable here because its shadow collapse has no
  // meaning for a 1px hairline, but its timing and curve do.
  const leaving = useVerb('recede', CUE.exit);
  const exitScale = interpolate(leaving, [0, 1], [1, 0.96]);
  const exitOpacity = interpolate(
    frame,
    [TITLE_CARD_FRAMES - FRAMES.recedeOpacityWindow, TITLE_CARD_FRAMES],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const tabCx = TAB.x + TAB.width / 2;
  const tabCy = TAB.y + TAB.height / 2;
  const receding = {
    transform: `translate(${tabCx} ${tabCy}) scale(${exitScale}) translate(${-tabCx} ${-tabCy})`,
    opacity: exitOpacity,
  };

  return (
    <AbsoluteFill style={{ fontFamily: INTER }}>
      <Backdrop focusX={FRAME.width / 2} />

      <AbsoluteFill>
        <svg
          width={FRAME.width}
          height={FRAME.height}
          viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
        >
          <g {...receding}>
            <TabDrawing frame={frame} />
          </g>

          <Convert
            frame={frame}
            start={CUE.convert}
            duration={CONVERT_FRAMES}
            bbox={WIPE}
            direction="down"
            graphite={<PanelGraphite frame={frame} />}
            ink={<PanelInk />}
          />

          {/* The privacy facts' boxes: hairline, crisp, but drawn with a hand's
              overshot corners. `draw` is legitimate on them under its own rule -
              a claim awaiting evidence is exactly what a privacy fact is. */}
          <g {...receding}>
            {FACTS.map((f, i) => (
              <SketchBox
                key={i}
                x={f.box.x}
                y={f.box.y}
                width={f.box.width}
                height={f.box.height}
                p={draw(frame, CUE.factBox[i], BOX_FRAMES)}
                seed={60 + i * 10}
                color={STAGE.rule}
                weight={1}
              />
            ))}
          </g>
        </svg>
      </AbsoluteFill>

      {/* The type. Every block docks; nothing here fades up. */}
      <AbsoluteFill
        style={{
          transform: `scale(${exitScale})`,
          transformOrigin: `${tabCx}px ${tabCy}px`,
          opacity: exitOpacity,
        }}
      >
        <At left={214} top={376}>
          <Dock from={CUE.mark}>
            <div
              style={{
                fontSize: TYPE.chapter,
                fontWeight: 700,
                letterSpacing: -3,
                lineHeight: 1,
                color: STAGE.ink,
              }}
            >
              Okta Unbound
            </div>
          </Dock>
        </At>

        <At left={214} top={532}>
          <Dock from={CUE.claim} rule={false}>
            <div
              style={{
                fontSize: TYPE.claim,
                fontWeight: 600,
                letterSpacing: -0.9,
                lineHeight: 1.28,
                color: STAGE.ink,
              }}
            >
              <div>Group and user administration</div>
              <div>right inside your active session.</div>
            </div>
          </Dock>
        </At>

        {FACTS.map((f, i) => (
          <At key={i} left={f.box.x + 24} top={f.box.y + 20}>
            <Dock from={CUE.factText[i]} rule={false} distance={90}>
              <div style={{ fontSize: TYPE.body, lineHeight: 1, color: STAGE.inkDim }}>
                {f.text}
              </div>
            </Dock>
          </At>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const TitleCardPreview: React.FC = () => <TitleCard />;
