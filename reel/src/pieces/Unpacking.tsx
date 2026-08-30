/**
 * @module reel/pieces/Unpacking
 * @description Set piece B3: a finding's count, and the denominator behind it.
 *
 * `SCRIPT.md`, "SET PIECE B3 - The unpacking", after the Home chapter's
 * `findings` beat: "The panel leaves. Three registers at once: the figure
 * `[28]` counting up at 108px, a `[37]`-cell grid where `[28]` cells flip to
 * film accent and prove the proportion, and four of the group names docking in
 * from the right..."
 *
 * Two of those three registers are built here as written. The third is not, and
 * the reason is the synthetic layer's own first rule.
 *
 * ## The names are not on the film, so they are not on the stage
 *
 * `walks/home.mjs` reads nine figures off the panel - `results`, `pinned`,
 * `recent`, `unruled`, `emptyGroups`, `pausedRules`, `groupsTotal`,
 * `reportCount`, `reportNamed` - and every one of them is a number. **No group
 * name was ever captured for this chapter.** The `report` beat, which is where
 * names would have come from, is filmed and not played (`SCRIPT.md`, decisions
 * log), and `reportNamed` records how many rows the report drew, not what any
 * of them said.
 *
 * So "four of the group names docking in from the right with `and 24 more`"
 * cannot be drawn without typing four group names into this file, which is the
 * exact failure - "printing a number nobody measured", in its string form -
 * that `figure()` throws to prevent. The rightward docks are kept, because the
 * beat needs the third register and the frame needs the right-hand half; what
 * they carry is the arithmetic instead of the roster: the count, its
 * complement, the total the two sum to, the proportion that follows, and the
 * sentence the slide ends on. Every number in that column is read or is
 * subtraction over two read numbers.
 *
 * ## The grid is the piece
 *
 * It is the one place in the film a captured denominator is *drawn* rather than
 * written, so both of its numbers come off the capture: `groupsTotal` cells, of
 * which `unruled` are lit. A grid sized by a literal would be a picture of an
 * argument rather than the argument.
 *
 * Countability is the whole design problem, because a texture of 37 squares
 * proves nothing. Three things make the proportion readable in the two seconds
 * this piece has:
 *
 * - **eight to a row, split into blocks of four.** The eye counts fours without
 *   being asked to, so 37 reads as "four rows and a bit" and 28 reads as
 *   "three rows and a block" rather than as an area.
 * - **row-major fill.** The lit cells are the first `unruled` in reading order,
 *   so the lit region is one solid shape and the unlit remainder is one solid
 *   shape. Scattering them would be equally true and unreadable.
 * - **the ledger's swatches are the grid's own cells**, same size, same fill.
 *   The legend is not described, it is the object.
 *
 * The last row is short, and deliberately not padded or hidden: 37 is a prime
 * and the ragged five is what a measured number looks like.
 *
 * ## Not a new verb
 *
 * "The grid fills row by row, then the lit cells flip in one 8f pass" is `dock`
 * per row under a stagger, plus an accent pass whose start is *computed from
 * `count`'s own timing* (`FRAMES.countColumnOffset` + `countRoll` +
 * `countAffirmSettle`) rather than eyeballed against it. The figure lands and
 * the grid answers it.
 *
 * Never wrap any of this in Remotion's `<Sequence>` - every verb here is
 * authored in absolute frames and `<Sequence>` remaps `useCurrentFrame()` to 0
 * inside it, silently freezing the piece at its first pose. See
 * `verbs/useVerb.ts`.
 */
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { figureNumber } from '../captures';
import type { Manifest } from '../captures';
import { FRAMES, INTER, STAGE, TYPE } from '../theme';
import { STAGES } from '../layout';
import { capture } from '../captures';
import { Count, Dock, Recede } from '../verbs';
import { EASING } from '../verbs/ease';
import type { PieceProps } from './index';

