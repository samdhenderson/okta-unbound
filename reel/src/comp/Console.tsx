/**
 * @module reel/reel/comp/Console
 * @description The hand-drawn Okta admin console, as a rectangle you can move.
 *
 * A pencil drawing of the console an admin works in *today* - window, app bar,
 * the nav written out by name, the overview and status cards, the task table,
 * the lower row. It draws itself on over ~3.5s and then holds.
 *
 * This lived inside `comp/ColdOpen` (since retired into `comp/Overture`, which
 * is the one shot that draws a console now) with its rectangle hard-coded as a module
 * constant, and `comp/TitleCard` drew a second, differently-sized console of
 * its own. Two consoles at two fixed sizes cannot be the same console moving,
 * which is exactly what the film's opening needs: the console is drawn
 * full-frame, then the extension panel arrives from the right and squeezes it
 * narrower, and every interior element has to follow that squeeze in one
 * continuous move. So the geometry is a function of {@link ConsoleProps.rect}
 * and nothing here reads a module-level rectangle.
 *
 * ## What scales with the rect, and what does not
 *
 * Not everything should. A window getting narrower is not a window being
 * scaled down - the chrome keeps its thickness, the type keeps its size, and
 * the content column absorbs the loss. That is what a real console does when
 * you drag its edge in, and it is also the only version that stays legible:
 * uniform scaling would shrink 22px nav labels toward illegibility to solve a
 * problem the nav does not have.
 *
 * **Fixed, in px, whatever the rect is** (each is commented at its constant):
 * the app bar's height, the nav column's width and its row pitch and indents,
 * every card's height, the gutters between cards, the search field's height,
 * the icon blanks' sizes, the task pills, the interior padding, and both
 * wobble amplitudes. An amplitude is a property of the *hand*, not of the
 * drawing's size; scaling it would make a narrow console look shakier than a
 * wide one drawn by the same person.
 *
 * **Derived from the rect**: the content column's width and therefore the
 * card grid inside it - the overview/status split, the metric columns'
 * spacing, the status and task rules' lengths, the lower row's split, and the
 * search field's width. These are the things that have to give.
 *
 * The design target is a squeeze from 1740px wide down to about 1240px. At
 * 1240 the content column is 874px, the overview card 525px, the status card
 * 324px, and the narrowest lower card 381px - all still wider than the copy
 * they carry, verified by rendering both widths and looking at them rather
 * than by reasoning about them. {@link MIN_CONTENT_W} records the floor that
 * check establishes.
 *
 * ## Vertical: top-anchored, with a fixed rhythm
 *
 * The move this exists for is horizontal, so the card stack keeps the fixed
 * vertical rhythm it was drawn with and hangs from the app bar downward. A
 * rect taller than the design height simply has more empty floor under the
 * lower row, which is what a taller browser window looks like. It does mean
 * the rect has a minimum height - see {@link CONSOLE_STACK_H} - below which
 * the lower row would cross the window's bottom edge. Nothing enforces it;
 * the film has one console and it is 872 tall.
 *
 * ## What was taken from the handoff, and what was not
 *
 * `DesignDocs/design_handoff_title_animation/console-doodle/` is the
 * reference. Its information architecture is kept in order, because the
 * recognisability is the argument: an admin should know this room before the
 * film tells them anything. Three things are deliberately not kept.
 *
 * 1. **The "Okta service / Operational" card.** That is the one piece of the
 *    reference that stops being generic structure and starts being Okta's
 *    product surface reproduced. The rule is that Okta is named in copy and
 *    its brand is not used, so the card keeps its slot and its `Status` title
 *    and loses the branded line; two inert rules stand in for its rows.
 * 2. **The reference's figures** (`8K users / 24 groups / 189 SSO apps`). That
 *    is not a shape any real org has - 8,000 people sharing 24 groups - and it
 *    came from no capture. The figures here are counted from the demo fixture
 *    the rest of the film is shot against, so the drawing and the footage
 *    describe the same company. See {@link METRICS}.
 * 3. **`feTurbulence` + `feDisplacementMap`.** The reference runs two of them
 *    full-frame for 12.3s. `pencil/wobble.ts` explains at length why that is
 *    banned; the wobble here is geometry, via `Stroke`'s `amplitude`, and
 *    costs nothing per frame.
 *
 * ## Retraction: the drawing un-drawn
 *
 * The film's overture is one continuous shot - the console drawn full-frame,
 * squeezed by the arriving panel, the panel climbing to full fidelity, and
 * then the console leaving so the title can be written on an empty stage.
 * {@link ConsoleProps.retract} is that last beat, and it is opt-in: with no
 * `retract` prop every progress value in here is bit-for-bit what it was
 * before this feature existed. That property is what let the retraction land
 * as a pure addition: it was proved by rendering the un-retracting shot before
 * and after and comparing bytes, not by looking at it and deciding it seemed
 * unchanged.
 *
 * **It is an un-draw, not a fade.** `pencil/Stroke` extrudes a line by pulling
 * `strokeDashoffset` from the line's own length down to zero, so running that
 * same progress *backwards* withdraws the line back along its own path toward
 * the point the pencil started it from. That is a hand lifting off the page.
 * A fade is the weaker move and is not what happens here: nothing changes
 * opacity, every stroke shortens. Two things fall out of reusing the draw-on
 * math rather than inventing an inverse: a `SketchBox`'s four sides come off
 * in reverse order for free (its `q(n) = clamp(p * 4 - n)` means the last side
 * drawn is the first to shrink), and a `Written` word un-writes right to left,
 * the nib retreating the way it came.
 *
 * ## Order: a stack, not a queue, and derived rather than retyped
 *
 * Both orders were rendered and looked at. **First-drawn-first-retracted** (a
 * queue) takes the window's outline away first and leaves the cards, the nav
 * and the task table hanging unsupported in the middle of the stage for most
 * of a second - the drawing stops being a window some frames before it stops
 * being anything, and the intermediate frames read as damage rather than as a
 * withdrawal. **Last-drawn-first-retracted** (a stack) is what is built: the
 * lower row goes first, then the task rows, the cards, the nav, the chrome,
 * and the window's four sides last, so the thing on screen is a container
 * emptying and then closing. It is also the only one of the two that matches
 * how the hand would actually undo the work.
 *
 * The stagger is *derived from {@link CONSOLE_CUE} by reversing it*, not
 * written out as a second table. Each element's withdrawal begins at
 * `at + rank * (span - stroke)`, where `rank` is how early it was drawn,
 * normalised across the cue table's own range. That means the two orders can
 * never drift apart: retiming a draw cue retimes its retraction to match, and
 * a caller passing custom cues gets a retraction consistent with them. The
 * staggered families (nav rows, metrics, task rows) rank by their own
 * per-index cue, so the last nav row leaves before the first one does, just
 * as it arrived after it.
 *
 * ## Its cost
 *
 * {@link CONSOLE_RETRACT} defaults to 60f - 1.0s at the film's 60fps - against
 * the ~248f the drawing takes. Deliberately about a quarter of the draw: by
 * this point in the overture the console has made its point and the audience
 * is waiting on the panel, so a symmetric 3.8s exit would be the film pausing
 * to admire its own graphite. The whole console is gone at exactly
 * `at + span`, because the last-ranked element starts at `at + span - stroke`
 * and takes `stroke` frames; a caller can cut on that frame.
 *
 * ## Two things a caller must not do
 *
 * Never wrap this in Remotion's `<Sequence>`. Every cue is an absolute
 * composition frame, and `<Sequence>` remaps `useCurrentFrame()` to 0, which
 * does not throw - it silently freezes the drawing on its first pose. That is
 * also why `frame` is a prop rather than a `useCurrentFrame()` call in here:
 * the caller owns the shot's clock and this component only reads it.
 *
 * And never render it outside an `<svg>`. It returns a `<g>` in frame-pixel
 * user space so the caller can put a seam, a panel, or a camera transform in
 * the same coordinate system.
 */
