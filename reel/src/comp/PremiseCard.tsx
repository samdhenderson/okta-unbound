/**
 * @module reel/comp/PremiseCard
 * @description C2: three plates of decay, each solidifying as its exhibit lands.
 *
 * Eleven seconds of the film's thesis, and the mechanic *is* the thesis. Three
 * claims about environmental decay dock in as graphite outlines - claims not
 * yet evidenced - and each one solidifies via `Convert` at the moment its
 * exhibit arrives, the exhibit being a figure the rig actually read off the
 * real panel. A claim becomes a fact when the product measures it. That is the
 * whole argument of the film, rendered once, as motion, before a single feature
 * is named.
 *
 * ## Why `draw` is licensed here and almost nowhere else
 *
 * `reel/pencil`'s governance rule: `draw` only ever applies to something the
 * product has not made yet. This card is the clearest case in the film. The
 * graphite outline is the claim; the ink is the evidence. Nothing drawn in
 * pencil here is a rendering of real captured state - the moment real state
 * appears, it appears in ink, on the far side of a hard-edged wipe.
 *
 * `Convert` guarantees the wipe is hard-edged: it clips ink and graphite by two
 * complementary rects of the same bbox each frame, so no pixel ever shows both
 * renderings of the same object. A crossfade between two synthetic objects is
 * the one transition this film never uses.
 *
 * ## Everything is SVG, and that is a decision
 *
 * `Convert` clips with SVG `clipPath`, so anything that solidifies has to be
 * SVG. That rules out the HTML verbs (`Dock`, `Count`, `Recede`) as components
 * here. Their *timing and curves* are still the grammar's - `useVerb` and
 * `FRAMES` drive the dock and the recede below, so a plate arrives on
 * `entrance` over 22f and leaves on `exit` over 19f exactly like every HTML
 * object in the film. Only the primitive that draws them differs.
 *
 * `Count` is deliberately not used. A figure that rolls in after the wipe has
 * already revealed it would be the same object arriving twice; here the wipe
 * *is* the landing, and the film's counting verb belongs to the chapters that
 * hold on a single number.
 *
 * ## The figures, and the consequence worth knowing
 *
 * This card is not an act. It has no `from`, so it reads its own manifests
 * directly, and it needs three of them:
 *
 * - `pausedRules` and `groupsTotal`'s neighbours `unruled` / `emptyGroups` from
 *   **home**,
 * - `stats['Total Rules']` from **rules**,
 * - `typo` from **users-fix**.
 *
 * Every one comes through `figure()` / a checked reader, so an unread key fails
 * the render rather than printing a number nobody measured. The consequence,
 * stated because it will surprise someone: **a stale `rules` capture now fails
 * at frame 0 of the film instead of at 2:40.** Chapter 5 used to be the only
 * thing that needed `stats`; the opening needs it too. That is better - the
 * film refuses to start rather than getting nine minutes in before admitting it
 * cannot support a claim it already made - but it does mean a re-shoot of one
 * chapter can turn the very first cards red.
 *
 * ## The copy
 *
 * `SCRIPT.md`'s premise is a headline and two points; the two points are
 * exactly the three plate titles below, split where the script splits them
 * ("Stale mapping rules." and "Manual attribute typos." are one line carrying
 * two claims, so they get a plate each). No copy is lost turning the type into
 * plates; it is redistributed onto the objects that evidence it.
 */
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Backdrop } from './Backdrop';
import { capture, figure, type Manifest } from '../captures';
import type { Rect } from '../layout';
import { Convert, SketchBox, Written, draw } from '../pencil';
import { FRAMES, useVerb } from '../verbs';
import { COLOR, FONT, FRAME, INTER, STAGE, TYPE } from '../theme';

/** This card's length, in frames. A literal, for the same reason a piece's is. */
export const PREMISE_CARD_FRAMES = 660;

/* --- Where everything stands ---------------------------------------------- */

/** The plate's rectangle, shared by all three. `x + width` stops 380px short of
 * the frame's right edge, so nothing here goes near the film's seam. */
const PLATE = { x: 200, width: 1340, height: 148 } as const;

/** The three plates' top edges. Pitch 180, so the gap between them is 32. */
const PLATE_Y = [360, 540, 720] as const;

/** The headline's baseline, and the left rule everything hangs off. */
const HEADLINE = { x: PLATE.x, y: 274 } as const;

/** Where a plate's index numeral, claim, and exhibit sit, relative to the plate. */
const COL = { index: 40, claim: 96, exhibit: 900 } as const;

