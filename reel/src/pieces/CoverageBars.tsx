/**
 * @module reel/pieces/CoverageBars
 * @description The set piece for the Reporting chapter: the factor-coverage
 * breakdown as a ranked field of bars, with the row nobody wants called out.
 *
 * The `factor-ladder` diagram already draws this breakdown beside the panel, in
 * the order the panel listed it. This piece is the other thing you can do with
 * the same figures once the panel is gone and the whole plot is free: **rank
 * them**. Sorted by count, the nine rows stop being a list of enrollment
 * options and become a distribution, and the argument the chapter is making
 * becomes a shape rather than a sentence. `No factors enrolled` is not the
 * longest bar. It is the one that should not exist at all, and it is drawn last
 * and in the alert token so the eye lands on it after it has already read the
 * ranking and formed an expectation.
 *
 * Two things are deliberately *not* done here:
 *
 * - **The bars are not stacked, and the percentages are not summed.** Okta's
 *   coverage rows overlap by construction - a user with Okta Verify Push and
 *   SMS is counted on both rows and again on `Multiple factors (2+)` - so the
 *   nine percentages add to far more than a hundred and any composition that
 *   read as parts of a whole would be a rendered lie about what the report
 *   means. Every bar is measured against the largest row, and the label under
 *   the field says so.
 * - **The callout does no arithmetic.** It prints the unenrolled count and the
 *   roster size, both read off the panel, and the word `of` between them. A
 *   "that is one in six" line would be the film computing a figure rather than
 *   reporting one, which is the honesty rule's whole point (ADR-0045).
 *
 * Never wrap any of this in Remotion's `<Sequence>`. Every verb here is
 * authored in absolute frames and `<Sequence>` remaps `useCurrentFrame()` to 0
 * inside it, so the piece would silently hold its first pose for its entire
 * slot. See `verbs/useVerb.ts`.
 */
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { figure, type Manifest } from '../captures';
import type { Counts, CoverageRow } from '../figures';
import { EASING, FONT, FRAME, FRAMES, INTER, STAGE, TYPE } from '../theme';
import { Count, Dock, Recede } from '../verbs';
import type { PieceProps } from './index';

/**
 * How long the piece runs, as a literal.
 *
 * 240 frames is 4.0s at 60fps, the budget this piece was briefed at and the
 * same one `ledger` carries. **Stated as a constant and never computed** -
 * `Reel.tsx` resolves every act's length at module scope, so a length that came
 * from a manifest read or a figure lookup (both of which throw by design) would
 * take the whole bundle down rather than the one composition that wanted it.
 * See `pieces/index.ts`.
 */
export const COVERAGE_BARS_FRAMES = 240;

/* --- The figures ----------------------------------------------------------- */

/** The row this piece is built to call out. The chapter's whole finding. */
const FINDING = 'No factors enrolled';

/**
 * The most rows the field can hold.
 *
 * Nine rows at `ROW_H + ROW_GAP` fill the field exactly; a tenth pushes the
 * bottom row past the frame. Enforced rather than absorbed by shrinking the
 * type, because a breakdown with more rungs than this is a different picture
 * from the one the piece was designed for and the handback should say so.
 */
const MAX_ROWS = 9;

/** What the piece prints, once it has been proved printable. */
interface CoverageFigures {
  /** Every rung of the breakdown, ranked by count, the finding row last. */
  ranked: CoverageRow[];
  /** The finding row itself, pulled out for the callout. */
  finding: CoverageRow;
  /** The largest count in the breakdown. Every bar is measured against it. */
  most: number;
  /** The roster the breakdown was taken over. */
  roster: number;
}

/**
 * Read and rank what the walk read off the coverage report, or throw saying why
 * it cannot be drawn.
 *
 * `figure()`'s type parameter is an unchecked cast, so every field is checked
 * here: a row whose `count` came back as a string would render a bar of `NaN`
 * width and a number nobody measured, and the refusal has to happen before any
 * of that reaches a frame. The last two checks are the sharpest. If the
 * breakdown no longer contains a row called `No factors enrolled`, this piece
 * has no finding to call out and would play as a ranked chart with an empty
 * accent slot, so it fails instead of quietly becoming a different piece; and
 * if every count is zero there is no `most` to measure against, which would
 * divide the whole field by nothing.
 */
