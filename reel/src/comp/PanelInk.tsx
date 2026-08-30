/**
 * @module reel/comp/PanelInk
 * @description The extension panel climbing from a graphite sketch to a solid
 * recreation of itself, in four discrete fidelity levels.
 *
 * This is step three of the film's overture. The Okta admin console has been
 * drawn full-frame in graphite (`comp/Overture` + `comp/Console`), the panel has
 * arrived from the right and squeezed it narrower, and now the panel itself is
 * drawn and then made real. The console retracts afterwards and the title is
 * written beside a panel that is already solid, so by the time the film says its
 * own name the product has stopped being a drawing. The whole argument of the
 * opening is in that order: the world before the panel is a sketch, the panel is
 * the thing that is actually there.
 *
 * ## The levels, and why four rather than three or five
 *
 * The brief proposed four and four is what shipped, but not the four that were
 * proposed: the boundaries moved after looking at renders of every level and
 * every mid-wipe frame.
 *
 * 0. **Graphite.** The panel's docked left edge, the context bar, the nine tabs
 *    as ticks with the selected one ruled, the search field, four row cards, the
 *    findings card and its dividers, and the status bar with its four pills.
 *    Structure only, drawn on by `pencil/draw` over ~2.1s. No type, because a
 *    hand that writes out twenty strings takes longer than the whole overture
 *    has - and the first cut, which drew only the two chrome rules and the
 *    cards, was a sketch of *a* panel rather than of this one. The nine ticks
 *    are what make it the extension's.
 * 1. **Blocked out.** Real surfaces: white chrome, the canvas, real cards with
 *    real radii and real borders, and a neutral block standing in for every
 *    glyph and every string. This is the biggest single jump in the ladder and
 *    it is deliberately the first one, because the moment worth staging is
 *    "the drawing became an object", not "the object got better".
 * 2. **Typed.** Every string is the app's real string at the app's real size,
 *    weight and colour ramp. Icons are still blocks. Flat: no brand colour, no
 *    status colour, no state, no depth.
 * 3. **Solid.** Colour, glyphs, state and depth arrive together: the primary
 *    Home tab and its underline, the focused search ring, the hovered row's
 *    darker border, the linked counts under the findings card, the green Ready
 *    dot, the Cancel button's danger wash, and a soft shadow under the findings
 *    card.
 *
 * **A fifth level was cut.** The first cut split level 3 into "colour" and then
 * "glyphs and depth". Rendered, the two frames are nearly indistinguishable at
 * a glance and the extra 44 frames read as the ramp stalling one rung short of
 * the top. Landing colour, glyphs, state and shadow on one edge is what makes
 * the last wipe the one you feel.
 *
 * **Three levels was also cut**, for the opposite reason: folding "blocked out"
 * and "typed" together means the wipe hands graphite straight to finished type,
 * which is a screenshot appearing, not a fidelity ladder. The step where the
 * shapes are right and the words are not yet there is the step that says the
 * panel is being *built*.
 *
 * ## One geometry, three renderings
 *
 * Levels 1 to 3 are the same function, {@link Surface}, at three values of one
 * `level` prop. That is not tidiness, it is the correctness condition: a wipe
 * between two renderings that disagree about where a row starts shows the
 * disagreement as a tear travelling down the frame. Sharing the geometry makes
 * the tear impossible rather than unlikely.
 *
 * The same trick sizes level 1's blocks. {@link Surface}'s `txt` helper takes
 * the real string at every level; above level 1 it sets it, and at level 1 it
 * draws a block whose width is estimated from that same string. So a blocked-out
 * label and the type that replaces it are the same length by construction, and
 * nothing grows or shrinks across the wipe.
 *
 * ## The figures are read, not typed
 *
 * `SCRIPT.md`'s first rule for the synthetic layer is that every figure on
 * screen came off the capture. Four of the six numbers on the findings card are
 * `figure()` reads from `captures/home.json` (`emptyGroups`, `unruled`,
 * `pausedRules`, `groupsTotal`), and both application denominators plus the rule
 * denominator come from the `apps` and `rules` manifests. So a re-shoot that
 * changes the org changes this panel, and a manifest that stops carrying a key
 * fails the render rather than printing a stale number.
 *
 * **One number here is not a read, and it is called out rather than hidden.**
 * `Push apps pushing nothing: 2` is a join `useOrgFigures` computes over the
 * demo snapshot; no walk reads it, so {@link PUSH_APPS_UNREAD} carries it as a
 * literal. It is kept because the card has five rows on film and a four-row
 * recreation is a different component, which is the failure this shot exists to
 * avoid. `walks/home.mjs` is already parked on this card for four other reads;
 * one more selector retires the constant. Same shape as `SCRIPT.md`'s
 * `REVISION 6` and `REVISION 7`: filed, not dropped.
 *
 * `capture()` is called inside the component, never at module scope, so a stale
 * manifest fails this one composition instead of taking down `Reel.tsx`'s
 * module-scope chapter list with it. {@link PANEL_INK_FRAMES} is a literal for
 * the same reason.
 *
 * ## What was rejected
 *
 * **Filming the real panel for this shot.** The overture's panel is a full
 * height slab at the frame's right edge and the captures are 840x980 of a panel
 * mid-walk, with a cursor in them. There is no crop of the footage that is a
 * still, empty, freshly-opened panel, and there is no wipe from graphite into a
 * video element that does not show the video's first frame flashing.
 *
 * **Reusing `PANEL_RECT`.** The chapters draw the panel as a 720x840 rounded
 * card on the left at x=76. This one is a 680x1080 slab on the right. The
 * discontinuity is intended - the panel leaves the frame before chapter one and
 * re-enters at its home - so this file matches the app's *interior* and shares
 * none of the chapter staging.
 *
 * **A drop shadow on the panel's stage side.** The panel bleeds off three edges,
 * so the only edge that could carry one is the left, and a soft dark band down
 * the left of a flat `STAGE.back` is a gradient on the dark stage, which bands
 * in an 8-bit encode. The depth at level 3 is interior instead, on the light
 * surface where the brief says a gradient is harmless.
 *
 * ## Two things a caller must not do
 *
 * Never wrap this in Remotion's `<Sequence>`. Every cue here is a frame offset
 * from {@link PanelInkProps.from}, and `<Sequence>` remaps `useCurrentFrame()`
 * to 0, which does not throw - it silently freezes the climb on level 0. That is
 * also why `frame` is a prop rather than a `useCurrentFrame()` call: the overture
 * owns the shot's clock and this component only reads it.
 *
 * And never render it outside an `<svg>`. It returns a `<g>` in frame-pixel user
 * space, so the overture can put the console, the seam and the title in the same
 * coordinate system.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLOR, STAGE } from '../theme';
import { FRAME } from '../frame';
import type { Rect } from '../layout';
import { GRAPHITE, SketchBox, Stroke, draw } from '../pencil';
// Not from the `pencil` barrel: `Ladder` landed after `pencil/index.ts` was
// written and is not re-exported there yet.
import { Ladder, type LadderStep } from '../pencil/Ladder';
import { capture, figure, figureNumber } from '../captures';

/**
 * Where the panel stands during the overture: a browser side panel, docked to
 * the right edge, full frame height, bleeding off the top and bottom.
 *
 * Exported so the overture stages the panel from here rather than re-declaring
 * a rectangle that would then drift from the one every interior coordinate in
 * this file is derived from.
 *
 * Its right edge is the frame's right edge, which is where `Reel.tsx` hoists the
 * film's 4px accent seam (x 1916 to 1920). Nothing load-bearing is drawn in
 * those pixels: the rightmost thing here is the Cancel button's right edge at
 * x=1900, and the panel has no right border to lose because a docked panel does
 * not have one.
 */
