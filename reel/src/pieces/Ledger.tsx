/**
 * @module reel/pieces/Ledger
 * @description Set piece B2: the blast radius as a receipt.
 *
 * `SCRIPT.md`, "SET PIECE B2 - The ledger", after the Users chapter's `predict`
 * beat: "The prediction as a receipt rather than a fan: cause on the left (the
 * draft edit, and a `Reversible - yes, until Apply` panel), consequence on the
 * right (a `WOULD ADD` row per predicted group, each naming the rule that
 * carries it), then the totals. **The zero does not roll, it simply sets.**"
 *
 * A fan would have said "look how much this touches". A receipt says something
 * narrower and truer: here is the cause, here is every line item it produces,
 * here is what was counted, and here is what the count does not cover. The
 * whole piece is one plate that arrives, prints, and recedes.
 *
 * ## The zero is the point, and it is read, not written
 *
 * `removed` is `0`, and that zero is the loudest figure on the plate: nothing
 * loses a member, the change is additive. The product never prints it - the
 * report's "Likely removed" section simply renders empty and is dropped - so
 * the rig asserts the section's absence and records `removed: 0`, and this
 * piece prints what was recorded. It is `figureNumber(manifest, 'removed')`
 * and never the literal `0`, so a take where a removal did appear prints the
 * removal instead of a comfortable lie. `<Count roll={false}>` is the rest of
 * that sentence: a zero that rolled up through nine other digits would be
 * theatre about a number that never moved.
 *
 * ## The caveat is load-bearing
 *
 * The line at the foot of the plate is not "predictions are likely, not
 * certain". It is the specific truth `SCRIPT.md` settled on: **"Group rules
 * only. Pushed groups are not modelled."** The prediction names two groups and
 * the chapter's next beat goes from four groups to seven. The third arrives by
 * app group push, which `analyzeBlastRadius` structurally cannot see - it only
 * ever inventories the org's group rules, so a pushed group cannot appear in
 * any of its buckets, not even as "not predicted". Without that line the plate
 * claims more certainty than the product does, in the same chapter that shows
 * the gap. It is dimmer than the totals but it is not a footnote, and it docks
 * last so it is the thing on screen longest before the cut.
 *
 * ## Where `draw` is allowed, and where it is not
 *
 * This is the first set piece to use the seventh verb (`reel/pencil`), which is
 * governed: **`draw` only ever applies to something the product has not made
 * yet.** The two `WOULD ADD` rows are exactly that - a membership that does not
 * exist, a claim awaiting the Apply that would make it real - so each row's
 * frame is a `SketchBox` extruded on by `draw()`, and the captured group name
 * docks into the frame after it closes. Nothing else here is drawn: the cause
 * plate is a measured string, the totals are measured figures, and a graphite
 * outline round either of those would be the film lying about where the frame's
 * information came from.
 *
 * ## Figures, and the one thing `SCRIPT.md` asks for that was not shot
 *
 * Every string and number is from the `users-fix` manifest: `typo`
 * (`Enginering`), `added` (the two predicted group names), `groups`, `rules`
 * and `removed` (the report's two pill counts and the asserted-empty removal
 * section). `readLedger` refuses a manifest whose `groups` pill disagrees with
 * the number of names in `added`, because two rows under a plate reading "3
 * groups" is a rendered claim nobody measured.
 *
 * **The rule that carries each row is not printed, and cannot be.** `SCRIPT.md`
 * asks each `WOULD ADD` row to name its rule; no capture read those names, only
 * the report's `rules` *count*. Printing a rule name would break the synthetic
 * layer's first rule inside the piece whose entire argument is that what you are
 * reading was measured, so the rule count stands once in the totals and the rows
 * carry only the group each predicts. Flagged in the handback rather than faked.
 *
 * Never wrap any of this in Remotion's `<Sequence>` - every verb here is
 * authored in absolute frames and `<Sequence>` remaps `useCurrentFrame()` to 0
 * inside it, silently freezing the piece at its first pose. See
 * `verbs/useVerb.ts`.
 */
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { capture, figure, figureNumber } from '../captures';
import type { Manifest } from '../captures';
import { FONT, FRAME, FRAMES, INTER, STAGE, TYPE } from '../theme';
import { Count, Dock, Recede } from '../verbs';
import { GRAPHITE, SketchBox, draw } from '../pencil';
import { STAGES } from '../layout';
import type { PieceProps } from './index';

