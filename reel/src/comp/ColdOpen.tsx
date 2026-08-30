/**
 * @module reel/reel/comp/ColdOpen
 * @description The console cold open, before the panel exists.
 *
 * The film's opening shot, ~5.5s: a hand draws the Okta admin console you work
 * in *today* - window, app bar, the nav written out by name, the overview and
 * task cards - and then a seam is drawn down the right edge of frame and
 * converts from graphite into the film's accent. Hard cut from there into the
 * title card.
 *
 * ## Why `draw` is legitimate here
 *
 * `pencil/draw.ts` governs its own verb: it may only touch something the
 * product has not made yet - a claim awaiting evidence, a state that does not
 * exist, or the world before the panel. This shot is the canonical case of the
 * third. Nothing on screen here is a rendering of captured product state; it is
 * the *before*, which is precisely why it is drawn rather than filmed.
 *
 * ## What was taken from the handoff, and what was not
 *
 * `DesignDocs/design_handoff_title_animation/console-doodle/` is the reference.
 * Its information architecture is kept in order, because the recognisability is
 * the argument: an admin should know this room before the film tells them
 * anything. Four things are deliberately not kept.
 *
 * 1. **The "Okta service / Operational" card.** That is the one piece of the
 *    reference that stops being generic structure and starts being Okta's
 *    product surface reproduced. The rule is that Okta is named in copy and its
 *    brand is not used, so the card keeps its slot and its `Status` title and
 *    loses the branded line; two inert rules stand in for its rows.
 * 2. **The reference's figures** (`8K users / 24 groups / 189 SSO apps`). That
 *    is not a shape any real org has - 8,000 people sharing 24 groups - and it
 *    came from no capture. The figures here are counted from the demo fixture
 *    the rest of the film is shot against, so the cold open and the footage
 *    describe the same company. See {@link METRICS}.
 * 3. **`feTurbulence` + `feDisplacementMap`.** The reference runs two of them
 *    full-frame for 12.3s. `pencil/wobble.ts` explains at length why that is
 *    banned; the wobble here is geometry, via `Stroke`'s `amplitude`, and costs
 *    nothing per frame.
 * 4. **The camera settle and the crossfade solidify.** A 1.016 to 1.0 zoom over
 *    8s of flat dark stage and 1px hairlines crawls, so there is no camera move
 *    at all; and the seam converts through `pencil/Convert`'s hard wipe rather
 *    than the reference's 19-frame double-render crossfade.
 *
 * ## The seam
 *
 * The film's seam is hoisted above every chapter by `Reel.tsx` - a 4px
 * `STAGE.accent` line at the frame's right edge, `x` 1916 to 1920. This shot
 * draws its *own* seam, in the same 4px at the same 1916, so that the last
 * frame of the cold open and the first frame of whatever follows are the same
 * pixels and the handover is invisible. It is drawn in graphite top to bottom,
 * then converted downward into the accent, and holds there to the cut.
 *
 * Never wrap any of this in Remotion's `<Sequence>`: every cue below is an
 * absolute frame, and `<Sequence>` remaps `useCurrentFrame()` to 0, which does
 * not throw - it silently freezes the whole shot on its first pose.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { STAGE, TYPE } from '../theme';
import { FRAME } from '../frame';
import { Convert, GRAPHITE, SketchBox, Stroke, Written, draw } from '../pencil';

/**
 * This card's length, in frames. A literal, for the same reason a piece's is.
 *
 * 330f at 60fps is 5.5s: about 3.8s of drawing, 1.0s of the seam arriving and
 * converting, and a ~0.4s hold on the landed seam so the cut into the title
 * card lands on a still frame rather than mid-move.
 */
export const COLD_OPEN_FRAMES = 330;

/** The console window, in frame pixels. Its right edge stops clear of the seam. */
const CONSOLE = { x: 88, y: 104, width: 1740, height: 872 } as const;

