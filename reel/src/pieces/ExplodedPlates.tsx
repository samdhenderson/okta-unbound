/**
 * @module reel/pieces/ExplodedPlates
 * @description Set piece B1: the cause card, exploded into two plates.
 *
 * `SCRIPT.md`, "SET PIECE B1 - Exploded plates", after the Users chapter's
 * `cause` beat: "The cause card the camera just read, at 5x, docks in whole,
 * lifts, then splits into two plates... A danger wash draws behind the
 * misspelling only. An alert delta bar bridges the gap under a `1 char`
 * caption. Raised-plane bands slide out from behind the plates carrying the
 * sentence, and on the way out the plates rejoin before receding, so the cut
 * back to footage lands on the whole card."
 *
 * This is the film's payoff, and its whole job is one character. The real
 * component (`users/comparison/CauseWorklistRow`) stacks a failing clause above
 * the value that failed it; the split is the film saying what that stack means,
 * and the rejoin is the film handing the card back whole so the cut to footage
 * lands on the same object the camera left.
 *
 * ## Making the missing character legible
 *
 * Two strings a viewer has a second and a half to compare cannot be left to
 * their own metrics. Both are diffed at render time into a shared prefix, the
 * one span that differs, and a shared suffix, and then laid out so those three
 * parts sit in the same columns on both plates:
 *
 * - both plates open with the same {@link HeadColumn}: the clause's own
 *   `user.department == ` on top, and the identical box with its text hidden on
 *   the value plate. So the opening quote of `"Enginering"` starts in the same
 *   column as the opening quote of `"Engineering"` above it, in whatever font
 *   the render box actually resolved. No measurement, no magic numbers.
 * - where the character is missing, the value plate reserves exactly that
 *   character's width with a second hidden span and draws an empty dashed
 *   slot over it. Nothing is printed into the slot; the string on screen is
 *   still character-for-character the one the rig read. The reservation is what
 *   keeps the two suffixes in the same columns, so the only thing that differs
 *   between the two lines is a glowing hole.
 * - the delta bar in the gap is aligned by the same components in the same
 *   order, with their ink taken out. It points at the hole.
 *
 * ## Where it is drawn, and why not into `plot`
 *
 * Every other synthetic surface in this film draws into the `focus` stage's
 * plot, which is the rectangle the *panel's* column leaves behind. This piece
 * deliberately does not. The film's two-zone geometry (panel on the left, the
 * argument to its right) exists because the panel is on screen; for a set piece
 * it has left, and a card still pinned to the right of a column that is not
 * there reads as a slide with a hole in it rather than as an object held up to
 * the light. So the group is centred in the whole frame instead, under the
 * chapter chrome, which is what the design handoff asks a synthetic object for:
 * "isolated on the backdrop, 2x to 6x, no window chrome, no cursor".
 *
 * The label column is the other half of that decision. The alignment device
 * costs the value plate a deep indent - the space above it holds the clause's
 * `user.department ==`, and the value has nothing to put there. Rather than
 * leave that as dead air, each plate's label sits in it, and a hairline rule
 * closes the column, so the empty run reads as what it is: the expression
 * column, which a profile value does not have one of.
 *
 * ## Figures
 *
 * Every string on screen that is *data* comes from the `cause` figure of the
 * `users-cause` capture, which the rig read off the worklist row on camera:
 * `clause` (`user.department == "Engineering"`) and `resolved` (`"Enginering"`).
 * The caption's number is not a constant either - it is the length of the
 * diverging span, computed from those two strings. `readCause` refuses anything
 * it cannot diff rather than printing a shape nobody measured.
 *
 * **The two fixture ids `SCRIPT.md` puts on the plates (`0prFAKE7d8e9f` above
 * `00uFAKE1a2b3c`) are not drawn**, and deliberately: no capture read them, so
 * printing them would break the synthetic layer's first rule inside the piece
 * whose entire argument is that what you are reading was measured. The plates
 * are labelled with the `cause` slide's own two lines instead.
 *
 * Never wrap any of this in Remotion's `<Sequence>` - every verb here is
 * authored in absolute frames and `<Sequence>` remaps `useCurrentFrame()` to 0
 * inside it, silently freezing the piece at its first pose. See
 * `verbs/useVerb.ts`.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { figure } from '../captures';
import type { Manifest } from '../captures';
import { FONT, FRAME, FRAMES, STAGE, TYPE } from '../theme';
import { Dock, Lift, LiftPlate, Recede, Split } from '../verbs';
import type { PieceProps } from './index';

/**
 * How long B1 runs, as a literal.
 *
 * 222 frames is 3.7s at 60fps, the budget `SCRIPT.md` gives the piece. **Stated
 * as a constant and never computed** - `Reel.tsx` resolves every act's length at
 * module scope, so a length derived from a manifest read or a figure lookup
 * (both of which throw by design) would take the whole bundle down rather than
 * the one composition that wanted it. See `pieces/index.ts`.
 */
