/**
 * @module reel/verbs/Count
 * @description Verb 3 of 6: count - a captured figure arriving.
 *
 * `DesignDocs/REEL DESIGN AND REWORK/README.md`, the verb table: 30f roll +
 * 8f affirm, "digits roll behind two clipping hairlines like an odometer;
 * digit columns settle 3f apart; the last column overshoots 4 percent. The
 * unit label never animates."
 *
 * **Not built on `useVerb`.** `useVerb` hands back one `[0,1]` number per
 * verb; count needs a *different* number per digit column (each column
 * starts 3f after the last), and each column's own number is two curves
 * glued together (`standard` roll, then `affirm` settle) rather than one. That
 * is more shape than `useVerb`'s contract carries, so this file computes its
 * own per-column timeline directly from `FRAMES`/`EASING` - `useVerb.ts`'s
 * module doc says the same thing from the other side.
 *
 * ## The overshoot-without-a-jump trick
 *
 * The spec's "last column overshoots 4 percent" then "settles" - meaning the
 * column must end up *exactly* aligned on its final digit, not permanently
 * offset by the overshoot. `interpolate(t, [0,1], [d, d])` can't produce that
 * (an equal-range interpolation is constant regardless of easing), so the
 * overshoot here is computed as `(EASING.affirm(t) - t) * OVERSHOOT_SCALE`.
 * A cubic-bezier easing is pinned to `(0,0)` and `(1,1)` by construction, so
 * `EASING.affirm(t) - t` is exactly `0` at both `t=0` and `t=1` - continuous
 * with the roll phase's landing position, and settled to it precisely - and
 * positive in between, because `EASE.affirm`'s `y1` of `1.3` bows the curve
 * above the diagonal. `OVERSHOOT_SCALE` is tuned to keep that bow's peak near
 * the spec's "4 percent" of one cell height; the exact bezier extremum isn't
 * derived, since the shape (overshoot then exact settle) is what the spec is
 * naming, not a specific pixel count.
 *
 * ## The trap: a strip needs a cell past the digit it lands on
 *
 * Each column is a vertical strip of digit glyphs (`0` through the target
 * digit `d`) sliding behind a clipped window, landing on `d`. Without one more
 * cell *after* `d`, the affirm overshoot slides the window past the strip's
 * last real cell and into empty space - a blank flash behind the hairlines
 * for a few frames, on the one beat meant to look most exact. The fix costs
 * one extra glyph: append a duplicate of `d` after the strip's last real cell,
 * so whatever the overshoot briefly reveals is pixel-identical to the resting
 * frame.
 *
 * ## Why `roll={false}` is the same component, not a fork
 *
 * The ledger set piece (B2 option B) needs "the zero does not roll, it simply
 * sets" - a count with no motion at all. That has to be `<Count roll={false}>`
 * rather than a second, simpler component, or the still figures beside it
 * would drift from the rolling ones in type size, hairline placement, and
 * `tabular-nums` alignment the moment either file changed independently.
 * `roll={false}` skips straight to a one-cell strip with no transform: no
 * roll, no affirm, identical chrome.
 *
 * Never wrap this in Remotion's `<Sequence>` - see `useVerb.ts`'s module doc
 * for why that fails silently instead of throwing.
 */
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { STAGE, TYPE } from '../theme';
import { EASING, FRAMES } from './ease';

/** Peak overshoot, as a fraction of one cell's height. See the module doc. */
const OVERSHOOT_SCALE = 0.12;

/**
 * One digit column: a clipped strip of stacked glyphs from `0` through `d`,
 * plus one trailing duplicate of `d` (see the module doc's trap section),
 * translated into view.
 */