import React from 'react';
import { TYPE } from '../theme';
import { GRAPHITE, SketchBox, Stroke, Written, draw } from '../pencil';
import type { Rect } from '../layout';

/**
 * The app bar's height, measured down from the window's top edge.
 *
 * Fixed: chrome thickness is a vertical measurement and the squeeze is
 * horizontal, so a narrower window has the same app bar, not a shorter one.
 */
const APP_BAR = 74;

/**
 * The left nav's column width.
 *
 * Fixed, and this is the load-bearing case for fixing anything. The nav is a
 * column of words at a fixed type size; narrowing it does not reflow it, it
 * clips it. Real consoles keep the nav's width and take the space out of the
 * content column, and at the design squeeze that leaves 286px carrying
 * `Notifications` at 22px with room to spare.
 */
const NAV_W = 286;

/** The nav's first row baseline, measured down from the window's top edge. */
const NAV_TOP = 132;

/** The pitch between nav rows. Fixed: it is a type-size decision. */
const NAV_STEP = 44;

/** The interior padding of every card, and the content column's own inset. */
const PAD = 26;

/** The gutter between the content column and the nav rule / the window edge. */
const GUTTER = 40;

/** The vertical gap between stacked cards. Fixed with the rest of the rhythm. */
const ROW_GAP = 30;