export const EXPLODED_PLATES_FRAMES = 222;

/* --- The beat sheet, in absolute frames ----------------------------------- */

/** The whole card docks in from the panel's own edge. */
const DOCK_AT = 0;
/** The card lifts: this is the object under discussion. */
const LIFT_AT = 34;
/** The stack parts. The delta bar strikes in at `SPLIT_AT + 14` on its own. */
const SPLIT_AT = 54;
/** The two bands slide out from behind the plates, 8f apart. */
const BAND_AT = 80;
const BAND_STEP = 8;
/** The bands leave first, so the card is alone again when it rejoins. */
const BAND_OUT = 164;
/** The plates rejoin over 12f, per the split verb's own `close` doc. */
const CLOSE_AT = 186;
const CLOSE_OVER = 12;
/** The whole card recedes, landing its last frame on the piece's last frame. */
// Minus one, and the one matters. A piece of N frames renders 0 through N-1,
// so a recede starting at `N - recede` completes on frame N, which is never
// rendered: the last frame the film actually shows still has the object on it
// at about 17 percent, and that ghost is composited over the first frame of
// the footage the piece cuts back to. Found by rendering the last frame rather
// than by reading the arithmetic.
const RECEDE_AT = EXPLODED_PLATES_FRAMES - FRAMES.recede - 1;

/* --- Geometry ------------------------------------------------------------- */

/**
 * The line both plates set their string in. One style object, so the two
 * columns cannot drift apart by a rounding difference in a font size.
 */
const MONO_LINE = 58;
const MONO: React.CSSProperties = {
  fontFamily: FONT.mono,
  fontSize: TYPE.claim,
  lineHeight: `${MONO_LINE}px`,
  whiteSpace: 'pre',
};

/** Plate padding. The product's `p-(--sp-card)`, at the scale this is staged at. */
const PAD = 44;
/** The label column, wide enough for the longer of the two labels on one line. */
const LABEL_COL = 320;
/** Air either side of the hairline that closes the expression column. */
const HEAD_GUTTER = 26;
/**
 * The card's width in the group's own design space.
 *
 * Sized against the content it has to hold - label column, the clause head, the
 * gutter and the literal - with enough slack that a different monospace
 * fallback on another render box has somewhere to go. The mono line is the one
 * thing here whose width is the font's to decide, so it is the one thing this
 * number is chosen against.
 */
const CARD_W = 1400;
/** One plate: padding either side of a single mono line. */
const PLATE_H = PAD * 2 + MONO_LINE;
/** The whole card, joined. */
const CARD_H = PLATE_H * 2;
/** How far apart the plates part. Inside the spec's 96-200 bound, before scale. */
const GAP = 110;
/** The delta bar's height: the gap, less a little air at each plate. */
const BAR_H = 92;
/** Each plate's tilt as the gap opens, in degrees. `SCRIPT.md`: -1.2 and +1.2. */
const TILT: [number, number] = [-1.2, 1.2];

/** A band: one line of the sentence on a raised plane. */
const BAND_H = 68;
/** Air between a band and the parted plate nearest it. */
const BAND_GAP = 46;

/** The group's own height: band, air, plate, gap, plate, air, band. */
const GROUP_H = BAND_H + BAND_GAP + PLATE_H + GAP + PLATE_H + BAND_GAP + BAND_H;
/** The card's top inside the group. Half the gap, since the top plate travels up into it. */
const CARD_Y = BAND_H + BAND_GAP + GAP / 2;

/**
 * The enlargement, applied to the whole group as one transform.
 *
 * The design handoff wants a synthetic object at "2x to 6x" product scale. The
 * mono line is already close to 4x the panel's own `text-xs` clause; this is
 * the rest of it, and it is a transform rather than a second set of type sizes
 * so `TYPE`'s deliberately short scale stays the only place a size is chosen.
 * Scaling the group as one element is also what keeps the alignment device
 * exact: every column, gutter and reserved width scales by the same number.
 */
const SCALE = 1.05;