export const PANEL_INK_RECT: Rect = { x: 1240, y: 0, width: 680, height: 1080 };

/**
 * The whole ramp's length in frames, from the first graphite stroke to the end
 * of the hold on the solid panel. 252f is 4.2s at the film's 60fps.
 *
 * A literal, never a value computed from the cue table or from anything that can
 * throw. `Reel.tsx` builds its chapter list at module scope, so a length derived
 * from a manifest read would take the whole bundle down instead of one shot.
 * Kept honest by {@link PANEL_INK_STEPS} being checked against it below.
 */
export const PANEL_INK_FRAMES = 252;

/**
 * When each wipe fires, as an offset from {@link PanelInkProps.from}.
 *
 * All three sweep downward, the direction the panel is read and the direction
 * the graphite was drawn in. An earlier cut alternated down / right / down to
 * keep the eye moving; watched back it reads as three different effects rather
 * than one staircase, which is exactly the "reel of effects" the design brief
 * warns a keynote vocabulary is supposed to prevent.
 *
 * The 22f gap between one wipe landing and the next starting is the hold that
 * makes each level a level. Removed, the three wipes read as one long dissolve
 * with texture in it.
 */
export const PANEL_INK_STEPS: readonly LadderStep[] = [
  { at: 132, direction: 'down' },
  { at: 176, direction: 'down' },
  { at: 220, direction: 'down' },
];

/**
 * The graphite pass's draw cues, as offsets from `from`.
 *
 * The order is a hand's order: the docked edge first, because it is what makes
 * the shape a panel rather than a rectangle, then the chrome, then down the
 * page. The last stroke lands at 128, four frames before the first wipe.
 */
const CUE = {
  /** The docked left edge, drawn top to bottom. */
  edge: 0,
  /** The context bar's underside. */
  ctxRule: 20,
  /** The tab rail's underside. */
  railRule: 30,
  /** The search field. */
  search: 40,
  /** The three section headings, each a single scribbled mark. */
  section: [52, 68, 84],
  /** The four working-set rows, one every 6f. */
  row: 56,
  rowStep: 6,
  /** The findings card, then its four dividers one every 4f. */
  card: 88,
  divider: 98,
  dividerStep: 4,
  /** The context bar's own marks: the org dot, its name, and the Pin control. */
  ctxMarks: 24,
  /** The rail's nine tab ticks, one every 1.5f. */
  tab: 34,
  tabStep: 1.5,
  /** The status bar's top edge, then its dot and four pills. */
  footRule: 108,
  footMarks: 116,
} as const;