/** The overview/status row's height. */
const CARD_H = 196;

/** The task table's height: a header rule and five rows at 44. */
const TASKS_H = 306;

/** The lower row's height. */
const LOWER_H = 176;

/**
 * The card stack's total height, from the app bar's underside to the lower
 * row's bottom edge. A rect shorter than `APP_BAR + CONSOLE_STACK_H` would
 * push the lower row through the window's own bottom stroke.
 */
export const CONSOLE_STACK_H = 34 + CARD_H + ROW_GAP + TASKS_H + ROW_GAP + LOWER_H;

/**
 * The narrowest content column the card grid survives, in px.
 *
 * Established by rendering the console at the design squeeze (1240 wide, 874
 * of content column) and looking at the PNG, then again at 700 to find where
 * it gives: at 1240 nothing collides and no label overflows its card, and at
 * 700 the layout still holds but the lower row's second card has about 20px
 * left over past `Security monitoring`, which is the binding constraint - the
 * longest string in the drawing sits in the narrowest box. So this is the
 * floor, measured rather than guessed, and not enforced: a console narrower
 * than this is a design decision to make deliberately (probably by shortening
 * that label), not a runtime error.
 */
export const MIN_CONTENT_W = 700;

/** The search field's height. Fixed: a control's height, not a layout. */
const SEARCH_H = 36;

/** The search field's widest, before the content column starts limiting it. */
const SEARCH_MAX_W = 520;

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

/**
 * Geometry wobble for a rule or a long stroke. See `pencil/wobble.ts`.
 *
 * Fixed in px, deliberately: amplitude describes the hand, not the drawing's
 * size. Scaling it with the rect would make the squeezed console read as drawn
 * by a shakier person than the full-frame one, mid-move.
 */
const LINE_WOBBLE = 1.8;

/** Geometry wobble for a box's four sides. Lower: four wobbly sides compound. */
const BOX_WOBBLE = 1.3;

/**
 * The console's draw cues, all absolute composition frames.
 *
 * Kept in one object so the drawing's timing can be read and retimed in one
 * place instead of hunted through the JSX, and exported as a default rather
 * than baked in so a second shot can stage the same console on its own clock
 * without forking the component.
 */
export const CONSOLE_CUE = {
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
} as const;

/** The shape of {@link CONSOLE_CUE}, for a caller supplying its own cues. */
export type ConsoleCue = typeof CONSOLE_CUE;