/**
 * The top of the frame the chapter's own chrome owns: the nav strip, the
 * chapter title under it, and the index band opposite. The group is centred in
 * what is left rather than in the frame, so a bigger card cannot creep up into
 * the band it would have to be read across.
 */
const CHROME_BOTTOM = 200;

/**
 * A token color at an alpha, without writing a second hex.
 *
 * `STAGE.alert` and `STAGE.accent` are the only colors this piece washes with,
 * and a wash needs them translucent. Parsing the token beats typing an `rgba()`
 * literal that would silently stop matching the token it was eyeballed from.
 */
function wash(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* --- The figures, and the diff they carry --------------------------------- */

/** What the rig read off the worklist row, once it has been proved readable. */
interface Cause {
  /** The whole clause, exactly as captured: `user.department == "Engineering"`. */
  clause: string;
  /** Everything in the clause left of its string literal, quote excluded. */
  head: string;
  /** The literal the clause requires, unquoted. */
  expected: string;
  /** The profile's value, unquoted. */
  actual: string;
  /** The leading characters the two share. */
  prefix: string;
  /** What the clause has here and the value does not. */
  expectedMid: string;
  /** What the value has here instead. Empty when the character is simply gone. */
  actualMid: string;
  /** The trailing characters the two share. */
  suffix: string;
  /** How many characters differ. The caption's number, never a constant. */
  deltaChars: number;
}

/**
 * Read the `cause` figure and diff it, or throw naming what is wrong.
 *
 * `figure()` proves the key was read during capture; it does not prove the
 * shape, because its type parameter is an unchecked cast. Everything this piece
 * draws is derived from these two strings, so all of it is checked here: a
 * clause with no string literal in it, a resolved value that is not a quoted
 * string, or two strings that turn out to be identical would each produce a
 * comparison with nothing to compare, which is a rendered claim nobody
 * measured. The render fails instead.
 */
function readCause(manifest: Manifest): Cause {
  const raw = figure<unknown>(manifest, 'cause');
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(
      `${manifest.id}: figure "cause" is not an object - got ${JSON.stringify(raw)}.`,
    );
  }
  const { clause, resolved } = raw as { clause?: unknown; resolved?: unknown };
  if (typeof clause !== 'string' || typeof resolved !== 'string') {
    throw new Error(
      `${manifest.id}: figure "cause" needs string "clause" and "resolved" - got ${JSON.stringify(raw)}.`,
    );
  }

  const literal = clause.match(/^(.*?)"([^"]*)"\s*$/);
  if (!literal) {
    throw new Error(
      `${manifest.id}: figure "cause".clause has no trailing string literal to compare against - got "${clause}".`,
    );
  }
  const head = literal[1];
  const expected = literal[2];

  const quoted = resolved.match(/^"([^"]*)"$/);
  if (!quoted) {
    throw new Error(
      `${manifest.id}: figure "cause".resolved is not a quoted string - got "${resolved}".`,
    );
  }
  const actual = quoted[1];

  if (expected === actual) {
    throw new Error(
      `${manifest.id}: figure "cause" has nothing to compare - the clause requires "${expected}" and the profile says the same.`,
    );
  }

  let shared = 0;
  while (
    shared < expected.length &&
    shared < actual.length &&
    expected[shared] === actual[shared]
  ) {
    shared++;
  }
  let tail = 0;
  while (
    tail < expected.length - shared &&
    tail < actual.length - shared &&
    expected[expected.length - 1 - tail] === actual[actual.length - 1 - tail]
  ) {
    tail++;
  }

  const expectedMid = expected.slice(shared, expected.length - tail);
  const actualMid = actual.slice(shared, actual.length - tail);

  return {
    clause,
    head,
    expected,
    actual,
    prefix: expected.slice(0, shared),
    expectedMid,
    actualMid,
    suffix: expected.slice(expected.length - tail),
    deltaChars: Math.max(expectedMid.length, actualMid.length),
  };
}

/* --- The plates ----------------------------------------------------------- */

/**
 * The expression column: the clause's own head on one plate, the identical box
 * with its ink taken out on the other.
 *
 * One component in all three places (both plates and the delta bar) because
 * they must agree to the pixel. The padding, the margin and the border all sit
 * on the *outer* span so they survive the inner span being hidden - a
 * `visibility: hidden` on the bordered element would take the rule with it, and
 * a differently structured spacer would be a second thing to keep in sync with
 * the first.
 */