function readCoverage(manifest: Manifest): CoverageFigures {
  const rows = figure<unknown>(manifest, 'coverage');
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      `${manifest.id}: figure "coverage" is not a non-empty array of rows - got ${JSON.stringify(rows)}.`,
    );
  }

  const checked = rows.map((row): CoverageRow => {
    const { label, count, pct } = (row ?? {}) as Partial<CoverageRow>;
    if (
      typeof label !== 'string' ||
      label === '' ||
      typeof count !== 'number' ||
      !Number.isFinite(count) ||
      typeof pct !== 'number' ||
      !Number.isFinite(pct)
    ) {
      throw new Error(
        `${manifest.id}: figure "coverage" holds something that is not a {label, count, pct} row - ` +
          `got ${JSON.stringify(row)}.`,
      );
    }
    return { label, count, pct };
  });

  if (checked.length > MAX_ROWS) {
    throw new Error(
      `${manifest.id}: the coverage report has ${checked.length} rows and the field holds ` +
        `${MAX_ROWS}. A tenth bar runs off the bottom of the frame. Re-cut the piece, or give ` +
        'the act a different set piece.',
    );
  }

  const finding = checked.find((row) => row.label === FINDING);
  if (!finding) {
    throw new Error(
      `${manifest.id}: the coverage report has no "${FINDING}" row, which is the finding this ` +
        `piece exists to call out. It read: ${checked.map((r) => r.label).join(', ')}.`,
    );
  }

  const most = Math.max(...checked.map((row) => row.count));
  if (most <= 0) {
    throw new Error(
      `${manifest.id}: every coverage row counted zero users, so there is no longest bar to ` +
        'measure the field against. Re-run `npm run capture -- reporting`.',
    );
  }

  // Ranked by count, and the finding dealt last whatever it ranks - it lands on
  // its own beat, after the eye has read the distribution it breaks.
  const ranked = [
    ...checked.filter((row) => row.label !== FINDING).sort((a, b) => b.count - a.count),
    finding,
  ];

  return { ranked, finding, most, roster: figure<Counts>(manifest, 'rosterBefore').total };
}

/* --- The beat sheet, in absolute frames ------------------------------------ */

/** The title, first, so the field has something to arrive under. */
const TITLE_AT = 0;
/** The first bar, and the cadence the rest follow it in. */
const BARS_AT = 16;
const BAR_STEP = 11;
/** How long one bar takes to reach its length once it starts. */
const BAR_GROW = 26;
/** After the last bar has finished growing, the callout lands under the field. */
const CALLOUT_GAP = 14;
/** The count inside the callout, once the callout plate itself has docked. */
const COUNT_GAP = 10;

/** When each part of the piece arrives, for a breakdown of `rows` rungs. */
function beats(rows: number) {
  const lastBar = BARS_AT + BAR_STEP * (rows - 1) + BAR_GROW;
  const calloutAt = lastBar + CALLOUT_GAP;
  return { calloutAt, countAt: calloutAt + COUNT_GAP };
}

/**
 * The whole field recedes, landing its last frame on the piece's last frame.
 *
 * The `- 1` is the same one `Ledger` explains: a piece of `n` frames renders
 * `0..n-1`, so a recede starting at `n - FRAMES.recede` finishes on frame `n`,
 * which is never rendered, and the last frame that does exist still carries a
 * sixth of the field smeared into the footage the piece cuts back to.
 */
const RECEDE_AT = COVERAGE_BARS_FRAMES - FRAMES.recede - 1;

/* --- Geometry -------------------------------------------------------------- */

/**
 * The top of the frame the chapter's own chrome owns: the nav strip, the
 * chapter title under it, and the index band opposite. The field is centred in
 * what is left rather than in the frame, so it cannot creep up into a band it
 * would have to be read across. B1 and B2 use the same number for the same
 * reason.
 */
const CHROME_BOTTOM = 200;

/** The field's width, centred in the frame. The panel is gone; nothing is pinned. */
const FIELD_W = 1560;
/** The label column, the bar track, and the figures column. Sums to `FIELD_W`. */
const LABEL_W = 470;
const FIGURES_W = 210;
const TRACK_GAP = 36;
const TRACK_W = FIELD_W - LABEL_W - FIGURES_W - TRACK_GAP * 2;