/**
 * The panel's white.
 *
 * The one colour here that is not a token, because there is no token to import:
 * the app paints these surfaces with Tailwind's `bg-white`, which is a utility
 * rather than a custom property, so `sync-theme.mjs` has nothing to mirror into
 * `theme.generated.ts`. `comp/Panel` already sets the same literal for the same
 * reason (`FRAME_STYLE`'s `background: '#fff'`). Everything else on this surface
 * comes from `COLOR`.
 */
const PAPER = '#ffffff';

/**
 * `Push apps pushing nothing`, the one number on this card no walk reads.
 *
 * `useOrgFigures` derives it by joining the app rows that have a stored
 * assignment against the groups some rule targets; it is on screen in
 * `captures/home.mp4` at the `findings` beat and it is 2, but `walks/home.mjs`
 * reads `unruled`, `emptyGroups`, `pausedRules` and `groupsTotal` off that frame
 * and not this. See the module doc for why the row is kept anyway and what
 * retires this constant.
 */
const PUSH_APPS_UNREAD = 2;

/** The panel's interior geometry, in panel-local px. Mirrors `captures/home.mp4`. */
const L = {
  /** The panel's own width; every x below is inside it. */
  w: PANEL_INK_RECT.width,
  h: PANEL_INK_RECT.height,
  /** The gutter every card and every heading hangs off. */
  pad: 20,
  /** The context bar's height, and the tab rail's underside. */
  ctxH: 48,
  railH: 90,
  /** The search field. */
  search: { y: 110, h: 56 },
  /** The three headings' baselines. */
  heads: [206, 392, 578],
  /** The four working-set rows' tops, and their shared height. */
  rows: [222, 288, 408, 474],
  rowH: 60,
  /** The findings card. */
  card: { y: 600, rowH: 66 },
  /** The two caption lines under it. */
  caption: 958,
  note: 982,
  /** The status bar. */
  footY: 1036,
} as const;

/** The content column's width: the panel less both gutters. */
const CW = L.w - L.pad * 2;

/** A fidelity level of the ink surface. Level 0 is graphite and is drawn apart. */
type SurfaceLevel = 1 | 2 | 3;

/** One row of the working set: what the app shows in Pinned and Recent. */
interface WorkingRow {
  icon: IconName;
  title: string;
  sub: string;
  /** The one row the capture catches under the pointer, hovered. */
  hovered?: boolean;
}

/**
 * The Pinned and Recent rows, transcribed from `captures/home.mp4`.
 *
 * Two and two, which is also what the rig read (`pinned` 2, `recent` 2) and what
 * the Home chapter's `working-set` slide says out loud, so this list cannot grow
 * without contradicting a figure the film prints.
 */
const PINNED: readonly WorkingRow[] = [
  { icon: 'users', title: 'Engineering - All', sub: 'Group · left on Attributes' },
  { icon: 'user', title: 'Amara Okonkwo', sub: 'User · left on Groups · 2 days ago' },
];

const RECENT: readonly WorkingRow[] = [
  { icon: 'user', title: 'Tomas Lindqvist', sub: 'User · left on Apps' },
  { icon: 'users', title: 'Sales - All', sub: 'Group · 3 days ago', hovered: true },
];

/** The tab rail, in the app's own order. `Home` is the selected tab. */
const TABS: readonly IconName[] = [
  'user',
  'users',
  'device',
  'bolt',
  'shield',
  'download',
  'terminal',
  'clipboard',
];

/** The status bar's four inert pills. */
const PILLS: readonly { label: string; width: number }[] = [
  { label: 'Queue', width: 80 },
  { label: 'Active', width: 80 },
  { label: 'Rate', width: 70 },
  { label: 'ETA', width: 66 },
];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

/** The glyphs this recreation needs. Drawn in a 24x24 box, scaled at use. */
type IconName =
  | 'home'
  | 'user'
  | 'users'
  | 'device'
  | 'bolt'
  | 'shield'
  | 'download'
  | 'terminal'
  | 'clipboard'
  | 'search'
  | 'close'
  | 'chevron'
  | 'refresh'
  | 'pin';

/**
 * One glyph, in a 24x24 box centred on `cx`/`cy` and scaled to `size`.
 *
 * Stroked outlines rather than filled shapes, because the app's own registry
 * (`shared/Icon.tsx`) is a stroked 24-box set and a filled recreation of it
 * reads as a different icon family the moment the two are cut together. No
 * third-party mark is reproduced: these are the generic shapes the app draws.
 */