/**
 * How long B2 runs, as a literal.
 *
 * 240 frames is 4.0s at 60fps, the budget `SCRIPT.md` gives the piece. **Stated
 * as a constant and never computed** - `Reel.tsx` resolves every act's length at
 * module scope, so a length derived from a manifest read or a figure lookup
 * (both of which throw by design) would take the whole bundle down rather than
 * the one composition that wanted it. See `pieces/index.ts`.
 */
export const LEDGER_FRAMES = 240;

/* --- The beat sheet, in absolute frames ------------------------------------ */

/**
 * Everything docks from the right.
 *
 * `Dock`'s default edge is `left`, because leftward is where the film's real
 * panel lives. A receipt prints the other way: each line arrives from the edge
 * the paper is fed out of, which is the piece choosing its own geometry over
 * the panel's - the explicit, visible choice `verbs/Dock.tsx` asks a caller to
 * make rather than inherit.
 */
const CAUSE_AT = 0;
/** Each row's frame is sketched, then its captured name docks into it 10f later. */
const ROW_DRAW_AT = [24, 38] as const;
const ROW_DOCK_STEP = 10;
/** The totals plate. */
const TOTALS_AT = 74;
/** The three counts, 8f apart. `removed` sets rather than rolls, so its offset is only spacing. */
const COUNT_AT = 88;
const COUNT_STEP = 8;
/** The caveat, last in and longest on screen. */
const CAVEAT_AT = 128;
/**
 * The whole sheet recedes, landing its last frame on the piece's last frame.
 *
 * The `- 1` is not a fudge. A piece of `n` frames renders `0..n-1`, so a recede
 * starting at `n - FRAMES.recede` finishes on frame `n`, which is never
 * rendered: measured at frame 239 of 240, the sheet was still on screen at
 * about a sixth opacity, which is a ghost smeared into the first frame of the
 * footage the piece cuts back to. Starting a frame earlier puts the verb's
 * final, fully faded pose on the last frame that exists.
 */
const RECEDE_AT = LEDGER_FRAMES - FRAMES.recede - 1;

/* --- Geometry -------------------------------------------------------------- */

/**
 * The top of the frame the chapter's own chrome owns: the nav strip, the
 * chapter title under it, and the index band opposite. The receipt is centred
 * in what is left rather than in the frame, so it cannot creep up into a band
 * it would have to be read across. B1 uses the same number for the same reason.
 */
const CHROME_BOTTOM = 200;

/**
 * The receipt's width.
 *
 * B1's lesson, stated in its own module doc: for a set piece the panel has left
 * the stage, so an object still pinned to the right of a column that is not
 * there reads as a slide with a hole in it. This is centred in the whole frame
 * and takes the width it earns - two columns of argument, cause against
 * consequence, which is the shape the piece is making.
 */
const SHEET_W = 1600;
/** The cause column, the gutter, and the consequence column. Sums to `SHEET_W`. */
const CAUSE_W = 600;
const GUTTER = 56;
const ROWS_W = SHEET_W - CAUSE_W - GUTTER;

/** One `WOULD ADD` row, and the air between two of them. */
const ROW_H = 118;
const ROW_GAP = 26;
/** The columns block: two rows deep, which is also the cause plate's height. */
const COLS_H = ROW_H * 2 + ROW_GAP;

/** The totals plate, under both columns. */
const TOTALS_TOP = COLS_H + 56;
const TOTALS_H = 172;
/** The caveat strip, under the totals plate's own dock hairline. */
const CAVEAT_TOP = TOTALS_TOP + TOTALS_H + 34;
const CAVEAT_H = 64;

/** The whole sheet: columns, totals, caveat. */
const SHEET_H = CAVEAT_TOP + CAVEAT_H;