/**
 * One rung, and the air between two of them.
 *
 * Nine rungs, a title band and a callout have to clear `CHROME_BOTTOM` at the
 * top and the frame at the bottom, and at 58px they did not: the callout hung
 * 31px off the bottom edge. The field is the part that gives, because the title
 * and the callout are read and the rungs are scanned.
 */
const ROW_H = 48;
const ROW_GAP = 10;
/** The bar itself sits inside the rung, with its track behind it. */
const BAR_H = 22;

/** The title band above the field, and the callout strip under it. */
const TITLE_H = 118;
const TITLE_GAP = 28;
const CALLOUT_GAP_Y = 46;
const CALLOUT_H = 132;

/** The field's vertical layout, for a breakdown of `rows` rungs. */
function geometry(rows: number) {
  const fieldTop = TITLE_H + TITLE_GAP;
  const fieldH = ROW_H * rows + ROW_GAP * (rows - 1);
  const calloutTop = fieldTop + fieldH + CALLOUT_GAP_Y;
  return { fieldTop, fieldH, calloutTop, sheetH: calloutTop + CALLOUT_H };
}

/** The uppercase micro-label the piece titles things with. One object, so nothing drifts. */
const LABEL: React.CSSProperties = {
  fontSize: TYPE.unit,
  letterSpacing: 2.2,
  textTransform: 'uppercase',
  color: STAGE.inkDim,
};

/**
 * A token color at an alpha, without writing a second hex.
 *
 * The bar track and the callout wash both need a token translucent. Parsing the
 * token beats typing an `rgba()` literal that would silently stop matching the
 * token it was eyeballed from. Same helper, same reason, as B1's and B2's.
 */