const DigitColumn: React.FC<{
  digit: number;
  colFrom: number;
  roll: boolean;
  size: number;
  color: string;
}> = ({ digit, colFrom, roll, size, color }) => {
  const frame = useCurrentFrame();
  const cellHeight = size * 1.2;

  let index: number;
  let cells: number[];
  if (!roll) {
    // "The zero does not roll, it simply sets": one cell, no transform.
    cells = [digit];
    index = 0;
  } else {
    const rollT = interpolate(frame, [colFrom, colFrom + FRAMES.countRoll], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const rollPos = EASING.standard(rollT) * digit;
    const affirmT = interpolate(
      frame,
      [colFrom + FRAMES.countRoll, colFrom + FRAMES.countRoll + FRAMES.countAffirmSettle],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
    const overshoot = (EASING.affirm(affirmT) - affirmT) * OVERSHOOT_SCALE;
    index = rollPos + overshoot;
    cells = [...Array.from({ length: digit + 1 }, (_, i) => i), digit];
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '1ch',
        // `1ch` resolves against the *inherited* font-size, not the `size`
        // prop - without setting it explicitly here (every inner cell below
        // already does), a caller whose ambient font-size differs from
        // `size` gets a clip window sized for the wrong font, clipping the
        // digit strip to a sliver instead of clipping it to one digit.
        fontSize: size,
        height: cellHeight,
        overflow: 'hidden',
        borderTop: `1px solid ${STAGE.rule}`,
        borderBottom: `1px solid ${STAGE.rule}`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translateY(${-index * cellHeight}px)`,
        }}
      >
        {cells.map((cell, i) => (
          <div
            key={i}
            style={{
              height: cellHeight,
              width: '1ch',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: size,
              fontWeight: 700,
              color,
              fontVariantNumeric: 'tabular-nums',
              fontFeatureSettings: '"tnum"',
            }}
          >
            {cell}
          </div>
        ))}
      </div>
    </div>
  );
};

export interface CountProps {
  /** Absolute composition frame the roll begins on (the first column's). */
  from: number;
  /** The figure. Must be a finite number - see the thrown error below for why. */
  value: number;
  /** The fixed part of the sentence. Present at `from`, full opacity, never animates. */
  unit?: string;
  size?: number;
  color?: string;
  /** `false` makes every column set in place instead of rolling. Default `true`. */
  roll?: boolean;
  style?: React.CSSProperties;
}

/** `1234` -> `'1,234'`. A literal comma, not `toLocaleString` - grouping must not depend on a render box's locale. */
function formatDigits(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const grouped = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return value < 0 ? `-${grouped}` : grouped;
}

/**
 * count. Renders `value` as digit columns (each an odometer cell) plus static
 * separator glyphs and a static unit label.
 */
export const Count: React.FC<CountProps> = ({
  from,
  value,
  unit,
  size = TYPE.figure,
  color = STAGE.ink,
  roll = true,
  style,
}) => {
  // A NaN figure on screen is exactly the failure `captures.ts`'s
  // `figureNumber()` exists to catch at capture time; catching it again here
  // means a verb misused directly (not through a capture) fails the same way.
  if (!Number.isFinite(value)) {
    throw new Error(`verbs/Count: "value" must be a finite number - got ${JSON.stringify(value)}.`);
  }

  const formatted = formatDigits(value);
  let columnIndex = 0;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2, ...style }}>
      {[...formatted].map((ch, i) => {
        if (/\d/.test(ch)) {
          const digit = Number(ch);
          const col = columnIndex;
          columnIndex += 1;
          const colFrom = from + col * FRAMES.countColumnOffset;
          return (
            <DigitColumn
              key={i}
              digit={digit}
              colFrom={colFrom}
              roll={roll}
              size={size}
              color={color}
            />
          );
        }
        // A thousands separator (or a leading `-`): a static glyph, never a rolling cell.
        return (
          <div
            key={i}
            style={{
              height: size * 1.2,
              display: 'flex',
              alignItems: 'center',
              fontSize: size,
              fontWeight: 700,
              color,
            }}
          >
            {ch}
          </div>
        );
      })}
      {unit && (
        <span style={{ fontSize: TYPE.unit, color: STAGE.inkDim, marginLeft: 10 }}>{unit}</span>
      )}
    </div>
  );
};