const HeadColumn: React.FC<{ text: string; shown: boolean; ruleColor: string }> = ({
  text,
  shown,
  ruleColor,
}) => (
  <span
    style={{
      display: 'inline-block',
      paddingRight: HEAD_GUTTER,
      marginRight: HEAD_GUTTER,
      borderRight: `1px solid ${ruleColor}`,
    }}
  >
    <span style={{ visibility: shown ? 'visible' : 'hidden', color: STAGE.inkDim }}>{text}</span>
  </span>
);

/**
 * One half of the card. Rounded on its outer corners only, so at gap 0 the two
 * read as the single card the product draws, divided by one hairline.
 */
const Plate: React.FC<{ half: 'top' | 'bottom'; label: string; children: React.ReactNode }> = ({
  half,
  label,
  children,
}) => (
  <div
    style={{
      boxSizing: 'border-box',
      width: CARD_W,
      height: PLATE_H,
      padding: `0 ${PAD}px`,
      display: 'flex',
      alignItems: 'center',
      background: STAGE.plate,
      border: `1px solid ${STAGE.rule}`,
      borderRadius: half === 'top' ? '16px 16px 0 0' : '0 0 16px 16px',
      borderBottomWidth: half === 'top' ? 0 : 1,
    }}
  >
    <div
      style={{
        flex: `0 0 ${LABEL_COL}px`,
        fontSize: TYPE.unit,
        // The same line box as the mono beside it, so both centre on the
        // plate's middle rather than on their own differing line heights.
        lineHeight: `${MONO_LINE}px`,
        letterSpacing: 2.2,
        textTransform: 'uppercase',
        color: STAGE.inkDim,
      }}
    >
      {label}
    </div>
    <div style={{ ...MONO, color: STAGE.ink }}>{children}</div>
  </div>
);

/**
 * The character the clause requires and the value is missing, marked on the
 * clause. Boxed in accent: this one is present, and it is what the eye is being
 * sent to the plate below to look for.
 */
const Pivot: React.FC<{ text: string }> = ({ text }) => (
  <span style={{ position: 'relative', display: 'inline-block', color: STAGE.accent }}>
    {text}
    <span
      style={{
        position: 'absolute',
        left: -6,
        right: -6,
        top: 2,
        bottom: 2,
        background: wash(STAGE.accent, 0.18),
        border: `2px solid ${STAGE.accent}`,
        borderRadius: 6,
      }}
    />
  </span>
);

/**
 * The hole. An empty dashed slot exactly as wide as the character that should
 * be here, reserved by a hidden copy of that character so the suffix after it
 * still lines up with the suffix on the plate above.
 *
 * When the value has something else here rather than nothing (a substitution
 * rather than a deletion), that something is printed in alert inside the slot.
 * Either way the printed characters are the captured ones and nothing else.
 */
const Slot: React.FC<{ reserve: string; instead: string }> = ({ reserve, instead }) => (
  <span style={{ position: 'relative', display: 'inline-block' }}>
    <span style={{ visibility: 'hidden' }}>{reserve}</span>
    {instead !== '' && (
      <span style={{ position: 'absolute', inset: 0, color: STAGE.alert }}>{instead}</span>
    )}
    <span
      style={{
        position: 'absolute',
        left: -6,
        right: -6,
        top: 2,
        bottom: 2,
        background: wash(STAGE.alert, 0.16),
        border: `2px dashed ${STAGE.alert}`,
        borderRadius: 6,
      }}
    />
  </span>
);

/**
 * A raised-plane band carrying one line of the sentence.
 *
 * `edge` is the direction the band *travels*, so a band above the card docks
 * `down` and a band below it docks `up`: both start behind the plates, which
 * are painted over them, and slide out into the open. Reversed, they arrive
 * from off-stage instead, which is a different sentence about where the words
 * came from.
 */
const Band: React.FC<{ from: number; top: number; edge: 'up' | 'down'; text: string }> = ({
  from,
  top,
  edge,
  text,
}) => (
  <Recede from={BAND_OUT} style={{ position: 'absolute', left: PAD, top, width: CARD_W - PAD * 2 }}>
    <Dock from={from} edge={edge} distance={110} rule={false}>
      <div
        style={{
          boxSizing: 'border-box',
          height: BAND_H,
          padding: `0 30px`,
          display: 'flex',
          alignItems: 'center',
          background: STAGE.plate,
          borderLeft: `3px solid ${STAGE.accent}`,
          borderRadius: 4,
          fontSize: TYPE.body,
          color: STAGE.ink,
        }}
      >
        {text}
      </div>
    </Dock>
  </Recede>
);