/**
 * The retraction's default timing, in frames at the film's 60fps.
 *
 * `span` is the whole move, from the first stroke starting to withdraw to the
 * last one gone; `stroke` is how long any one element takes on its own. The
 * difference between them, 46f, is the stagger the reversed cue table is
 * spread across - see the module doc's "Order" section.
 *
 * 14f per stroke against `draw`'s 22f: a line being taken back is a faster
 * gesture than a line being laid down, because withdrawing it requires none of
 * the aim that drawing it did.
 */
export const CONSOLE_RETRACT = {
  /** The whole retraction, first stroke withdrawing to last stroke gone. */
  span: 60,
  /** One element's own withdrawal, inside that span. */
  stroke: 14,
} as const;

/** A request to un-draw the console. See {@link ConsoleProps.retract}. */
export interface ConsoleRetract {
  /**
   * The absolute composition frame the retraction begins - the frame the
   * last-drawn element (the lower row) starts withdrawing on. The console is
   * completely gone at `at + span`.
   */
  at: number;
  /** The whole move's length. Defaults to {@link CONSOLE_RETRACT}.span. */
  span?: number;
  /** One element's withdrawal. Defaults to {@link CONSOLE_RETRACT}.stroke. */
  stroke?: number;
}

export interface ConsoleProps {
  /**
   * The window's rectangle in frame pixels. Every interior coordinate is
   * derived from it, so animating this animates the whole console.
   */
  rect: Rect;
  /**
   * The absolute composition frame. A prop, not a `useCurrentFrame()` call:
   * the caller owns the shot's clock. See the module doc on `<Sequence>`.
   */
  frame: number;
  /** Override the draw cues. Defaults to {@link CONSOLE_CUE}. */
  cue?: ConsoleCue;
  /**
   * Un-draw the console, starting at an absolute composition frame.
   *
   * Omitted (the default) the console draws itself on and holds forever, which
   * is exactly what it did before this prop existed - a caller that passes
   * nothing gets identical output frame for frame. Supplied, every element's
   * draw progress runs backwards on a stagger derived by reversing `cue`, so
   * the strokes withdraw along their own paths in the reverse of the order
   * they arrived. See the module doc's "Retraction" and "Order" sections, and
   * note that this is not a fade: nothing here touches opacity.
   */
  retract?: ConsoleRetract;
}