/** The app bar's height, measured down from the window's top edge. */
const APP_BAR = 74;

/** The left nav's column width. */
const NAV_W = 286;

/**
 * The nav, in the admin console's own order.
 *
 * `head: true` is a top-level section (bold, with a disclosure tick at the
 * column's right); the unmarked entries are the children of the expanded
 * Dashboard section, one of which is the active row. Structure and label words
 * only - no icons, no colour, nothing that is anyone's mark.
 */
const NAV: readonly { text: string; head?: boolean; active?: boolean }[] = [
  { text: 'Dashboard', head: true },
  { text: 'Dashboard', active: true },
  { text: 'Tasks' },
  { text: 'Agents' },
  { text: 'Notifications' },
  { text: 'Directory', head: true },
  { text: 'Applications', head: true },
  { text: 'Security', head: true },
  { text: 'Workflow', head: true },
  { text: 'Reports', head: true },
  { text: 'Settings', head: true },
];

/**
 * The overview card's three figures, counted from the demo fixture rather than
 * invented.
 *
 * - `250` is `DEMO_USER_COUNT` in `src/sidepanel/demo/users.ts`.
 * - `37` is the length of `groupTemplates` in `src/sidepanel/demo/snapshot.ts`.
 * - `12` is the length of `demoApps` in the same file.
 *
 * A figure on screen that nobody can source is a figure that will eventually be
 * quoted back at us, so these are countable in the repo and consistent with
 * `Northwind Trading Co.`, the org every other chapter is filmed against. The
 * label is `Apps` and not `SSO apps` because the fixture's twelve rows include
 * an inactive one and several that exist for group push, so `SSO` would be
 * describing them slightly wrong for the sake of matching the reference.
 */
const METRICS: readonly { label: string; value: string }[] = [
  { label: 'Users', value: '250' },
  { label: 'Groups', value: '37' },
  { label: 'Apps', value: '12' },
];

/** The task table's type pills, top to bottom. Generic console vocabulary. */
const TASKS: readonly string[] = ['Error', 'Info', 'To-do', 'Info', 'Info'];

/** Geometry wobble for a rule or a long stroke. See `pencil/wobble.ts`. */
const LINE_WOBBLE = 1.8;

/** Geometry wobble for a box's four sides. Lower: four wobbly sides compound. */
const BOX_WOBBLE = 1.3;

/** The seam's own column, matching `comp/Seam`'s 4px at the frame's right edge. */
const SEAM = { x: FRAME.width - 4, width: 4 } as const;

/**
 * The cues, all absolute frames. Kept in one object so the shot's timing can be
 * read and retimed in one place instead of hunted through the JSX.
 */
const CUE = {
  top: 2,
  right: 14,
  bottom: 26,
  left: 38,
  bar: 52,
  navRule: 60,
  search: 68,
  icons: 80,
  /** The nav's eleven rows, one every 4.5f. */
  nav: 84,
  navStep: 4.5,
  cards: 120,
  cardTitles: 134,
  /** The three metrics, one every 8f. */
  metric: 142,
  metricStep: 8,
  statusRows: 150,
  tasksCard: 160,
  /** The five task rows, one every 6f. */
  task: 176,
  taskStep: 6,
  lower: 206,
  /** The seam is drawn from the top of frame down. */
  seamDraw: 246,
  /** ...then converted from graphite into accent, on the same downward edge. */
  seamConvert: 278,
} as const;