/* --- The piece ------------------------------------------------------------ */

/**
 * B1. The cause card docks in whole, lifts, parts into the clause and the value
 * it failed against, holds the comparison long enough to read one character,
 * then rejoins and recedes.
 *
 * `plot` is deliberately unused - see the module doc's "Where it is drawn".
 */
export const ExplodedPlates: React.FC<PieceProps> = ({ manifest }) => {
  const cause = readCause(manifest);
  const unit = cause.deltaChars === 1 ? 'char' : 'chars';

  return (
    <AbsoluteFill>
      {/* The dim the lift reads against. A sibling near the root, never inside
          `Lift` - see `verbs/Lift.tsx` for why a nested dim lights the wrong
          half of the frame. */}
      <LiftPlate from={LIFT_AT} out={RECEDE_AT} />

      <div
        style={{
          position: 'absolute',
          left: (FRAME.width - CARD_W) / 2,
          top: (CHROME_BOTTOM + FRAME.height) / 2 - GROUP_H / 2,
          width: CARD_W,
          height: GROUP_H,
          transform: `scale(${SCALE})`,
          transformOrigin: 'center center',
        }}
      >
        <Band from={BAND_AT} top={0} edge="down" text="Unbound reveals the root cause." />

        <Recede
          from={RECEDE_AT}
          style={{ position: 'absolute', left: 0, top: CARD_Y, width: CARD_W, zIndex: 1 }}
        >
          {/* No hairline: dock's accent rule sits 22px under the object, which
              is inside the space the bottom plate travels into. */}
          <Dock from={DOCK_AT} rule={false}>
            <Lift from={LIFT_AT}>
              <Split
                from={SPLIT_AT}
                axis="y"
                gap={GAP}
                tilt={TILT}
                close={CLOSE_AT}
                closeOver={CLOSE_OVER}
                style={{ width: CARD_W }}
                left={
                  <Plate half="top" label="The mapping rule requires">
                    <HeadColumn text={cause.head} shown ruleColor={STAGE.rule} />
                    {'"'}
                    {cause.prefix}
                    <Pivot text={cause.expectedMid} />
                    {cause.suffix}
                    {'"'}
                  </Plate>
                }
                right={
                  <Plate half="bottom" label="The user profile says">
                    <HeadColumn text={cause.head} shown={false} ruleColor={STAGE.rule} />
                    <span
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        background: wash(STAGE.alert, 0.1),
                        borderRadius: 6,
                      }}
                    >
                      {'"'}
                      {cause.prefix}
                      <Slot reserve={cause.expectedMid} instead={cause.actualMid} />
                      {cause.suffix}
                      {'"'}
                    </span>
                  </Plate>
                }
                delta={
                  <div
                    style={{
                      boxSizing: 'border-box',
                      width: CARD_W,
                      height: BAR_H,
                      padding: `0 ${PAD}px`,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {/* The plates' own left columns, with nothing drawn in
                        them: the bar lands under the divergence because it is
                        preceded by exactly what precedes the divergence. The
                        rule is transparent rather than absent so its 1px still
                        counts toward the width. */}
                    <div style={{ flex: `0 0 ${LABEL_COL}px` }} />
                    <span style={{ ...MONO }}>
                      <HeadColumn text={cause.head} shown={false} ruleColor="transparent" />
                      <span style={{ visibility: 'hidden' }}>{`"${cause.prefix}`}</span>
                    </span>
                    <span
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        alignSelf: 'stretch',
                      }}
                    >
                      <span style={{ ...MONO, visibility: 'hidden' }}>{cause.expectedMid}</span>
                      <span
                        style={{
                          position: 'absolute',
                          left: '50%',
                          marginLeft: -2,
                          top: 0,
                          bottom: 0,
                          width: 4,
                          background: STAGE.alert,
                        }}
                      />
                    </span>
                    <span
                      style={{
                        marginLeft: 22,
                        fontSize: TYPE.label,
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        color: STAGE.alert,
                      }}
                    >
                      {`${cause.deltaChars} ${unit}`}
                    </span>
                  </div>
                }
              />
            </Lift>
          </Dock>
        </Recede>

        <Band
          from={BAND_AT + BAND_STEP}
          top={GROUP_H - BAND_H}
          edge="up"
          text="An attribute typo broke the automated provisioning."
        />
      </div>
    </AbsoluteFill>
  );
};