const Glyph: React.FC<{
  name: IconName;
  cx: number;
  cy: number;
  size: number;
  color: string;
  weight?: number;
}> = ({ name, cx, cy, size, color, weight = 1.7 }) => {
  const k = size / 24;
  const common = {
    stroke: color,
    strokeWidth: weight / k,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  const body = (() => {
    switch (name) {
      case 'home':
        return <path d="M4 11 L12 4 L20 11 V20 H4 Z" {...common} />;
      case 'user':
        return (
          <>
            <circle cx={12} cy={9} r={3.4} {...common} />
            <path d="M5.5 20 a6.5 6.5 0 0 1 13 0" {...common} />
          </>
        );
      case 'users':
        return (
          <>
            <circle cx={9.5} cy={9} r={3} {...common} />
            <circle cx={17} cy={10} r={2.3} {...common} />
            <path d="M4 19 a5.5 5.5 0 0 1 11 0" {...common} />
            <path d="M16 19 a4 4 0 0 1 4.5 -3.6" {...common} />
          </>
        );
      case 'device':
        return (
          <>
            <rect x={8} y={3} width={8} height={18} rx={2} {...common} />
            <path d="M11 18 H13" {...common} />
          </>
        );
      case 'bolt':
        return <path d="M13 3 L6 13 H11 L10 21 L18 10 H12 Z" {...common} />;
      case 'shield':
        return (
          <>
            <path d="M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z" {...common} />
            <path d="M9 12 l2 2 l4 -4" {...common} />
          </>
        );
      case 'download':
        return <path d="M12 4 V15 M7.5 11 l4.5 4.5 l4.5 -4.5 M5 20 H19" {...common} />;
      case 'terminal':
        return (
          <>
            <rect x={3} y={4} width={18} height={16} rx={2} {...common} />
            <path d="M7 10 l3 2.5 l-3 2.5 M13 15.5 H17" {...common} />
          </>
        );
      case 'clipboard':
        return (
          <>
            <rect x={5} y={4} width={14} height={17} rx={2} {...common} />
            <rect x={9} y={2} width={6} height={4} rx={1} {...common} />
          </>
        );
      case 'search':
        return (
          <>
            <circle cx={10.5} cy={10.5} r={6} {...common} />
            <path d="M15 15 L20 20" {...common} />
          </>
        );
      case 'close':
        return <path d="M6 6 L18 18 M18 6 L6 18" {...common} />;
      case 'chevron':
        return <path d="M9 5 l7 7 l-7 7" {...common} />;
      case 'refresh':
        return (
          <>
            <path d="M20 12 a8 8 0 1 1 -2.6 -5.9" {...common} />
            <path d="M20 4 V7 H17" {...common} />
          </>
        );
      case 'pin':
        return <path d="M10 3 h4 v6 l3 3.5 H7 L10 9 Z M12 12.5 V21" {...common} />;
    }
  })();
  return <g transform={`translate(${cx} ${cy}) scale(${k}) translate(-12 -12)`}>{body}</g>;
};

// ---------------------------------------------------------------------------
// The ink surface: one geometry, three levels
// ---------------------------------------------------------------------------

/**
 * The panel's interior at fidelity 1, 2 or 3.
 *
 * The `level` prop is read in exactly three places - `txt`, `mark` and `hue` -
 * so a level can never move a coordinate, only change what is drawn at it. See
 * the module doc on why that is a correctness condition and not a style.
 */
const Surface: React.FC<{ level: SurfaceLevel; figures: PanelFigures }> = ({ level, figures }) => {
  const typed = level >= 2;
  const solid = level >= 3;

  /** A colour that only exists once the panel is solid; flat neutral before. */
  const hue = (colour: string, flat: string) => (solid ? colour : flat);

  /**
   * A string, set at level 2 and above and blocked out below it.
   *
   * The block's width is estimated from the same string that will replace it
   * (Inter runs about 0.53 of its size per character across mixed case), so the
   * two are the same length by construction and nothing shifts under the wipe.
   */
  const txt = (
    x: number,
    y: number,
    text: string,
    o: { size: number; weight?: number; fill?: string; anchor?: 'start' | 'end'; track?: number },
  ) => {
    const weight = o.weight ?? 400;
    const fill = o.fill ?? COLOR['neutral-900'];
    if (typed) {
      return (
        <text
          x={x}
          y={y}
          fontSize={o.size}
          fontWeight={weight}
          fill={fill}
          letterSpacing={o.track}
          textAnchor={o.anchor === 'end' ? 'end' : 'start'}
        >
          {text}
        </text>
      );
    }
    const w = text.length * o.size * 0.53 + (o.track ?? 0) * text.length;
    const h = Math.round(o.size * 0.62);
    return (
      <rect
        x={o.anchor === 'end' ? x - w : x}
        y={y - h}
        width={w}
        height={h}
        rx={h / 2}
        fill={weight >= 600 ? COLOR['neutral-400'] : COLOR['neutral-300']}
      />
    );
  };

  /** A glyph at level 3, a rounded block standing in for it below. */
  const mark = (name: IconName, cx: number, cy: number, size: number, colour: string) =>
    solid ? (
      <Glyph name={name} cx={cx} cy={cy} size={size} color={colour} />
    ) : (
      <rect
        x={cx - size / 2}
        y={cy - size / 2}
        width={size}
        height={size}
        rx={size * 0.28}
        fill={COLOR['neutral-300']}
      />
    );

  /** A working-set row, in Pinned or Recent. */
  const row = (item: WorkingRow, y: number) => {
    // The app's hover state repaints the border and nothing else, so it is a
    // level 3 arrival: at level 2 every row is at rest.
    const border = solid && item.hovered ? COLOR['neutral-500'] : COLOR['neutral-200'];
    return (
      <g key={item.title}>
        <rect
          x={L.pad}
          y={y}
          width={CW}
          height={L.rowH}
          rx={6}
          fill={PAPER}
          stroke={border}
          strokeWidth={1}
        />
        {mark(item.icon, L.pad + 27, y + L.rowH / 2, 22, COLOR['neutral-400'])}
        {txt(L.pad + 50, y + 27, item.title, { size: 15, weight: 600 })}
        {txt(L.pad + 50, y + 46, item.sub, { size: 13, fill: COLOR['neutral-600'] })}
        {mark('close', L.w - L.pad - 24, y + L.rowH / 2, 16, COLOR['neutral-400'])}
      </g>
    );
  };

  /** A heading over a section: uppercase, tracked, quiet. */
  const heading = (text: string, y: number) =>
    txt(L.pad, y, text, {
      size: 12,
      weight: 600,
      fill: COLOR['neutral-600'],
      track: 0.9,
    });

  return (
    <g fontFamily="Inter">
      {/* The canvas the whole panel sits on. */}
      <rect x={0} y={0} width={L.w} height={L.h} fill={COLOR.canvas} />

      {/* Chrome: the context bar and the tab rail share one white plane. */}
      <rect x={0} y={0} width={L.w} height={L.railH} fill={PAPER} />
      <rect x={0} y={L.railH - 1} width={L.w} height={1} fill={COLOR['neutral-200']} />

      {/* The context bar: which org the panel is looking at, and Pin. */}
      <circle cx={L.pad + 7} cy={24} r={5} fill={COLOR['neutral-400']} />
      {txt(L.pad + 22, 30, 'Okta Admin', { size: 15, weight: 700 })}
      {mark('refresh', L.w - L.pad - 116, 24, 18, COLOR['neutral-400'])}
      <rect
        x={L.w - L.pad - 92}
        y={8}
        width={92}
        height={32}
        rx={6}
        fill={PAPER}
        stroke={COLOR['neutral-200']}
        strokeWidth={1}
      />
      {mark('pin', L.w - L.pad - 70, 24, 16, COLOR['neutral-400'])}
      {txt(L.w - L.pad - 52, 30, 'Pin', { size: 14, fill: COLOR['neutral-600'] })}

      {/* The tab rail. Home is selected; the other eight are icon only. */}
      {mark('home', L.pad + 12, 66, 20, hue(COLOR.primary, COLOR['neutral-400']))}
      {txt(L.pad + 28, 72, 'Home', {
        size: 15,
        weight: 600,
        fill: hue(COLOR['primary-text'], COLOR['neutral-700']),
      })}
      <rect
        x={L.pad}
        y={L.railH - 3}
        width={80}
        height={3}
        fill={hue(COLOR.primary, COLOR['neutral-300'])}
      />
      {TABS.map((name, i) => (
        <g key={name}>{mark(name, 122 + i * 46, 66, 20, COLOR['neutral-600'])}</g>
      ))}

      {/* The jump bar, focused - which is how the Home capture opens. */}
      {solid ? (
        <rect
          x={L.pad - 4}
          y={L.search.y - 4}
          width={CW + 8}
          height={L.search.h + 8}
          rx={11}
          fill="none"
          stroke={COLOR['primary-highlight']}
          strokeWidth={2}
        />
      ) : null}
      <rect
        x={L.pad}
        y={L.search.y}
        width={CW}
        height={L.search.h}
        rx={8}
        fill={PAPER}
        stroke={hue(COLOR.primary, COLOR['neutral-300'])}
        strokeWidth={solid ? 2 : 1}
      />
      {mark('search', L.pad + 28, L.search.y + L.search.h / 2, 18, COLOR['neutral-400'])}
      {txt(L.pad + 52, L.search.y + 35, 'Search groups, apps, users, rules, etc.', {
        size: 16,
        fill: COLOR['neutral-500'],
      })}

      {/* The working set: two pinned, two recent. */}
      {heading('PINNED', L.heads[0])}
      {PINNED.map((item, i) => row(item, L.rows[i]))}
      {heading('RECENT', L.heads[1])}
      {RECENT.map((item, i) => row(item, L.rows[2 + i]))}

      {/* This org: the findings card the whole Home chapter is about. */}
      {heading('THIS ORG', L.heads[2])}
      {mark('refresh', L.w - L.pad - 10, L.heads[2] - 5, 18, COLOR['neutral-400'])}
      <g style={solid ? { filter: `drop-shadow(0 2px 6px ${COLOR['neutral-300']})` } : undefined}>
        <rect
          x={L.pad}
          y={L.card.y}
          width={CW}
          height={figures.findings.length * L.card.rowH}
          rx={6}
          fill={PAPER}
          stroke={COLOR['neutral-200']}
          strokeWidth={1}
        />
      </g>
      {figures.findings.map((finding, i) => {
        const y = L.card.y + i * L.card.rowH;
        return (
          <g key={finding.label}>
            {i > 0 ? (
              <rect x={L.pad} y={y} width={CW} height={1} fill={COLOR['neutral-200']} />
            ) : null}
            {txt(L.pad + 70, y + 42, String(finding.count), {
              size: 26,
              weight: 700,
              anchor: 'end',
            })}
            {txt(L.pad + 84, y + 32, finding.label, { size: 15, weight: 600 })}
            {txt(L.pad + 84, y + 51, finding.of, { size: 13, fill: COLOR['neutral-600'] })}
            {mark('chevron', L.w - L.pad - 24, y + L.card.rowH / 2, 16, COLOR['neutral-400'])}
          </g>
        );
      })}

      {/* The card's own caption: three linked totals, then the standing note. */}
      {typed ? (
        <text x={L.pad} y={L.caption} fontSize={14} fill={COLOR['neutral-600']}>
          <tspan fill={hue(COLOR['primary-text'], COLOR['neutral-700'])}>{figures.totals[0]}</tspan>
          <tspan fill={COLOR['neutral-400']}> · </tspan>
          <tspan fill={hue(COLOR['primary-text'], COLOR['neutral-700'])}>{figures.totals[1]}</tspan>
          <tspan fill={COLOR['neutral-400']}> · </tspan>
          <tspan fill={hue(COLOR['primary-text'], COLOR['neutral-700'])}>{figures.totals[2]}</tspan>
        </text>
      ) : (
        <rect
          x={L.pad}
          y={L.caption - 10}
          width={302}
          height={10}
          rx={5}
          fill={COLOR['neutral-300']}
        />
      )}
      {txt(L.pad, L.note, 'Counts as Okta reports them, read today', {
        size: 13,
        fill: COLOR['neutral-500'],
      })}

      {/* The status bar: the scheduler's own readout, idle. */}
      <rect x={0} y={L.footY} width={L.w} height={L.h - L.footY} fill={PAPER} />
      <rect x={0} y={L.footY} width={L.w} height={1} fill={COLOR['neutral-200']} />
      <circle
        cx={L.pad + 7}
        cy={L.footY + 22}
        r={5}
        fill={hue(COLOR.success, COLOR['neutral-400'])}
      />
      {txt(L.pad + 22, L.footY + 27, 'Ready', { size: 14, weight: 600 })}
      {
        PILLS.reduce<{ x: number; out: React.ReactNode[] }>(
          (acc, pill) => {
            acc.out.push(
              <g key={pill.label}>
                <rect
                  x={acc.x}
                  y={L.footY + 8}
                  width={pill.width}
                  height={28}
                  rx={6}
                  fill={COLOR['neutral-50']}
                  stroke={COLOR['neutral-200']}
                  strokeWidth={1}
                />
                {txt(acc.x + 12, L.footY + 27, pill.label, {
                  size: 13,
                  weight: 600,
                  fill: COLOR['neutral-700'],
                })}
                {txt(acc.x + pill.width - 14, L.footY + 27, '-', {
                  size: 13,
                  fill: COLOR['neutral-400'],
                  anchor: 'end',
                })}
              </g>,
            );
            return { x: acc.x + pill.width + 8, out: acc.out };
          },
          { x: 136, out: [] },
        ).out
      }
      <rect
        x={L.w - L.pad - 84}
        y={L.footY + 8}
        width={84}
        height={28}
        rx={6}
        fill={hue(COLOR['danger-light'], COLOR['neutral-100'])}
      />
      {txt(L.w - L.pad - 22, L.footY + 27, 'Cancel', {
        size: 13,
        weight: 600,
        // Disabled, and it stays grey at every level. The capture's Cancel is
        // greyed out with nothing to cancel; painting it `danger-text` because
        // level 3 is "where the colour arrives" would make the loudest thing on
        // a resting panel a button that is not offered.
        fill: COLOR['neutral-400'],
        anchor: 'end',
      })}
    </g>
  );
};

// ---------------------------------------------------------------------------
// Level 0: the graphite pass
// ---------------------------------------------------------------------------

/**
 * The panel drawn by hand: its docked edge, its two bars of chrome, and every
 * major division of its body. `t` is frames since the ramp began.
 *
 * No type. A hand writing out twenty strings would take longer than the whole
 * overture, and the levels above are where the words belong: level 0's job is to
 * say *there is a panel here and it is not real yet*, which is shape, not copy.
 * The three headings get a single scribbled mark each so the sections read as
 * sections rather than as floating cards.
 *
 * There is no right edge, no top edge and no bottom edge, because a panel docked
 * to the frame's right edge at full height has none of them on screen. Drawing
 * them would have made the sketch a floating card, which is the chapters'
 * staging and deliberately not this shot's.
 */
const graphite = (t: number, findings: number): React.ReactNode => {
  const line = { amplitude: 1.6, segments: 8 };
  const box = { amplitude: 1.2, segments: 6 };
  const pRow = (n: number) => draw(t, CUE.row + n * CUE.rowStep, 18);
  const pDivider = (n: number) => draw(t, CUE.divider + n * CUE.dividerStep, 14);
  const pCard = draw(t, CUE.card, 20);
  const pCtx = draw(t, CUE.ctxMarks, 14);
  const pFoot = draw(t, CUE.footMarks, 14);

  return (
    <g>
      {/* The docked edge: the stroke that makes this a panel. Drawn twice, the
          second pass lighter and overshooting further, so it does not read as
          a CSS border. */}
      <Stroke
        x1={0}
        y1={-14}
        x2={0}
        y2={L.h + 14}
        p={draw(t, CUE.edge, 34)}
        seed={11}
        width={3}
        {...line}
      />
      <Stroke
        x1={0}
        y1={-14}
        x2={0}
        y2={L.h + 14}
        p={draw(t, CUE.edge, 34)}
        seed={12}
        width={1.4}
        color={GRAPHITE.second}
        over={18}
        {...line}
      />

      {/* The two bars of chrome. */}
      <Stroke
        x1={0}
        y1={L.ctxH}
        x2={L.w}
        y2={L.ctxH}
        p={draw(t, CUE.ctxRule, 18)}
        seed={13}
        width={2.2}
        {...line}
      />
      <Stroke
        x1={0}
        y1={L.railH}
        x2={L.w}
        y2={L.railH}
        p={draw(t, CUE.railRule, 18)}
        seed={14}
        width={2.4}
        {...line}
      />

      {/* The context bar's three marks: the org dot, its name, and Pin. Type
          does not arrive until level 2, so the name is a stroke standing where
          the word will be - the hand noting that something is written here. */}
      <Stroke
        x1={L.pad + 5}
        y1={24}
        x2={L.pad + 9}
        y2={24}
        p={pCtx}
        seed={17}
        width={10}
        color={GRAPHITE.second}
        over={0}
      />
      <Stroke
        x1={L.pad + 22}
        y1={24}
        x2={L.pad + 112}
        y2={24}
        p={pCtx}
        seed={15}
        width={7}
        color={GRAPHITE.second}
        over={2}
        {...line}
      />
      <SketchBox
        x={L.w - L.pad - 92}
        y={8}
        width={92}
        height={32}
        p={pCtx}
        seed={16}
        weight={2}
        over={3}
        {...box}
      />

      {/* The nine tabs, as ticks along the rail, and the selected tab's rule.
          Nine marks is what makes this the extension's panel rather than any
          panel, which is level 0's whole job. */}
      {Array.from({ length: 9 }, (_, i) => (
        <Stroke
          key={i}
          x1={L.pad + 4 + i * 46}
          y1={66}
          x2={L.pad + 22 + i * 46}
          y2={66}
          p={draw(t, CUE.tab + i * CUE.tabStep, 12)}
          seed={90 + i}
          width={13}
          color={GRAPHITE.second}
          over={0}
        />
      ))}
      <Stroke
        x1={L.pad}
        y1={L.railH - 4}
        x2={L.pad + 80}
        y2={L.railH - 4}
        p={draw(t, CUE.tab + 9 * CUE.tabStep, 12)}
        seed={99}
        width={4}
        over={1}
      />

      <SketchBox
        x={L.pad}
        y={L.search.y}
        width={CW}
        height={L.search.h}
        p={draw(t, CUE.search, 18)}
        seed={20}
        weight={2.4}
        {...box}
      />

      {/* A mark per heading: the hand noting a section without writing it. */}
      {L.heads.map((y, i) => (
        <Stroke
          key={y}
          x1={L.pad}
          y1={y - 5}
          x2={L.pad + 78}
          y2={y - 5}
          p={draw(t, CUE.section[i], 12)}
          seed={30 + i}
          width={6}
          color={GRAPHITE.second}
          over={2}
          {...line}
        />
      ))}

      {L.rows.map((y, i) => (
        <SketchBox
          key={y}
          x={L.pad}
          y={y}
          width={CW}
          height={L.rowH}
          p={pRow(i)}
          seed={40 + i * 4}
          weight={2.2}
          over={4}
          {...box}
        />
      ))}

      <SketchBox
        x={L.pad}
        y={L.card.y}
        width={CW}
        height={findings * L.card.rowH}
        p={pCard}
        seed={60}
        weight={2.4}
        {...box}
      />
      {Array.from({ length: findings - 1 }, (_, i) => (
        <Stroke
          key={i}
          x1={L.pad}
          y1={L.card.y + (i + 1) * L.card.rowH}
          x2={L.pad + CW}
          y2={L.card.y + (i + 1) * L.card.rowH}
          p={pDivider(i)}
          seed={70 + i}
          width={1.8}
          color={GRAPHITE.second}
          over={3}
          {...line}
        />
      ))}

      {/* The status bar: its top edge, the state dot, and the four inert pills.
          It is the panel's one piece of chrome the app never scrolls, so the
          sketch closes on it. */}
      <Stroke
        x1={0}
        y1={L.footY}
        x2={L.w}
        y2={L.footY}
        p={draw(t, CUE.footRule, 16)}
        seed={80}
        width={2.4}
        {...line}
      />
      <Stroke
        x1={L.pad + 5}
        y1={L.footY + 22}
        x2={L.pad + 9}
        y2={L.footY + 22}
        p={pFoot}
        seed={82}
        width={10}
        color={GRAPHITE.second}
        over={0}
      />
      <Stroke
        x1={L.pad + 22}
        y1={L.footY + 22}
        x2={L.pad + 68}
        y2={L.footY + 22}
        p={pFoot}
        seed={81}
        width={7}
        color={GRAPHITE.second}
        over={2}
        {...line}
      />
      {
        PILLS.reduce<{ x: number; out: React.ReactNode[] }>(
          (acc, pill, i) => {
            acc.out.push(
              <SketchBox
                key={pill.label}
                x={acc.x}
                y={L.footY + 8}
                width={pill.width}
                height={28}
                p={draw(t, CUE.footMarks + i * 2, 12)}
                seed={110 + i * 4}
                weight={2}
                over={3}
                {...box}
              />,
            );
            return { x: acc.x + pill.width + 8, out: acc.out };
          },
          { x: 136, out: [] },
        ).out
      }
      <SketchBox
        x={L.w - L.pad - 84}
        y={L.footY + 8}
        width={84}
        height={28}
        p={draw(t, CUE.footMarks + 8, 12)}
        seed={126}
        weight={2}
        over={3}
        {...box}
      />
    </g>
  );
};

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------

/** One row of the findings card: a count, what it counts, and its denominator. */
interface Finding {
  count: number;
  label: string;
  of: string;
}

/** Everything on this panel that came off a capture rather than out of a head. */
interface PanelFigures {
  findings: readonly Finding[];
  totals: readonly [string, string, string];
}

/**
 * Read the panel's numbers off the manifests, or throw naming what is missing.
 *
 * Called from render, never at module scope: a stale manifest must fail this
 * composition rather than `Reel.tsx`'s module-scope chapter list. See the module
 * doc for the one figure here that is a literal and what retires it.
 */
function readFigures(): PanelFigures {
  const home = capture('home');
  const apps = capture('apps');
  const rules = capture('rules');

  const groupsTotal = figureNumber(home, 'groupsTotal');
  const appsTotal = figure<{ total: number }>(apps, 'inventory').total;
  const inactiveApps = figure<{ shown: number }>(apps, 'inactive').shown;
  const rulesTotal = figure<Record<string, number>>(rules, 'stats')['Total Rules'];

  const ofGroups = `of ${groupsTotal} groups`;
  const ofApps = `of ${appsTotal} applications`;

  return {
    findings: [
      { count: figureNumber(home, 'emptyGroups'), label: 'Groups with no members', of: ofGroups },
      { count: figureNumber(home, 'unruled'), label: 'Groups no rule fills', of: ofGroups },
      { count: inactiveApps, label: 'Deactivated applications', of: ofApps },
      { count: PUSH_APPS_UNREAD, label: 'Push apps pushing nothing', of: ofApps },
      {
        count: figureNumber(home, 'pausedRules'),
        label: 'Paused group rules',
        of: `of ${rulesTotal} group rules`,
      },
    ],
    totals: [`${groupsTotal} groups`, `${appsTotal} applications`, `${rulesTotal} group rules`],
  };
}

export interface PanelInkProps {
  /**
   * The absolute composition frame. A prop, not a `useCurrentFrame()` call: the
   * overture owns the shot's clock. See the module doc on `<Sequence>`.
   */
  frame: number;
  /**
   * The composition frame the ramp begins at. Every cue in this file is an
   * offset from it, so the overture places the whole climb by moving one number.
   */
  from?: number;
  /**
   * Where the panel stands, in frame pixels. Defaults to
   * {@link PANEL_INK_RECT}. Passing a rect only moves the panel; its interior
   * geometry is fixed, because a side panel that gets narrower reflows and this
   * one is a recreation of a panel at one width.
   */
  rect?: Rect;
  /**
   * Override the wipe timings. Offsets from `from`, exactly like
   * {@link PANEL_INK_STEPS}, which is the default. Three steps for four levels;
   * `Ladder` throws on any other count and on any two that overlap.
   */
  steps?: readonly LadderStep[];
}

/**
 * The panel, drawn in graphite and then climbing to solid. See the module doc.
 *
 * Returns a `<g>` in frame-pixel user space, so it must be rendered inside an
 * `<svg>`, and it must never be wrapped in a `<Sequence>`.
 */
export const PanelInk: React.FC<PanelInkProps> = ({
  frame,
  from = 0,
  rect = PANEL_INK_RECT,
  steps = PANEL_INK_STEPS,
}) => {
  const t = frame - from;
  const figures = readFigures();

  // Drawn wider and taller than the panel on every side the wipe can reach. A
  // bbox drawn tight shears off the graphite's own overshoot the moment a wipe
  // mounts - `pencil/convert` records the same trap.
  const bbox: Rect = {
    x: rect.x - 30,
    y: rect.y - 30,
    width: rect.width + 60,
    height: rect.height + 60,
  };

  const levels = [
    (local: number) => graphite(local, figures.findings.length),
    () => <Surface level={1} figures={figures} />,
    () => <Surface level={2} figures={figures} />,
    () => <Surface level={3} figures={figures} />,
  ];

  return (
    <g transform={`translate(${rect.x} ${rect.y})`}>
      {/* The ladder's own coordinates are the panel's, so the bbox is handed
          back into panel space rather than frame space. */}
      <Ladder
        frame={t}
        bbox={{ x: bbox.x - rect.x, y: bbox.y - rect.y, width: bbox.width, height: bbox.height }}
        levels={levels}
        steps={steps}
      />
    </g>
  );
};

/**
 * The studio's preview of the climb: the panel alone on the film's backdrop.
 *
 * The console is not staged here on purpose. This composition exists to judge
 * the four levels and the three wipes between them, and a graphite console
 * filling the other two thirds of the frame is the thing that would be looked at
 * instead.
 */
export const PanelInkPreview: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: STAGE.back }}>
      <svg
        width={FRAME.width}
        height={FRAME.height}
        viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        <PanelInk frame={frame} />
        <rect x={FRAME.width - 4} y={0} width={4} height={FRAME.height} fill={STAGE.accent} />
      </svg>
    </AbsoluteFill>
  );
};