/** The console cold open. See the module doc. */
export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();

  // Every progress value is a pure function of `frame`, so any frame renders
  // correctly on its own - Remotion may ask for frame 300 having never drawn
  // frame 299.
  const pTop = draw(frame, CUE.top, 24);
  const pRight = draw(frame, CUE.right, 24);
  const pBottom = draw(frame, CUE.bottom, 24);
  const pLeft = draw(frame, CUE.left, 24);
  const pBar = draw(frame, CUE.bar, 18);
  const pNavRule = draw(frame, CUE.navRule, 18);
  const pSearch = draw(frame, CUE.search, 18);
  const pIcons = draw(frame, CUE.icons, 12);
  const pNav = (n: number) => draw(frame, CUE.nav + n * CUE.navStep, 14);
  const pCards = draw(frame, CUE.cards, 20);
  const pCardTitles = draw(frame, CUE.cardTitles, 14);
  const pMetric = (n: number) => draw(frame, CUE.metric + n * CUE.metricStep, 16);
  const pStatusRows = draw(frame, CUE.statusRows, 16);
  const pTasksCard = draw(frame, CUE.tasksCard, 20);
  const pTask = (n: number) => draw(frame, CUE.task + n * CUE.taskStep, 16);
  const pLower = draw(frame, CUE.lower, 22);
  const pSeam = draw(frame, CUE.seamDraw, 26);

  const right = CONSOLE.x + CONSOLE.width;
  const bottom = CONSOLE.y + CONSOLE.height;
  const barY = CONSOLE.y + APP_BAR;
  const navX = CONSOLE.x + NAV_W;
  const navTop = CONSOLE.y + 132;

  // The content column, right of the nav rule, and the card grid inside it.
  const cx = navX + 40;
  const cw = right - 40 - cx;
  const overW = cw * 0.615 - 12;
  const statX = cx + cw * 0.615 + 12;
  const statW = cw * 0.385 - 12;
  const cardY = barY + 34;
  const cardH = 196;
  const tasksY = cardY + cardH + 30;
  const tasksH = 306;
  const lowerY = tasksY + tasksH + 30;
  const lowerH = 176;
  const searchW = Math.min(520, cw * 0.5);

  const line = { amplitude: LINE_WOBBLE, segments: 8 };
  const box = { amplitude: BOX_WOBBLE, segments: 6 };

  return (
    <AbsoluteFill style={{ background: STAGE.back, color: STAGE.ink }}>
      <svg
        width={FRAME.width}
        height={FRAME.height}
        viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* The window: four sides, drawn in sequence like a hand would. */}
        <Stroke
          x1={CONSOLE.x}
          y1={CONSOLE.y}
          x2={right}
          y2={CONSOLE.y}
          p={pTop}
          seed={1}
          {...line}
        />
        <Stroke x1={right} y1={CONSOLE.y} x2={right} y2={bottom} p={pRight} seed={2} {...line} />
        <Stroke x1={right} y1={bottom} x2={CONSOLE.x} y2={bottom} p={pBottom} seed={3} {...line} />
        <Stroke
          x1={CONSOLE.x}
          y1={bottom}
          x2={CONSOLE.x}
          y2={CONSOLE.y}
          p={pLeft}
          seed={4}
          {...line}
        />

        {/* The second pass: the hand going back over its own outline, lighter
            and overshooting further. This is what stops the window reading as
            a CSS border. */}
        <Stroke
          x1={CONSOLE.x}
          y1={CONSOLE.y}
          x2={right}
          y2={CONSOLE.y}
          p={pTop}
          seed={81}
          width={1.4}
          color={GRAPHITE.second}
          over={16}
          {...line}
        />
        <Stroke
          x1={right}
          y1={CONSOLE.y}
          x2={right}
          y2={bottom}
          p={pRight}
          seed={82}
          width={1.4}
          color={GRAPHITE.second}
          over={16}
          {...line}
        />
        <Stroke
          x1={right}
          y1={bottom}
          x2={CONSOLE.x}
          y2={bottom}
          p={pBottom}
          seed={83}
          width={1.4}
          color={GRAPHITE.second}
          over={16}
          {...line}
        />
        <Stroke
          x1={CONSOLE.x}
          y1={bottom}
          x2={CONSOLE.x}
          y2={CONSOLE.y}
          p={pLeft}
          seed={84}
          width={1.4}
          color={GRAPHITE.second}
          over={16}
          {...line}
        />

        {/* The app bar and the nav rule. */}
        <Stroke
          x1={CONSOLE.x}
          y1={barY}
          x2={right}
          y2={barY}
          p={pBar}
          seed={5}
          width={2.4}
          {...line}
        />
        <Stroke
          x1={navX}
          y1={barY}
          x2={navX}
          y2={bottom}
          p={pNavRule}
          seed={6}
          width={2.4}
          {...line}
        />

        {/* The app bar's search field, and its two right-hand icon blanks. */}
        <SketchBox
          x={cx}
          y={CONSOLE.y + 20}
          width={searchW}
          height={36}
          p={pSearch}
          seed={8}
          weight={2.2}
          {...box}
        />
        <Written x={cx + 20} y={CONSOLE.y + 45} text="Search" p={pSearch} size={TYPE.label} />
        <Stroke
          x1={right - 143}
          y1={CONSOLE.y + 38}
          x2={right - 121}
          y2={CONSOLE.y + 38}
          p={pIcons}
          seed={12}
          width={9}
          over={0}
        />
        <Stroke
          x1={right - 106}
          y1={CONSOLE.y + 38}
          x2={right - 84}
          y2={CONSOLE.y + 38}
          p={pIcons}
          seed={13}
          width={9}
          over={0}
        />
        <Stroke
          x1={right - 68}
          y1={CONSOLE.y + 34}
          x2={right - 24}
          y2={CONSOLE.y + 34}
          p={pIcons}
          seed={14}
          width={6}
          over={0}
        />

        {/* The nav, written out by name. */}
        {NAV.map((item, i) => (
          <g key={`${item.text}-${i}`}>
            {item.active ? (
              <SketchBox
                x={CONSOLE.x + 12}
                y={navTop + i * 44 - 24}
                width={NAV_W - 24}
                height={36}
                p={pNav(i)}
                seed={300 + i * 4}
                weight={2}
                over={3}
                {...box}
              />
            ) : null}
            <Written
              x={item.head ? CONSOLE.x + 34 : CONSOLE.x + 66}
              y={navTop + i * 44}
              text={item.text}
              p={pNav(i)}
              size={22}
              weight={item.head ? 600 : 400}
            />
            {item.head ? (
              <Stroke
                x1={navX - 44}
                y1={navTop + i * 44 - 10}
                x2={navX - 30}
                y2={navTop + i * 44 - 2}
                p={pNav(i)}
                seed={400 + i}
                width={2.4}
                over={0}
              />
            ) : null}
          </g>
        ))}

        {/* Overview: the card the figures live on. */}
        <SketchBox x={cx} y={cardY} width={overW} height={cardH} p={pCards} seed={40} {...box} />
        <Written
          x={cx + 26}
          y={cardY + 46}
          text="Overview"
          p={pCardTitles}
          size={28}
          weight={600}
        />
        {METRICS.map((metric, i) => (
          <g key={metric.label}>
            <Written
              x={cx + 26 + (i * (overW - 52)) / 3}
              y={cardY + 100}
              text={metric.label}
              p={pMetric(i)}
              size={20}
            />
            <Written
              x={cx + 26 + (i * (overW - 52)) / 3}
              y={cardY + 150}
              text={metric.value}
              p={pMetric(i)}
              size={TYPE.claim}
              weight={700}
            />
          </g>
        ))}

        {/* Status: the card's slot and title survive; its branded line does
            not. Two inert rules stand where its rows would be. */}
        <SketchBox x={statX} y={cardY} width={statW} height={cardH} p={pCards} seed={48} {...box} />
        <Written
          x={statX + 26}
          y={cardY + 46}
          text="Status"
          p={pCardTitles}
          size={28}
          weight={600}
        />
        <Stroke
          x1={statX + 26}
          y1={cardY + 100}
          x2={statX + statW - 26}
          y2={cardY + 100}
          p={pStatusRows}
          seed={49}
          width={5}
          color={GRAPHITE.second}
          over={2}
          {...line}
        />
        <Stroke
          x1={statX + 26}
          y1={cardY + 142}
          x2={statX + statW * 0.62}
          y2={cardY + 142}
          p={pStatusRows}
          seed={50}
          width={5}
          color={GRAPHITE.second}
          over={2}
          {...line}
        />

        {/* The task table: a pill and a ruled row per task. */}
        <SketchBox x={cx} y={tasksY} width={cw} height={tasksH} p={pTasksCard} seed={56} {...box} />
        <Written x={cx + 26} y={tasksY + 46} text="Tasks" p={pTasksCard} size={28} weight={600} />
        <Stroke
          x1={cx}
          y1={tasksY + 72}
          x2={cx + cw}
          y2={tasksY + 72}
          p={pTasksCard}
          seed={60}
          width={2}
          {...line}
        />
        {TASKS.map((task, i) => (
          <g key={`${task}-${i}`}>
            <SketchBox
              x={cx + 26}
              y={tasksY + 92 + i * 44}
              width={96}
              height={28}
              p={pTask(i)}
              seed={500 + i * 4}
              weight={2}
              over={3}
              {...box}
            />
            <Written
              x={cx + 44}
              y={tasksY + 112 + i * 44}
              text={task}
              p={pTask(i)}
              size={TYPE.unit}
            />
            <Stroke
              x1={cx + 156}
              y1={tasksY + 106 + i * 44}
              x2={cx + 156 + cw * 0.5}
              y2={tasksY + 106 + i * 44}
              p={pTask(i)}
              seed={560 + i}
              width={5}
              color={GRAPHITE.second}
              over={2}
              {...line}
            />
          </g>
        ))}

        {/* The lower row, the last thing the hand gets to. */}
        <SketchBox
          x={cx}
          y={lowerY}
          width={cw * 0.55 - 12}
          height={lowerH}
          p={pLower}
          seed={70}
          {...box}
        />
        <Written
          x={cx + 26}
          y={lowerY + 44}
          text="Org changes"
          p={pLower}
          size={TYPE.body}
          weight={600}
        />
        <SketchBox
          x={cx + cw * 0.55 + 12}
          y={lowerY}
          width={cw * 0.45 - 12}
          height={lowerH}
          p={pLower}
          seed={76}
          {...box}
        />
        <Written
          x={cx + cw * 0.55 + 38}
          y={lowerY + 44}
          text="Security monitoring"
          p={pLower}
          size={TYPE.body}
          weight={600}
        />

        {/* The seam. Drawn in graphite down the right edge, then converted -
            never crossfaded - into the film's accent, on the same edge and in
            the same direction it was drawn. It ends as the exact 4px
            `STAGE.accent` column `comp/Seam` hoists over every later chapter,
            so the cut out of this shot changes nothing at x=1916. */}
        <Convert
          frame={frame}
          start={CUE.seamConvert}
          duration={26}
          bbox={{ x: SEAM.x - 8, y: 0, width: SEAM.width + 8, height: FRAME.height }}
          direction="down"
          graphite={
            <Stroke
              x1={SEAM.x + SEAM.width / 2}
              y1={0}
              x2={SEAM.x + SEAM.width / 2}
              y2={FRAME.height}
              p={pSeam}
              seed={90}
              width={4}
              over={0}
              amplitude={2.4}
              segments={10}
            />
          }
          ink={
            <rect x={SEAM.x} y={0} width={SEAM.width} height={FRAME.height} fill={STAGE.accent} />
          }
        />
      </svg>
    </AbsoluteFill>
  );
};

/** The studio's preview of the shot. Nothing to stage: it is the whole frame. */
export const ColdOpenPreview: React.FC = () => <ColdOpen />;