function wash(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* --- The parts ------------------------------------------------------------- */

/**
 * One rung: its label, its bar, its count and its share.
 *
 * The bar grows from the label edge rather than fading in, because the quantity
 * *is* the animation - a bar that appeared at full length would be a chart
 * drawn on a stage rather than a measurement being taken. The number beside it
 * counts up over the same window on the same curve, so the digits and the
 * length agree at every frame instead of arriving on two different clocks.
 *
 * The share is printed exactly as the panel reported it (`pct`), never
 * recomputed from `count` and the roster: the report rounds, and a piece that
 * rounded differently would print a percentage the product never showed.
 */
const Bar: React.FC<{
  row: CoverageRow;
  most: number;
  top: number;
  from: number;
  lit: boolean;
}> = ({ row, most, top, from, lit }) => {
  const frame = useCurrentFrame();
  const t = EASING.standard(
    interpolate(frame, [from, from + BAR_GROW], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const opacity = interpolate(frame, [from, from + FRAMES.dockOpacity], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const color = lit ? STAGE.alert : STAGE.accent;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top,
        width: FIELD_W,
        height: ROW_H,
        display: 'flex',
        alignItems: 'center',
        opacity,
      }}
    >
      <div
        style={{
          width: LABEL_W,
          fontSize: TYPE.body,
          fontWeight: lit ? 600 : 400,
          color: lit ? STAGE.ink : STAGE.inkDim,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {row.label}
      </div>

      <div
        style={{
          width: TRACK_W,
          height: BAR_H,
          marginLeft: TRACK_GAP,
          borderRadius: BAR_H / 2,
          background: wash(STAGE.ink, 0.07),
        }}
      >
        <div
          style={{
            width: (row.count / most) * TRACK_W * t,
            height: BAR_H,
            borderRadius: BAR_H / 2,
            background: color,
          }}
        />
      </div>

      <div
        style={{
          width: FIGURES_W,
          marginLeft: TRACK_GAP,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'flex-end',
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: -1,
            color: lit ? STAGE.alert : STAGE.ink,
          }}
        >
          {Math.round(row.count * t)}
        </span>
        {/* The share arrives only once its bar has finished growing. The count
            beside it is rolling up through numbers nobody measured, which is
            fine while it is visibly in motion - but a settled `29%` sitting
            next to a rolling `2` reads as two figures that disagree. */}
        <span
          style={{
            fontSize: TYPE.unit,
            color: STAGE.inkDim,
            opacity: interpolate(t, [0.7, 1], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {row.pct}%
        </span>
      </div>
    </div>
  );
};

/* --- The piece ------------------------------------------------------------- */

/**
 * The title lands, nine bars are dealt in rank order with the finding last, the
 * callout docks under the field and counts the users behind it. Then the whole
 * field recedes as one object.
 *
 * `plot` is deliberately unused, for the reason B1 and B2 state: on a set piece
 * the panel has left the stage, so an object still pinned to the plot of a
 * column that is not there reads as a slide with a hole in it. This is centred
 * in the frame under the chapter's chrome.
 */
export const CoverageBars: React.FC<PieceProps> = ({ manifest }) => {
  const { ranked, finding, most, roster } = readCoverage(manifest);
  // Both derived from the number of rungs the capture actually produced.
  // Nothing below this line knows a row count, which is what keeps the field
  // from being drawn for the nine rows this org happened to report.
  const { fieldTop, fieldH, calloutTop, sheetH } = geometry(ranked.length);
  const { calloutAt, countAt } = beats(ranked.length);

  return (
    <AbsoluteFill style={{ fontFamily: INTER }}>
      <Recede
        from={RECEDE_AT}
        // The field is a title, a set of bars and a callout with air between
        // them, not one solid plane, so it casts no single shadow: `Recede`'s
        // default recipe would paint a soft black rectangle behind the lot,
        // which in an early still reads as an empty plate sitting under a piece
        // that has only drawn its first bar. B2 zeroes it for the same reason.
        fromShadow={{ y: 0, blur: 0, spread: 0, alpha: 0 }}
        style={{
          position: 'absolute',
          left: (FRAME.width - FIELD_W) / 2,
          top: (CHROME_BOTTOM + FRAME.height) / 2 - sheetH / 2,
          width: FIELD_W,
          height: sheetH,
        }}
      >
        {/* `rule={false}`: `Dock` draws its hairline along the bottom of what
            it moves, and a two-line claim overflowed this band, so the rule was
            struck through the second line. The field's own bars are the ruled
            element here; the title does not need a second one. */}
        <Dock
          from={TITLE_AT}
          distance={120}
          rule={false}
          style={{ position: 'absolute', left: 0, top: 0, width: FIELD_W }}
        >
          <div
            style={{
              height: TITLE_H,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={LABEL}>Factor coverage</div>
            <div style={{ fontSize: TYPE.claim, color: STAGE.ink }}>Ranked by users enrolled</div>
            <div style={{ fontSize: TYPE.body, color: STAGE.inkDim }}>
              The rungs overlap: one person can be counted on several. Each bar is measured against
              the longest, never against the roster.
            </div>
          </div>
        </Dock>

        <div
          style={{
            position: 'absolute',
            left: 0,
            top: fieldTop,
            width: FIELD_W,
            height: fieldH,
          }}
        >
          {ranked.map((row, i) => (
            <Bar
              key={row.label}
              row={row}
              most={most}
              top={i * (ROW_H + ROW_GAP)}
              // The cadence, not a table. Every rung gets its own beat, and the
              // finding is last in the list so it is last on screen.
              from={BARS_AT + BAR_STEP * i}
              lit={row.label === FINDING}
            />
          ))}
        </div>

        <Dock
          from={calloutAt}
          distance={140}
          rule={false}
          style={{ position: 'absolute', left: 0, top: calloutTop, width: FIELD_W }}
        >
          <div
            style={{
              boxSizing: 'border-box',
              width: FIELD_W,
              height: CALLOUT_H,
              padding: `0 40px`,
              display: 'flex',
              alignItems: 'center',
              gap: 40,
              background: wash(STAGE.alert, 0.1),
              borderLeft: `3px solid ${STAGE.alert}`,
              borderRadius: 16,
            }}
          >
            <Count from={countAt} value={finding.count} size={82} color={STAGE.alert} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ ...LABEL, color: STAGE.alert }}>{FINDING}</div>
              <div style={{ fontSize: TYPE.body, color: STAGE.ink }}>
                of {roster} members, with nothing standing between a password and the org.
              </div>
            </div>
          </div>
        </Dock>
      </Recede>
    </AbsoluteFill>
  );
};