/** The hand-drawn admin console, sized by `rect`. See the module doc. */
export const Console: React.FC<ConsoleProps> = ({ rect, frame, cue = CONSOLE_CUE, retract }) => {
  // How far into its own withdrawal the element drawn at `start` is, 0..1.
  // Zero whenever no retraction was asked for, which is what makes `pen`
  // below arithmetically identical to a bare `draw` call in that case.
  //
  // `rank` is the reversal: 0 for the last-drawn cue (it leaves first), 1 for
  // the first (it leaves last). Clamped, so a caller whose custom cue table
  // puts a staggered family past `cue.lower` still gets a sane schedule
  // rather than a negative delay.
  const undo = (start: number): number => {
    if (!retract) return 0;
    const span = retract.span ?? CONSOLE_RETRACT.span;
    const stroke = retract.stroke ?? CONSOLE_RETRACT.stroke;
    const range = cue.lower - cue.top || 1;
    const rank = Math.min(1, Math.max(0, (cue.lower - start) / range));
    return draw(frame, retract.at + rank * Math.max(0, span - stroke), stroke);
  };

  // Every progress value is a pure function of `frame`, so any frame renders
  // correctly on its own - Remotion may ask for frame 300 having never drawn
  // frame 299. `pen` is that value for one element: drawn on, then taken back
  // off. The subtraction works because an element is always fully drawn (1) by
  // the time its own withdrawal begins, so the result runs 0 up to 1 and back
  // down to 0, and every primitive downstream is a pure function of it.
  const pen = (start: number, duration: number): number =>
    Math.max(0, draw(frame, start, duration) - undo(start));

  const pTop = pen(cue.top, 24);
  const pRight = pen(cue.right, 24);
  const pBottom = pen(cue.bottom, 24);
  const pLeft = pen(cue.left, 24);
  const pBar = pen(cue.bar, 18);
  const pNavRule = pen(cue.navRule, 18);
  const pSearch = pen(cue.search, 18);
  const pIcons = pen(cue.icons, 12);
  const pNav = (n: number) => pen(cue.nav + n * cue.navStep, 14);
  const pCards = pen(cue.cards, 20);
  const pCardTitles = pen(cue.cardTitles, 14);
  const pMetric = (n: number) => pen(cue.metric + n * cue.metricStep, 16);
  const pStatusRows = pen(cue.statusRows, 16);
  const pTasksCard = pen(cue.tasksCard, 20);
  const pTask = (n: number) => pen(cue.task + n * cue.taskStep, 16);
  const pLower = pen(cue.lower, 22);

  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const barY = rect.y + APP_BAR;
  const navX = rect.x + NAV_W;
  const navTop = rect.y + NAV_TOP;

  // The content column, right of the nav rule, and the card grid inside it.
  // `cw` is the only quantity the squeeze actually moves: the nav keeps its
  // width and the gutters keep theirs, so the content column absorbs every
  // pixel the window loses.
  const cx = navX + GUTTER;
  const cw = right - GUTTER - cx;
  const overW = cw * 0.615 - 12;
  const statX = cx + cw * 0.615 + 12;
  const statW = cw * 0.385 - 12;
  const cardY = barY + 34;
  const tasksY = cardY + CARD_H + ROW_GAP;
  const lowerY = tasksY + TASKS_H + ROW_GAP;
  // The search field grows with the content column but stops at its widest, so
  // a full-frame console does not get an absurd 900px search box.
  const searchW = Math.min(SEARCH_MAX_W, cw * 0.5);

  const line = { amplitude: LINE_WOBBLE, segments: 8 };
  const box = { amplitude: BOX_WOBBLE, segments: 6 };

  return (
    <g>
      {/* The window: four sides, drawn in sequence like a hand would. */}
      <Stroke x1={rect.x} y1={rect.y} x2={right} y2={rect.y} p={pTop} seed={1} {...line} />
      <Stroke x1={right} y1={rect.y} x2={right} y2={bottom} p={pRight} seed={2} {...line} />
      <Stroke x1={right} y1={bottom} x2={rect.x} y2={bottom} p={pBottom} seed={3} {...line} />
      <Stroke x1={rect.x} y1={bottom} x2={rect.x} y2={rect.y} p={pLeft} seed={4} {...line} />

      {/* The second pass: the hand going back over its own outline, lighter
          and overshooting further. This is what stops the window reading as
          a CSS border. */}
      <Stroke
        x1={rect.x}
        y1={rect.y}
        x2={right}
        y2={rect.y}
        p={pTop}
        seed={81}
        width={1.4}
        color={GRAPHITE.second}
        over={16}
        {...line}
      />
      <Stroke
        x1={right}
        y1={rect.y}
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
        x2={rect.x}
        y2={bottom}
        p={pBottom}
        seed={83}
        width={1.4}
        color={GRAPHITE.second}
        over={16}
        {...line}
      />
      <Stroke
        x1={rect.x}
        y1={bottom}
        x2={rect.x}
        y2={rect.y}
        p={pLeft}
        seed={84}
        width={1.4}
        color={GRAPHITE.second}
        over={16}
        {...line}
      />

      {/* The app bar and the nav rule. */}
      <Stroke x1={rect.x} y1={barY} x2={right} y2={barY} p={pBar} seed={5} width={2.4} {...line} />
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

      {/* The app bar's search field, and its two right-hand icon blanks. The
          icons hang off the window's right edge, so they ride the squeeze
          without any width term of their own. */}
      <SketchBox
        x={cx}
        y={rect.y + 20}
        width={searchW}
        height={SEARCH_H}
        p={pSearch}
        seed={8}
        weight={2.2}
        {...box}
      />
      <Written x={cx + 20} y={rect.y + 45} text="Search" p={pSearch} size={TYPE.label} />
      <Stroke
        x1={right - 143}
        y1={rect.y + 38}
        x2={right - 121}
        y2={rect.y + 38}
        p={pIcons}
        seed={12}
        width={9}
        over={0}
      />
      <Stroke
        x1={right - 106}
        y1={rect.y + 38}
        x2={right - 84}
        y2={rect.y + 38}
        p={pIcons}
        seed={13}
        width={9}
        over={0}
      />
      <Stroke
        x1={right - 68}
        y1={rect.y + 34}
        x2={right - 24}
        y2={rect.y + 34}
        p={pIcons}
        seed={14}
        width={6}
        over={0}
      />

      {/* The nav, written out by name. Every x here is off the window's left
          edge or the nav rule, both of which the squeeze leaves alone. */}
      {NAV.map((item, i) => (
        <g key={`${item.text}-${i}`}>
          {item.active ? (
            <SketchBox
              x={rect.x + 12}
              y={navTop + i * NAV_STEP - 24}
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
            x={item.head ? rect.x + 34 : rect.x + 66}
            y={navTop + i * NAV_STEP}
            text={item.text}
            p={pNav(i)}
            size={22}
            weight={item.head ? 600 : 400}
          />
          {item.head ? (
            <Stroke
              x1={navX - 44}
              y1={navTop + i * NAV_STEP - 10}
              x2={navX - 30}
              y2={navTop + i * NAV_STEP - 2}
              p={pNav(i)}
              seed={400 + i}
              width={2.4}
              over={0}
            />
          ) : null}
        </g>
      ))}

      {/* Overview: the card the figures live on. */}
      <SketchBox x={cx} y={cardY} width={overW} height={CARD_H} p={pCards} seed={40} {...box} />
      <Written x={cx + PAD} y={cardY + 46} text="Overview" p={pCardTitles} size={28} weight={600} />
      {METRICS.map((metric, i) => (
        <g key={metric.label}>
          {/* Three columns across the card's padded interior, so the figures
              close up as the card narrows instead of running off its edge. */}
          <Written
            x={cx + PAD + (i * (overW - PAD * 2)) / 3}
            y={cardY + 100}
            text={metric.label}
            p={pMetric(i)}
            size={20}
          />
          <Written
            x={cx + PAD + (i * (overW - PAD * 2)) / 3}
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
      <SketchBox x={statX} y={cardY} width={statW} height={CARD_H} p={pCards} seed={48} {...box} />
      <Written
        x={statX + PAD}
        y={cardY + 46}
        text="Status"
        p={pCardTitles}
        size={28}
        weight={600}
      />
      <Stroke
        x1={statX + PAD}
        y1={cardY + 100}
        x2={statX + statW - PAD}
        y2={cardY + 100}
        p={pStatusRows}
        seed={49}
        width={5}
        color={GRAPHITE.second}
        over={2}
        {...line}
      />
      <Stroke
        x1={statX + PAD}
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

      {/* The task table: a pill and a ruled row per task. The pill is fixed
          (it holds a word), the rule beside it takes the squeeze. */}
      <SketchBox x={cx} y={tasksY} width={cw} height={TASKS_H} p={pTasksCard} seed={56} {...box} />
      <Written x={cx + PAD} y={tasksY + 46} text="Tasks" p={pTasksCard} size={28} weight={600} />
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
            x={cx + PAD}
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

      {/* The lower row, the last thing the hand gets to. A 55/45 split of the
          content column, so both cards narrow together. */}
      <SketchBox
        x={cx}
        y={lowerY}
        width={cw * 0.55 - 12}
        height={LOWER_H}
        p={pLower}
        seed={70}
        {...box}
      />
      <Written
        x={cx + PAD}
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
        height={LOWER_H}
        p={pLower}
        seed={76}
        {...box}
      />
      <Written
        x={cx + cw * 0.55 + 12 + PAD}
        y={lowerY + 44}
        text="Security monitoring"
        p={pLower}
        size={TYPE.body}
        weight={600}
      />
    </g>
  );
};