/**
 * How long B3 runs, as a literal.
 *
 * 270 frames is 4.5s at 60fps, the budget `SCRIPT.md` gives the piece. **Stated
 * as a constant and never computed** - `Reel.tsx` resolves every act's length at
 * module scope, so a length derived from a manifest read or a figure lookup
 * (both of which throw by design) would take the whole bundle down rather than
 * the one composition that wanted it. See `pieces/index.ts`.
 */
export const UNPACKING_FRAMES = 270;

/* --- The beat sheet, in absolute frames ----------------------------------- */

/** The claim docks in from the left, the edge the panel just left from. */
const HEAD_AT = 0;
/** The figure's own block arrives, showing a resting odometer. */
const FIGURE_AT = 4;
/** The grid fills, one row per `GRID_ROW_STEP`. */
const GRID_AT = 4;
const GRID_ROW_STEP = 7;
/** The digits roll. Late enough that the grid is complete before they settle. */
const COUNT_AT = 14;
/**
 * The accent pass, timed off `count` rather than beside it: the last digit
 * column has settled on the frame the first cell lights.
 */
const ACCENT_AT = COUNT_AT + FRAMES.countColumnOffset + FRAMES.countRoll + FRAMES.countAffirmSettle;
/** The whole pass is 8f: each cell takes `ACCENT_CELL`, the rest is the sweep. */
const ACCENT_PASS = 8;
const ACCENT_CELL = 4;
/** The ledger docks in from the right, one row at a time. */
const LEDGER_AT = 70;
const LEDGER_STEP = 9;
/**
 * Everything leaves together, landing its last frame on the piece's last frame.
 *
 * Minus one, and the one matters: a piece of N frames renders 0 through N-1, so
 * a recede starting at `N - recede` completes on a frame that is never drawn
 * and leaves the object about 17 percent visible on the last frame that is -
 * composited over the first frame of whatever the piece cuts back to.
 */
const RECEDE_AT = UNPACKING_FRAMES - FRAMES.recede - 1;

/* --- Geometry ------------------------------------------------------------- */

/** The left column: the claim, the figure, and the grid under both. */
const LEFT_X = 120;
const HEAD_Y = 226;
const HEAD_W = 1120;
const FIGURE_Y = 376;
/** The figure block's own width, so `dock`'s hairline lands under the figure and its label. */
const FIGURE_W = 560;
const GRID_Y = 596;

/** One cell, and the air around it. `CELL` is also the ledger's swatch size. */
const CELL = 72;
const GUTTER = 16;
/** Eight to a row, in two blocks of four with more air between them. See the module doc. */
const PER_ROW = 8;
const BLOCK = 4;
const BLOCK_GAP = 34;

/** The ledger column: the arithmetic, docking in from the right. */
const LEDGER_X = 1010;
const LEDGER_W = 790;
const LEDGER_Y = 400;
const ROW_H = 76;
const ROW_GAP = 14;
/** The numeral column inside a ledger row, wide enough for the largest figure drawn. */
const NUM_COL = 108;

function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/**
 * Two tokens blended, for a cell mid-flip. Never a third hex, and never a
 * crossfade: this is one object changing colour, not one object over another.
 *
 * Alpha is interpolated alongside the channels because the unlit edge is a
 * washed token rather than a solid one - blending only the channels and
 * leaving the alpha behind would snap the border opaque on the flip's first
 * frame.
 */
function mix(from: string, fromAlpha: number, to: string, toAlpha: number, t: number): string {
  const [r1, g1, b1] = rgb(from);
  const [r2, g2, b2] = rgb(to);
  const at = (a: number, b: number) => Math.round(interpolate(t, [0, 1], [a, b]));
  const alpha = interpolate(t, [0, 1], [fromAlpha, toAlpha]);
  return `rgba(${at(r1, r2)}, ${at(g1, g2)}, ${at(b1, b2)}, ${alpha})`;
}