/** Padding inside a solid plate. The product's `p-(--sp-card)`, at the scale this is staged at. */
const PAD = 40;
/** The counts' own size. Smaller than `TYPE.figure`, because three of them share a line. */
const COUNT_SIZE = 76;

/** The uppercase micro-label every plate is titled with. One object, so three plates cannot drift. */
const LABEL: React.CSSProperties = {
  fontSize: TYPE.unit,
  letterSpacing: 2.2,
  textTransform: 'uppercase',
  color: STAGE.inkDim,
};

/**
 * A token color at an alpha, without writing a second hex.
 *
 * The struck value needs `STAGE.alert` translucent behind it. Parsing the token
 * beats typing an `rgba()` literal that would silently stop matching the token
 * it was eyeballed from. Same helper, same reason, as B1's.
 */
function wash(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* --- The figures ----------------------------------------------------------- */

/** What the rig read off the blast-radius report, once it has been proved printable. */
interface LedgerFigures {
  /** The value the draft edit strikes out: `Enginering`. */
  typo: string;
  /** Every group the report predicts, in the order it listed them. One row each. */
  added: string[];
  /** The report's `Groups N` pill. */
  groups: number;
  /** The report's `Rules N` pill. */
  rules: number;
  /** The removals, from the rig's assertion that the removal section is absent. */
  removed: number;
}

/**
 * Read the five figures this plate prints, or throw naming what is wrong.
 *
 * `figureNumber` already refuses a non-number, so the three counts need nothing
 * more. `added` does: `figure()`'s type parameter is an unchecked cast, so an
 * array that came back empty, or holding something that is not a string, would
 * render as a receipt with no line items or with `[object Object]` in one - a
 * shape nobody measured either way. The last check is the sharpest: if the
 * report's `Groups` pill and the list of names it printed ever disagree, the
 * plate would count one thing and itemise another, so the render fails instead.
 */
function readLedger(manifest: Manifest): LedgerFigures {
  const typo = figure<unknown>(manifest, 'typo');
  if (typeof typo !== 'string' || typo === '') {
    throw new Error(
      `${manifest.id}: figure "typo" is not a non-empty string - got ${JSON.stringify(typo)}.`,
    );
  }

  const added = figure<unknown>(manifest, 'added');
  if (!Array.isArray(added) || added.length === 0) {
    throw new Error(
      `${manifest.id}: figure "added" is not a non-empty array of group names - got ${JSON.stringify(added)}.`,
    );
  }
  const names = added.map((name) => {
    if (typeof name !== 'string' || name === '') {
      throw new Error(
        `${manifest.id}: figure "added" holds something that is not a group name - got ${JSON.stringify(name)}.`,
      );
    }
    return name;
  });

  const groups = figureNumber(manifest, 'groups');
  const rules = figureNumber(manifest, 'rules');
  const removed = figureNumber(manifest, 'removed');

  if (groups !== names.length) {
    throw new Error(
      `${manifest.id}: the report's "Groups" pill read ${groups} but figure "added" names ` +
        `${names.length} (${names.join(', ')}). The ledger would count one thing and itemise ` +
        `another. Re-run \`npm run capture -- ${manifest.id}\`.`,
    );
  }

  return { typo, added: names, groups, rules, removed };
}

/* --- The parts ------------------------------------------------------------- */

/**
 * The cause: the value the draft strikes out, and what that draft still is.
 *
 * One plate rather than two, and one dock rather than two, because the panel's
 * own "Reversible" line is not a second object - it is the same fact continued.
 * The strike is drawn as a rule rather than set as `text-decoration` so it can
 * be the alert token at a weight that reads at this size; the string under it
 * is character-for-character the one the rig read.
 */
const Cause: React.FC<{ typo: string }> = ({ typo }) => (
  <div
    style={{
      boxSizing: 'border-box',
      width: CAUSE_W,
      height: COLS_H,
      padding: PAD,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      background: STAGE.plate,
      border: `1px solid ${STAGE.rule}`,
      borderRadius: 16,
    }}
  >
    <div style={LABEL}>The draft edit</div>
    <div
      style={{
        position: 'relative',
        alignSelf: 'flex-start',
        padding: '2px 10px',
        borderRadius: 6,
        background: wash(STAGE.alert, 0.12),
        fontFamily: FONT.mono,
        fontSize: TYPE.claim,
        color: STAGE.ink,
        whiteSpace: 'pre',
      }}
    >
      {`"${typo}"`}
      <span
        style={{
          position: 'absolute',
          left: 10,
          right: 10,
          top: '52%',
          height: 4,
          background: STAGE.alert,
        }}
      />
    </div>
    <div style={{ fontSize: TYPE.body, color: STAGE.inkDim }}>Reversible - yes, until Apply</div>
  </div>
);

/**
 * One predicted line item: a sketched frame with a captured name docked into it.
 *
 * The frame is `draw` and the name is not, and that split is the governance
 * (`pencil/draw.ts`): the membership this row describes does not exist yet, so
 * its container is graphite; the group's name was read off the report on
 * camera, so it is set in ink like every other measured string in the film. The
 * `WOULD ADD` marker is the verb the report itself is making, in the affirm
 * token, because an addition is what this row predicts and nothing here is
 * lost.
 */
const WouldAdd: React.FC<{ drawAt: number; top: number; name: string }> = ({
  drawAt,
  top,
  name,
}) => {
  const frame = useCurrentFrame();
  const p = draw(frame, drawAt);

  return (
    <div style={{ position: 'absolute', left: 0, top, width: ROWS_W, height: ROW_H }}>
      <svg
        width={ROWS_W}
        height={ROW_H}
        viewBox={`0 0 ${ROWS_W} ${ROW_H}`}
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
      >
        <SketchBox
          x={8}
          y={8}
          width={ROWS_W - 16}
          height={ROW_H - 16}
          p={p}
          seed={drawAt}
          color={GRAPHITE.primary}
          amplitude={3.2}
        />
      </svg>
      <Dock
        from={drawAt + ROW_DOCK_STEP}
        edge="right"
        distance={120}
        rule={false}
        style={{ position: 'absolute', left: PAD, top: 0, right: PAD, height: ROW_H }}
      >
        <div style={{ height: ROW_H, display: 'flex', alignItems: 'center', gap: 28 }}>
          <span style={{ ...LABEL, color: STAGE.affirm, flex: '0 0 auto' }}>Would add</span>
          <span style={{ fontSize: TYPE.claim, color: STAGE.ink }}>{name}</span>
        </div>
      </Dock>
    </div>
  );
};

/**
 * One figure in the totals row: the count over its own unit.
 *
 * The unit sits under the digits rather than in `Count`'s own inline `unit`
 * slot, which sets it at `TYPE.unit` beside a 76px numeral - legible on a plate
 * with one figure on it, lost on a plate with three. `roll` is the caller's,
 * because exactly one of the three does not roll.
 */
const Total: React.FC<{
  from: number;
  value: number;
  unit: string;
  color: string;
  roll: boolean;
}> = ({ from, value, unit, color, roll }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Count from={from} value={value} size={COUNT_SIZE} color={color} roll={roll} />
    <span style={LABEL}>{unit}</span>
  </div>
);

/* --- The piece ------------------------------------------------------------- */

/**
 * B2. The cause docks in, two counterfactual rows are sketched and filled, the
 * totals print with the zero setting rather than rolling, and the caveat lands
 * last. Then the whole sheet recedes as one plate.
 *
 * `plot` is deliberately unused - see the module doc, and B1's "Where it is
 * drawn": the panel has left the stage, so this is centred in the frame.
 */
export const Ledger: React.FC<PieceProps> = ({ manifest }) => {
  const { typo, added, groups, rules, removed } = readLedger(manifest);

  return (
    <AbsoluteFill style={{ fontFamily: INTER }}>
      <Recede
        from={RECEDE_AT}
        // The sheet is three plates with air between them, not one solid
        // plane, so it casts no single shadow: `Recede`'s default recipe
        // painted a soft black rectangle across the whole group, which in a
        // still at frame 20 reads as a fourth, empty plate sitting behind a
        // piece that has only printed its first line. Zeroed, the verb keeps
        // what this object actually has - the settle and the closing fade -
        // and the collapse-to-a-hairline is left to the plates, which carry
        // their own `STAGE.rule` borders already.
        fromShadow={{ y: 0, blur: 0, spread: 0, alpha: 0 }}
        style={{
          position: 'absolute',
          left: (FRAME.width - SHEET_W) / 2,
          top: (CHROME_BOTTOM + FRAME.height) / 2 - SHEET_H / 2,
          width: SHEET_W,
          height: SHEET_H,
        }}
      >
        <Dock
          from={CAUSE_AT}
          edge="right"
          distance={160}
          rule={false}
          style={{ position: 'absolute', left: 0, top: 0, width: CAUSE_W }}
        >
          <Cause typo={typo} />
        </Dock>

        <div
          style={{
            position: 'absolute',
            left: CAUSE_W + GUTTER,
            top: 0,
            width: ROWS_W,
            height: COLS_H,
          }}
        >
          {added.map((name, i) => (
            <WouldAdd
              key={name}
              // Two rows are what this org's report predicted; a third would
              // simply keep the last row's cadence rather than have no beat.
              drawAt={ROW_DRAW_AT[Math.min(i, ROW_DRAW_AT.length - 1)]}
              top={i * (ROW_H + ROW_GAP)}
              name={name}
            />
          ))}
        </div>

        {/* The one accent hairline on the sheet, under the plate that carries
            the counts: dock's own rule, which is where a receipt draws one. */}
        <Dock
          from={TOTALS_AT}
          edge="right"
          distance={160}
          style={{ position: 'absolute', left: 0, top: TOTALS_TOP, width: SHEET_W }}
        >
          <div
            style={{
              boxSizing: 'border-box',
              width: SHEET_W,
              height: TOTALS_H,
              padding: `0 ${PAD}px`,
              display: 'flex',
              alignItems: 'center',
              gap: 120,
              background: STAGE.plate,
              border: `1px solid ${STAGE.rule}`,
              borderRadius: 16,
            }}
          >
            <Total from={COUNT_AT} value={groups} unit="Groups" color={STAGE.ink} roll />
            <Total from={COUNT_AT + COUNT_STEP} value={rules} unit="Rules" color={STAGE.ink} roll />
            {/* "The zero does not roll, it simply sets." */}
            <Total
              from={COUNT_AT + COUNT_STEP * 2}
              value={removed}
              unit="Removals"
              color={STAGE.affirm}
              roll={false}
            />
            <div
              style={{
                marginLeft: 'auto',
                textAlign: 'right',
                fontSize: TYPE.body,
                color: STAGE.ink,
              }}
            >
              No group loses a member. Additive only.
            </div>
          </div>
        </Dock>

        <Dock
          from={CAVEAT_AT}
          edge="right"
          distance={120}
          rule={false}
          style={{ position: 'absolute', left: 0, top: CAVEAT_TOP, width: SHEET_W }}
        >
          <div
            style={{
              boxSizing: 'border-box',
              height: CAVEAT_H,
              paddingLeft: PAD - 3,
              display: 'flex',
              alignItems: 'center',
              borderLeft: `3px solid ${STAGE.alert}`,
              fontSize: TYPE.body,
              color: STAGE.inkDim,
            }}
          >
            Group rules only. Pushed groups are not modelled.
          </div>
        </Dock>
      </Recede>
    </AbsoluteFill>
  );
};

/**
 * Props-free wrapper so this can be a registered composition.
 *
 * The backdrop is drawn here rather than in `Ledger` itself: in the film the
 * chapter's own `Backdrop` is already behind the piece, and an opaque fill
 * inside the piece would paint over it. Standalone, there is nothing behind it
 * at all, and a receipt rendered on transparency is not what this looks like in
 * the cut.
 */
export const LedgerPreview: React.FC = () => (
  <AbsoluteFill style={{ background: STAGE.back }}>
    <Ledger
      id="placeholder"
      frames={LEDGER_FRAMES}
      plot={STAGES.focus.plot}
      manifest={capture('users-fix')}
    />
  </AbsoluteFill>
);
