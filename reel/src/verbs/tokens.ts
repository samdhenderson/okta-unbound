/**
 * @module reel/verbs/tokens
 * @description The app's motion tokens, parsed once, at import time.
 *
 * `theme.generated.ts` carries `DUR` and `EASE` because they are Odyssey tokens
 * like `COLOR` and `FONT` — but until this module, nothing imported them. Every
 * verb's frame count and curve lived as a bare number scattered across whichever
 * component animated it, which is exactly the drift `CLAUDE.md`'s "no raw ms" rule
 * exists to prevent: a token bumped in the app's `tailwind.css` and re-synced here
 * would silently stop matching a verb that had quietly hard-coded the old value.
 *
 * This is the one place a verb's timing is allowed to be a number. Everything
 * downstream imports a name from here, never a literal, and never `theme.generated`
 * directly (`theme.ts` re-exports this module for exactly that reason).
 *
 * Parsing happens **once, at module scope**. `EASE.affirm` is a `cubic-bezier()`
 * string today; if the generator's source CSS ever changes shape (a new easing
 * function, a fifth argument, a token renamed), the parse below throws on import —
 * in the studio, in `type-check`, in CI — rather than months later when a render
 * quietly prints `NaN` frames of motion because a regex silently produced nothing.
 *
 * The verb table and its per-verb frame budget are `DesignDocs/REEL DESIGN AND
 * REWORK/README.md`'s six-verb grammar (dock / lift / count / split / fan /
 * recede). Frame counts below are cited against that table, not re-derived.
 */
import { Easing } from 'remotion';
import { FRAME } from '../frame';
import { DUR, EASE } from '../theme.generated';

/** A parsed `cubic-bezier(x1, y1, x2, y2)` as the four numbers Remotion's `Easing.bezier` wants. */
export type BezierTuple = readonly [number, number, number, number];

/**
 * Parse one `EASE` token into its four control-point numbers.
 *
 * The generator pretty-prints some values across multiple lines — `EASE.affirm`
 * is `'cubic-bezier(\n    0.2,\n    1.3,\n    0.4,\n    1\n  )'` at the time of
 * writing, not the single-line form the other three tokens use. Whitespace
 * (including newlines) is stripped before matching so both shapes parse the same
 * way, and a token that stops being `cubic-bezier(...)` at all — the generator's
 * source CSS changed, a curve became a named easing keyword, whatever — fails
 * here with the token's name and raw value, not as a silent `NaN` in a frame
 * calculation three modules away.
 */
function parseBezier(name: string, raw: string): BezierTuple {
  const flat = raw.replace(/\s+/g, '');
  const match = flat.match(/^cubic-bezier\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)$/);
  if (!match) {
    throw new Error(
      `verbs/ease: EASE.${name} is not a cubic-bezier() this module can parse - got "${raw}".`,
    );
  }
  const [x1, y1, x2, y2] = match.slice(1).map(Number);
  if ([x1, y1, x2, y2].some((n) => Number.isNaN(n))) {
    throw new Error(
      `verbs/ease: EASE.${name} parsed to a non-numeric control point - got "${raw}".`,
    );
  }
  return [x1, y1, x2, y2] as const;
}

/**
 * Every `EASE` token as a numeric tuple, parsed once at import time.
 *
 * `affirm`'s `y1` is `1.3` - it deliberately overshoots past `1`, which is the
 * point (`count`'s roll settles past its final value before easing back). That
 * overshoot is only safe for a property with no valid-range ceiling, like
 * `scale`. A caller driving `opacity` with `BEZIER.affirm` must clamp the
 * interpolated value to `[0, 1]` themselves - Remotion's `Easing.bezier` will
 * happily hand back 1.06 mid-curve, and an unclamped opacity of 1.06 is not an
 * error, just a value nobody asked for.
 */
export const BEZIER = {
  standard: parseBezier('standard', EASE.standard),
  entrance: parseBezier('entrance', EASE.entrance),
  exit: parseBezier('exit', EASE.exit),
  affirm: parseBezier('affirm', EASE.affirm),
  // `press` and `glide` arrived in the app's token set with the response layer
  // (PR #101) and no verb in this film uses either. They are parsed anyway,
  // because the `satisfies` below is the thing that noticed they existed: it
  // makes mirroring every app curve mandatory rather than optional, so a token
  // the product adds cannot sit unmirrored while the film quietly diverges from
  // it. The cost of an unused parse is nothing; the cost of a silent gap is a
  // reel whose motion is a shade off the product's and nobody can say why.
  press: parseBezier('press', EASE.press),
  glide: parseBezier('glide', EASE.glide),
} as const satisfies Record<keyof typeof EASE, BezierTuple>;

/**
 * The same curves as Remotion `Easing.bezier` functions, ready to hand to
 * `interpolate()`. Built from {@link BEZIER}, not from `EASE` a second time, so
 * there is exactly one parse to get wrong.
 */
export const EASING = {
  standard: Easing.bezier(...BEZIER.standard),
  entrance: Easing.bezier(...BEZIER.entrance),
  exit: Easing.bezier(...BEZIER.exit),
  affirm: Easing.bezier(...BEZIER.affirm),
  press: Easing.bezier(...BEZIER.press),
  glide: Easing.bezier(...BEZIER.glide),
} as const;

/** Parse a `DUR` token like `'220ms'` into milliseconds, once, at import time. */
function parseMs(name: string, raw: string): number {
  const match = raw.match(/^(\d+(?:\.\d+)?)ms$/);
  if (!match) {
    throw new Error(
      `verbs/ease: DUR.${name} is not a "<number>ms" this module can parse - got "${raw}".`,
    );
  }
  return Number(match[1]);
}

/** A `DUR` token's duration in frames at the film's fps, rounded to the nearest frame. */
export function framesFor(name: keyof typeof DUR): number {
  return Math.round((parseMs(name, DUR[name]) / 1000) * FRAME.fps);
}