/**
 * How far past the plate the wipe's bbox reaches.
 *
 * `Stroke` overshoots each nominal endpoint by `over` px and jitters both ends,
 * so a sketched rectangle is a little larger than the rectangle it describes.
 * Without this pad the graphite clip - which is a sub-rect of the bbox - would
 * shave those overshoots off, and the pencil would lose exactly the corners
 * that make it read as a hand.
 */
const WIPE_PAD = 18;

/** How far off-stage a plate starts. `Dock`'s own default distance. */
const DOCK_DISTANCE = 160;

/* --- When ----------------------------------------------------------------- */

/** The thesis docks first, alone, and holds the frame for most of a second. */
const HEADLINE_AT = 0;
/** Each plate docks while its outline draws: arriving and being drawn are one move. */
const DOCK_AT = [44, 98, 152] as const;
/** The claim writes itself on, once its plate has landed. */
const WRITE_AT = [72, 126, 180] as const;
/** The exhibit's empty frame is sketched last: the space evidence will occupy. */
const SKETCH_AT = [96, 150, 204] as const;
/** The three converts. 66f apart, 22f each - `PENCIL_FRAMES.convert`, taken as the default. */
const CONVERT_AT = [300, 366, 432] as const;
/** All three hold in ink for 172f. That hold is what makes the total read as accumulation. */
const RECEDE_AT = 626;

/* --- The figures ---------------------------------------------------------- */

/**
 * A string figure, or a thrown error naming what came back instead.
 *
 * `figure()` proves the key was read; its type parameter is an unchecked cast,
 * so it does not prove the value is a string. An empty one would set an empty
 * chip on screen - a claim with nothing in it, which is the same failure as a
 * number nobody measured.
 */
function figureString(manifest: Manifest, key: string): string {
  const raw = figure<unknown>(manifest, key);
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(
      `${manifest.id}: figure "${key}" is not a non-empty string - got ${JSON.stringify(raw)}.`,
    );
  }
  return raw;
}

/**
 * One field of a record-shaped figure, checked to be a finite number.
 *
 * `figureNumber()` covers a figure that is itself a number; `stats` is a record
 * of four of them, and `stats['Total Rules']` is the denominator of exhibit 01.
 * Reaching into it with `?? 0` - which is how the chapter-5 slide does it -
 * would print `1 of 0` if the rig ever stopped reading that key. Here it
 * throws.
 */
function statNumber(manifest: Manifest, key: string, field: string): number {
  const raw = figure<unknown>(manifest, key);
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(
      `${manifest.id}: figure "${key}" is not an object - got ${JSON.stringify(raw)}.`,
    );
  }
  const value = (raw as Record<string, unknown>)[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `${manifest.id}: figure "${key}"."${field}" is not a finite number - got ${JSON.stringify(value)}.`,
    );
  }
  return value;
}

/**
 * A number figure, checked. (`figureNumber` in `captures.ts` does this; it is
 * re-implemented here only because the two call sites below want the same
 * error shape as the two readers above, and importing three readers from two
 * modules to check three kinds of value reads worse than one family.)
 */
function figureCount(manifest: Manifest, key: string): number {
  const raw = figure<unknown>(manifest, key);
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new Error(
      `${manifest.id}: figure "${key}" is not a finite number - got ${JSON.stringify(raw)}.`,
    );
  }
  return raw;
}