/**
 * The unlit cell's edge.
 *
 * `STAGE.rule` is the stage's own hairline and it is too faint here: the
 * denominator has to be countable, so an unlit cell has to be as visible as a
 * lit one is emphatic. This is the secondary ink, washed back far enough that
 * nine of them do not compete with twenty eight lit ones.
 */
const UNLIT_ALPHA = 0.42;
const UNLIT_EDGE = mix(STAGE.inkDim, UNLIT_ALPHA, STAGE.inkDim, UNLIT_ALPHA, 0);

/* --- The figures ---------------------------------------------------------- */

/** What this piece is allowed to draw, once it has been proved drawable. */
interface Proportion {
  /** Groups no rule fills. The finding the camera just read. */
  unruled: number;
  /** Every group in the org. The denominator, drawn rather than written. */
  total: number;
  /** The complement: groups a rule does maintain. Subtraction, not a read. */
  ruled: number;
  /** The proportion, to the nearest whole percent. */
  percent: number;
}

/**
 * Read the two figures and prove they can be a proportion, or throw naming what
 * is wrong.
 *
 * `figureNumber()` proves each key was read and is finite. It cannot prove the
 * pair makes sense together, and this piece draws one number *inside* the other:
 * a total that is not a positive whole number has no grid, and a count larger
 * than its total would light cells that do not exist and print a percentage
 * over 100. Both would render, and both would be a claim nobody measured.
 */
function readProportion(manifest: Manifest): Proportion {
  const unruled = figureNumber(manifest, 'unruled');
  const total = figureNumber(manifest, 'groupsTotal');
  if (!Number.isInteger(unruled) || !Number.isInteger(total)) {
    throw new Error(
      `${manifest.id}: the unpacking needs whole groups - got unruled ${unruled} of ${total}.`,
    );
  }
  if (total <= 0) {
    throw new Error(
      `${manifest.id}: figure "groupsTotal" is ${total}, so there is no grid to draw.`,
    );
  }
  if (unruled < 0 || unruled > total) {
    throw new Error(
      `${manifest.id}: figure "unruled" is ${unruled} of a "groupsTotal" of ${total}, which is not a proportion.`,
    );
  }
  return {
    unruled,
    total,
    ruled: total - unruled,
    percent: Math.round((unruled / total) * 100),
  };
}

/* --- The grid ------------------------------------------------------------- */

/**
 * One cell.
 *
 * An unlit cell is the plate at a countable edge; a lit one is solid accent.
 * The flip is a blend between the two tokens over `ACCENT_CELL` frames - not an
 * opacity ramp, because a cell fading up would be an object arriving, and
 * nothing in this film arrives by fading. The cell is already there. It changes
 * what it is.
 */
const Cell: React.FC<{ lit: boolean; flipAt: number }> = ({ lit, flipAt }) => {
  const frame = useCurrentFrame();
  const t = lit
    ? EASING.standard(
        interpolate(frame, [flipAt, flipAt + ACCENT_CELL], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
      )
    : 0;

  return (
    <div
      style={{
        boxSizing: 'border-box',
        width: CELL,
        height: CELL,
        borderRadius: 8,
        background: mix(STAGE.plate, 1, STAGE.accent, 1, t),
        border: `2px solid ${mix(STAGE.inkDim, UNLIT_ALPHA, STAGE.accent, 1, t)}`,
      }}
    />
  );
};

/**
 * The denominator, drawn: `total` cells in rows of `PER_ROW`, of which the
 * first `lit` flip to accent.
 *
 * Each row is one `dock`, so the grid fills row by row from the left in the
 * verb's own 22f, and the rows are staggered rather than composed - a bespoke
 * `interpolate` per cell would be a seventh verb nobody voted for. The
 * hairline is off on every row: eight of them stacked would read as a ruled
 * page rather than as arrivals.
 */
const Grid: React.FC<{ total: number; lit: number }> = ({ total, lit }) => {
  const rows = Math.ceil(total / PER_ROW);
  /** The sweep across the lit cells, so the whole pass is `ACCENT_PASS` frames. */
  const sweep = lit > 1 ? (ACCENT_PASS - ACCENT_CELL) / (lit - 1) : 0;

  return (
    <div style={{ position: 'absolute', left: LEFT_X, top: GRID_Y }}>
      {Array.from({ length: rows }, (_, row) => {
        const start = row * PER_ROW;
        const count = Math.min(PER_ROW, total - start);
        return (
          <div key={row} style={{ marginBottom: row === rows - 1 ? 0 : GUTTER }}>
            <Dock from={GRID_AT + row * GRID_ROW_STEP} edge="left" distance={140} rule={false}>
              <div style={{ display: 'flex' }}>
                {Array.from({ length: count }, (_, i) => {
                  const index = start + i;
                  return (
                    <div
                      key={i}
                      style={{
                        marginRight: i === count - 1 ? 0 : i === BLOCK - 1 ? BLOCK_GAP : GUTTER,
                      }}
                    >
                      <Cell lit={index < lit} flipAt={ACCENT_AT + index * sweep} />
                    </div>
                  );
                })}
              </div>
            </Dock>
          </div>
        );
      })}
    </div>
  );
};

/* --- The ledger ----------------------------------------------------------- */

/** A swatch: one of the grid's own cells, at rest, in the fill it stands for. */
const Swatch: React.FC<{ fill: string; edge: string }> = ({ fill, edge }) => (
  <div
    style={{
      boxSizing: 'border-box',
      width: CELL,
      height: CELL,
      borderRadius: 8,
      background: fill,
      border: `2px solid ${edge}`,
    }}
  />
);

/**
 * One row of the arithmetic, arriving from the right.
 *
 * `edge="right"` is the deliberate reversal `Dock`'s own doc asks call sites to
 * make explicit: the film's objects arrive from the left because that is where
 * the panel is docked, and this column is on the other side of the frame from
 * everything the panel left behind.
 */
const LedgerRow: React.FC<{
  from: number;
  top: number;
  swatch?: React.ReactNode;
  value: string;
  label: string;
  color: string;
  divider?: boolean;
}> = ({ from, top, swatch, value, label, color, divider }) => (
  <div style={{ position: 'absolute', left: 0, top, width: LEDGER_W }}>
    <Dock from={from} edge="right" distance={150} rule={false}>
      <div
        style={{
          boxSizing: 'border-box',
          height: ROW_H,
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          borderTop: divider ? `1px solid ${STAGE.rule}` : undefined,
        }}
      >
        <div style={{ width: CELL, height: CELL, flex: `0 0 ${CELL}px` }}>{swatch}</div>
        <div
          style={{
            flex: `0 0 ${NUM_COL}px`,
            fontSize: TYPE.claim,
            fontWeight: 700,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            fontFeatureSettings: '"tnum"',
            color,
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: TYPE.body, color: STAGE.inkDim }}>{label}</div>
      </div>
    </Dock>
  </div>
);

/* --- The piece ------------------------------------------------------------ */

/**
 * B3. The finding counts up, the org is drawn as its own denominator, the lit
 * cells answer the figure, and the arithmetic arrives from the right.
 *
 * `plot` is deliberately unused. Every other synthetic surface draws into the
 * `focus` stage's plot - the rectangle the *panel's* column leaves behind - but
 * the panel has left, and this piece's argument is a proportion: confined to
 * one column it would be a chart in a margin. It takes the frame. (B1's module
 * doc makes the same decision at more length.)
 */
export const Unpacking: React.FC<PieceProps> = ({ manifest }) => {
  const { unruled, total, ruled, percent } = readProportion(manifest);

  return (
    <AbsoluteFill>
      <Recede from={RECEDE_AT} style={{ position: 'absolute', inset: 0 }}>
        {/* The claim. Docked from the left, the edge the panel was on. */}
        <div style={{ position: 'absolute', left: LEFT_X, top: HEAD_Y, width: HEAD_W }}>
          <Dock from={HEAD_AT} rule={false}>
            <div style={{ fontSize: TYPE.claim, lineHeight: 1.24, color: STAGE.ink }}>
              Most of this org is maintained by hand.
            </div>
          </Dock>
        </div>

        {/* Register one: the figure, at 108px. */}
        <div style={{ position: 'absolute', left: LEFT_X, top: FIGURE_Y, width: FIGURE_W }}>
          <Dock from={FIGURE_AT} distance={140}>
            <div style={{ width: FIGURE_W }}>
              <Count from={COUNT_AT} value={unruled} color={STAGE.accent} />
              <div
                style={{
                  marginTop: 14,
                  fontSize: TYPE.unit,
                  letterSpacing: 2.2,
                  textTransform: 'uppercase',
                  color: STAGE.inkDim,
                }}
              >
                Groups no rule fills
              </div>
            </div>
          </Dock>
        </div>

        {/* Register two: the denominator, drawn. */}
        <Grid total={total} lit={unruled} />

        {/* Register three: the arithmetic, from the right. */}
        <div style={{ position: 'absolute', left: LEDGER_X, top: LEDGER_Y, width: LEDGER_W }}>
          <LedgerRow
            from={LEDGER_AT}
            top={0}
            swatch={<Swatch fill={STAGE.accent} edge={STAGE.accent} />}
            value={`${unruled}`}
            label="groups no rule fills"
            color={STAGE.accent}
          />
          <LedgerRow
            from={LEDGER_AT + LEDGER_STEP}
            top={ROW_H + ROW_GAP}
            swatch={<Swatch fill={STAGE.plate} edge={UNLIT_EDGE} />}
            value={`${ruled}`}
            label="groups a rule maintains"
            color={STAGE.ink}
          />
          <LedgerRow
            from={LEDGER_AT + LEDGER_STEP * 2}
            top={(ROW_H + ROW_GAP) * 2}
            value={`${total}`}
            label="groups in the org"
            color={STAGE.ink}
            divider
          />
          <LedgerRow
            from={LEDGER_AT + LEDGER_STEP * 3}
            top={(ROW_H + ROW_GAP) * 3}
            value={`${percent}%`}
            label="of the org, maintained by hand"
            color={STAGE.accent}
          />

          {/* The slide's closing line, on a raised plane. */}
          <div
            style={{ position: 'absolute', left: 0, top: (ROW_H + ROW_GAP) * 4, width: LEDGER_W }}
          >
            <Dock from={LEDGER_AT + LEDGER_STEP * 4} edge="right" distance={150} rule={false}>
              <div
                style={{
                  boxSizing: 'border-box',
                  minHeight: ROW_H,
                  padding: '16px 26px',
                  display: 'flex',
                  alignItems: 'center',
                  background: STAGE.plate,
                  borderLeft: `3px solid ${STAGE.accent}`,
                  borderRadius: 4,
                  fontSize: TYPE.body,
                  lineHeight: 1.3,
                  color: STAGE.ink,
                }}
              >
                Every one of them is somebody&rsquo;s memory of who belongs.
              </div>
            </Dock>
          </div>
        </div>
      </Recede>
    </AbsoluteFill>
  );
};

/**
 * Props-free wrapper so this can be a registered composition while it is built.
 *
 * It paints the stage and sets the film's face, which `ActPiece` does for the
 * real thing (`Backdrop` under the piece, `INTER` on the frame). Without both,
 * a still rendered from this composition is a transparent PNG in whatever font
 * the render box had lying around - which is exactly the failure `theme.ts`
 * documents for the margin, judged in the one place the piece is judged.
 */
export const UnpackingPreview: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE.back, fontFamily: INTER, color: STAGE.ink }}>
    <Unpacking
      id="placeholder"
      frames={UNPACKING_FRAMES}
      plot={STAGES.focus.plot}
      manifest={capture('home')}
    />
  </AbsoluteFill>
);