/** `COLOR.danger` at `alpha`, so the typo's chip is the product's own danger and not an invented wash. */
function dangerWash(alpha: number): string {
  const hex = COLOR.danger;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* --- Exhibit primitives --------------------------------------------------- */

/** A figure and the words beside it, set on one baseline. The exhibit's own line. */
const Exhibit: React.FC<{
  x: number;
  y: number;
  value: string;
  unit: string;
  valueColor?: string;
  mono?: boolean;
}> = ({ x, y, value, unit, valueColor = STAGE.alert, mono = false }) => (
  <text x={x} y={y} xmlSpace="preserve" fontFamily={mono ? FONT.mono : INTER}>
    <tspan fontSize={TYPE.claim} fontWeight={700} fill={valueColor}>
      {value}
    </tspan>
    <tspan fontFamily={INTER} fontSize={TYPE.label} fill={STAGE.inkDim}>
      {`  ${unit}`}
    </tspan>
  </text>
);

/** The graphite stand-in for an exhibit: the space evidence will occupy, and nothing in it. */
const Pending: React.FC<{ box: Rect; p: number; seed: number }> = ({ box, p, seed }) => (
  <SketchBox
    x={box.x}
    y={box.y}
    width={box.width}
    height={box.height}
    p={p}
    seed={seed}
    weight={2}
    amplitude={2.2}
  />
);

/* --- One plate ------------------------------------------------------------ */

interface PlateSpec {
  /** `01`, `02`, `03`. The exhibit numbers `SCRIPT.md` gives them. */
  index: string;
  /** The claim. Graphite until its exhibit lands, ink after. */
  claim: string;
  /** The evidence, in ink. Drawn only on the far side of the wipe. */
  ink: (y: number) => React.ReactNode;
  /** The empty frames the evidence will fill, in graphite. */
  pending: (y: number) => Rect[];
}

const Plate: React.FC<{ spec: PlateSpec; i: number }> = ({ spec, i }) => {
  const frame = useCurrentFrame();
  const y = PLATE_Y[i];
  const arrive = useVerb('dock', DOCK_AT[i]);
  const opacity = interpolate(frame, [DOCK_AT[i], DOCK_AT[i] + FRAMES.dockOpacity], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const outline = draw(frame, DOCK_AT[i]);
  const written = draw(frame, WRITE_AT[i]);
  const sketched = draw(frame, SKETCH_AT[i]);
  const seed = 40 * (i + 1);

  const claimY = y + 88;
  const indexY = y + 36;
  const pending = spec.pending(y);

  const bbox: Rect = {
    x: PLATE.x - WIPE_PAD,
    y: y - WIPE_PAD,
    width: PLATE.width + WIPE_PAD * 2,
    height: PLATE.height + WIPE_PAD * 2,
  };

  return (
    <g transform={`translate(${-(1 - arrive) * DOCK_DISTANCE}, 0)`} opacity={opacity}>
      <Convert
        frame={frame}
        start={CONVERT_AT[i]}
        bbox={bbox}
        direction="right"
        graphite={
          <g>
            <SketchBox
              x={PLATE.x}
              y={y}
              width={PLATE.width}
              height={PLATE.height}
              p={outline}
              seed={seed}
              amplitude={2.6}
            />
            <Written
              x={PLATE.x + COL.index}
              y={indexY}
              text={spec.index}
              p={outline}
              size={TYPE.unit}
              weight={600}
            />
            <Written
              x={PLATE.x + COL.claim}
              y={claimY}
              text={spec.claim}
              p={written}
              size={TYPE.body}
              weight={600}
            />
            {pending.map((box, n) => (
              <Pending key={n} box={box} p={sketched} seed={seed + 8 + n * 4} />
            ))}
          </g>
        }
        ink={
          <g>
            <rect
              x={PLATE.x}
              y={y}
              width={PLATE.width}
              height={PLATE.height}
              fill={STAGE.plate}
              stroke={STAGE.rule}
              strokeWidth={1}
            />
            <text
              x={PLATE.x + COL.index}
              y={indexY}
              fontFamily={FONT.mono}
              fontSize={TYPE.unit}
              fontWeight={600}
              fill={STAGE.accent}
            >
              {spec.index}
            </text>
            <text
              x={PLATE.x + COL.claim}
              y={claimY}
              fontFamily={INTER}
              fontSize={TYPE.body}
              fontWeight={600}
              fill={STAGE.ink}
            >
              {spec.claim}
            </text>
            {spec.ink(y)}
          </g>
        }
      />
    </g>
  );
};

/* --- The card ------------------------------------------------------------- */

/**
 * The premise. See the module doc for the mechanic, the manifests, and why
 * every verb here is drawn rather than composed.
 */
export const PremiseCard: React.FC = () => {
  const frame = useCurrentFrame();

  const home = capture('home');
  const rules = capture('rules');
  const fix = capture('users-fix');

  const pausedRules = figureCount(home, 'pausedRules');
  const totalRules = statNumber(rules, 'stats', 'Total Rules');
  const typo = figureString(fix, 'typo');
  const unruled = figureCount(home, 'unruled');
  const emptyGroups = figureCount(home, 'emptyGroups');

  const ex = PLATE.x + COL.exhibit;

  const specs: PlateSpec[] = [
    {
      index: '01',
      claim: 'Stale mapping rules.',
      ink: (y) => (
        <g>
          <text x={ex} y={y + 80} xmlSpace="preserve" fontFamily={INTER}>
            <tspan fontSize={TYPE.claim} fontWeight={700} fill={STAGE.alert}>
              {String(pausedRules)}
            </tspan>
            <tspan fontSize={TYPE.body} fill={STAGE.inkDim}>
              {'  of  '}
            </tspan>
            <tspan fontSize={TYPE.claim} fontWeight={700} fill={STAGE.ink}>
              {String(totalRules)}
            </tspan>
          </text>
          <text x={ex} y={y + 122} fontFamily={INTER} fontSize={TYPE.label} fill={STAGE.inkDim}>
            rules switched off
          </text>
        </g>
      ),
      pending: (y) => [
        { x: ex - 10, y: y + 32, width: 210, height: 58 },
        { x: ex - 10, y: y + 100, width: 300, height: 30 },
      ],
    },
    {
      index: '02',
      claim: 'Manual attribute typos.',
      ink: (y) => (
        <g>
          <rect
            x={ex - 14}
            y={y + 36}
            width={typo.length * 30 + 28}
            height={58}
            fill={dangerWash(0.16)}
            stroke={STAGE.alert}
            strokeWidth={1}
          />
          <text
            x={ex}
            y={y + 78}
            fontFamily={FONT.mono}
            fontSize={TYPE.claim}
            fontWeight={700}
            fill={STAGE.alert}
          >
            {typo}
          </text>
          <text x={ex} y={y + 122} fontFamily={INTER} fontSize={TYPE.label} fill={STAGE.inkDim}>
            as typed on the profile
          </text>
        </g>
      ),
      pending: (y) => [
        { x: ex - 14, y: y + 36, width: typo.length * 30 + 28, height: 58 },
        { x: ex - 10, y: y + 100, width: 300, height: 30 },
      ],
    },
    {
      index: '03',
      claim: 'Legacy organization structures still driving access.',
      ink: (y) => (
        <g>
          <Exhibit x={ex} y={y + 62} value={String(unruled)} unit="groups no rule fills" />
          <Exhibit x={ex} y={y + 126} value={String(emptyGroups)} unit="with nobody in them" />
        </g>
      ),
      pending: (y) => [
        { x: ex - 10, y: y + 18, width: 420, height: 52 },
        { x: ex - 10, y: y + 82, width: 420, height: 52 },
      ],
    },
  ];

  // recede: the whole card leaves as one object, on the grammar's exit curve.
  // `Recede` itself is an HTML div, so its shape is reproduced here rather than
  // reused - scale 1 to .96 about the frame's centre, opacity only in the last
  // 6f. The shadow half of the verb has nothing to collapse: nothing on this
  // card casts one, because a flat plane is the only thing that does not band
  // on the dark stage (see `Backdrop`).
  const leaving = useVerb('recede', RECEDE_AT);
  const scale = interpolate(leaving, [0, 1], [1, 0.96]);
  const exit = interpolate(
    frame,
    [RECEDE_AT + FRAMES.recede - FRAMES.recedeOpacityWindow, RECEDE_AT + FRAMES.recede],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const headline = useVerb('dock', HEADLINE_AT);
  const headlineOpacity = interpolate(
    frame,
    [HEADLINE_AT, HEADLINE_AT + FRAMES.dockOpacity],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={{ background: STAGE.back }}>
      <Backdrop focusX={FRAME.width / 2} />
      <AbsoluteFill>
        <svg
          width={FRAME.width}
          height={FRAME.height}
          viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
        >
          <g
            opacity={exit}
            transform={`translate(${FRAME.width / 2}, ${FRAME.height / 2}) scale(${scale}) translate(${-FRAME.width / 2}, ${-FRAME.height / 2})`}
          >
            <g
              transform={`translate(${-(1 - headline) * DOCK_DISTANCE}, 0)`}
              opacity={headlineOpacity}
            >
              <text
                x={HEADLINE.x}
                y={HEADLINE.y}
                fontFamily={INTER}
                fontSize={TYPE.claim}
                fontWeight={700}
                fill={STAGE.ink}
                letterSpacing={-1}
              >
                Every Okta environment accumulates technical debt.
              </text>
              {/* dock's accent hairline, beneath the object it delivers. Only the
                  headline gets one: three of them would make the accent the
                  loudest thing on a card whose argument is graphite going to ink. */}
              <rect
                x={HEADLINE.x}
                y={HEADLINE.y + 34}
                width={headline * 640}
                height={3}
                fill={STAGE.accent}
              />
            </g>
            {specs.map((spec, i) => (
              <Plate key={spec.index} spec={spec} i={i} />
            ))}
          </g>
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const PremiseCardPreview: React.FC = () => <PremiseCard />;
