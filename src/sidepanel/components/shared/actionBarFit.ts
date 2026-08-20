/**
 * @module sidepanel/components/shared/actionBarFit
 * @description The `ActionBar` fit ladder, as a pure function (ADR-0038).
 *
 * Given the measured widths of a strip's actions and the room it has, this
 * decides two things: how many actions stay in the bar, and whether every bar
 * action drops its icon to buy that. It is deliberately DOM-free — the
 * measuring half lives in `useActionOverflow`, so the part with the arithmetic
 * and the hysteresis can be pinned by a table of numbers instead of a
 * `ResizeObserver` stub.
 *
 * ## Why the ladder is icons-then-overflow
 *
 * An icon is the cheapest thing on the row and the least load-bearing: the
 * label already names the verb, so dropping the glyph costs recognition speed
 * but never comprehension. Overflowing an action costs the whole affordance —
 * it moves behind a disclosure the user has to find and open. So the strip
 * spends the cheap currency first and only overflows once a compact row still
 * will not fit.
 *
 * That ordering is also why {@link FitResult.compact} is global. A row where
 * some buttons kept their icon and some did not reads as a rendering bug, not
 * as a density choice, so icons are dropped from every bar action or from
 * none. The ladder therefore has four rungs, not `2^n`: full row → compact row
 * → compact row minus one action → … → the pinned floor.
 *
 * ## Why compact is a one-way door
 *
 * The thrifty rule — go compact only when dropping the icons actually buys a
 * seat — is wrong, and wrong in a way that only shows up on a drag. It is not
 * monotonic in width. Measured on six actions, dragging the panel inward:
 *
 * ```
 * 1000px  6 actions  icons on
 *  720px  6 actions  icons off
 *  560px  4 actions  icons off
 *  480px  3 actions  icons on    <- back
 *  420px  3 actions  icons off
 *  380px  2 actions  icons on    <- back again
 * ```
 *
 * At 480 the compact ladder happens to seat exactly the same three actions as
 * the full one, so "only if it buys a seat" declines to pay and restores the
 * glyphs — on a panel narrower than the one that dropped them. Every action is
 * individually defensible and the sequence is nonsense: the user drags steadily
 * in one direction and watches the icons flicker on, off, on, off.
 *
 * So the requirement is monotonicity, not thrift. **As the panel narrows, the
 * row may only ever get plainer.** An icon that returns while space is being
 * taken away reads as a rendering bug, and no amount of per-step optimality
 * redeems it. The rule is therefore a one-way door: the moment the bar is
 * cramped enough to lose a single action it goes compact, and it stays compact
 * all the way down.
 *
 * This costs no seats. Compact widths are never wider than natural ones, so the
 * compact ladder always seats at least as many actions as the full one — the
 * change only stops the glyphs coming back on the way down, never seats fewer.
 *
 * It also settles the {@link FitInput.pinned} floor for free, rather than as a
 * special case. A row that has bottomed out at the floor and is about to wrap is
 * compact by definition, so it wraps without its icons — which is the better
 * signal anyway, since it has already spent the cheap currency before resorting
 * to the expensive one.
 *
 * ## Why the deadband is one-sided
 *
 * The strip is re-fitted on every `ResizeObserver` frame while the side panel is
 * being dragged. A symmetric threshold means the action nearest the boundary
 * flips in and out on every pixel of jitter around it, which is far more
 * distracting than the layout change it is trying to smooth.
 *
 * So the two directions are not symmetric, on purpose:
 *
 * - **Demotion is immediate.** The moment an action genuinely does not fit it
 *   must leave, or it gets clipped or wraps the row. There is no honest way to
 *   defer that.
 * - **Promotion is grudging.** Bringing an action back demands
 *   {@link FitInput.hysteresis} px of slack *beyond* what it needs, so once the
 *   panel has crossed the boundary it has to be dragged meaningfully back
 *   before the action returns. The default is one `gap`, which is the smallest
 *   slack a user could plausibly have aimed at.
 *
 * The result is a deadband the drag has to cross twice to oscillate, rather
 * than a threshold it sits on.
 *
 * ## The constraint this places on the caller
 *
 * **{@link FitInput.overflowWidth} must not vary with how many actions
 * overflowed.** No "More (3)" count, no badge, no pluralised label. The
 * requirement for keeping `k` actions in the bar includes the width of the
 * trailing cluster; if that width were itself a function of `n - k`, the
 * requirement would be self-referential and the split would oscillate between
 * two states that each justify the other. A fixed-width **More** control is not
 * a styling preference, it is what makes this function converge.
 */

/** Input to {@link fitActions}. All measurements are CSS pixels. */
export interface FitInput {
  /**
   * Natural widths of the bar-eligible actions, in bar order (pinned first),
   * measured with their icons shown.
   */
  widths: readonly number[];
  /**
   * The same actions measured with their icons dropped — same length, same
   * order as {@link FitInput.widths}. A short or missing entry falls back to
   * the natural width, which simply means compact can never win there.
   */
  compactWidths: readonly number[];
  /** Content-box width available to the row. */
  available: number;
  /** Flex gap between row items. */
  gap: number;
  /**
   * Width of the entire trailing cluster — hairline separator, its inner
   * spacing, and the **More** control.
   *
   * Must be independent of how many actions overflow; see the module notes. A
   * count or badge in the label makes this input depend on this function's own
   * output and the split will thrash.
   */
  overflowWidth: number;
  /**
   * How many actions at the head of {@link FitInput.widths} may never
   * overflow. When even those do not fit, the row wraps rather than emptying —
   * so this is a floor on the result, not a hint.
   */
  pinned: number;
  /**
   * `true` when the tier holds caller content, so the **More** control is
   * rendered whether or not anything overflowed. Its width is then charged to
   * every candidate split, including the one where everything stays in the bar.
   */
  tierAlwaysPresent: boolean;
  /** The previous {@link FitResult.inBar}, which the deadband is measured from. */
  previous: number;
  /**
   * Slack demanded before an action may be re-promoted into the bar. Defaults
   * to {@link FitInput.gap}. Only ever applied on the way up; see the module
   * notes on the one-sided deadband.
   */
  hysteresis?: number;
}

/** The split {@link fitActions} chose. */
export interface FitResult {
  /**
   * How many actions stay in the bar, counted from the head. The remainder
   * overflow into the tier. Never below {@link FitInput.pinned}.
   */
  inBar: number;
  /**
   * `true` when every bar action must drop its icon. Global by design — never
   * applied to a subset — and monotonic in the panel width: it flips once, when
   * the bar first loses an action, and stays `true` however much narrower the
   * panel gets. See the module notes on why it is a one-way door.
   */
  compact: boolean;
}

/** Coerce a measurement to a usable, non-negative, finite pixel value. */
function px(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Running totals of `widths`, so the requirement for any `k` is O(1).
 *
 * `prefix[k]` is the summed width of the first `k` actions; `prefix[0]` is 0.
 */
function prefixSums(widths: readonly number[], length: number): number[] {
  const prefix: number[] = [0];
  for (let i = 0; i < length; i += 1) prefix.push(prefix[i] + px(widths[i]));
  return prefix;
}

/**
 * Choose how many actions fit in the bar and whether the row must go compact.
 *
 * Runs the ladder described in the module notes: try the full-width row and, if
 * it cannot seat every action, drop the icons and run the ladder again — this
 * time keeping the result unconditionally, because a row that has started
 * overflowing must not get its glyphs back as it narrows further.
 *
 * Total by construction. It never throws and returns a sane split for a
 * zero-or-negative budget, an empty action list, a `pinned` count larger than
 * the list, a short `compactWidths`, and non-finite measurements — all of which
 * happen for real, because a hidden rung measures every width as `0`.
 *
 * @param input - Measured geometry plus the previous split; see {@link FitInput}.
 * @returns The chosen split; see {@link FitResult}.
 *
 * @example
 * ```ts
 * // Three 100px actions, an 8px gap and a 50px More cluster, in 250px:
 * // the full row seats one, but dropping icons seats two — so icons go.
 * fitActions({
 *   widths: [100, 100, 100],
 *   compactWidths: [80, 80, 80],
 *   available: 250,
 *   gap: 8,
 *   overflowWidth: 50,
 *   pinned: 0,
 *   tierAlwaysPresent: false,
 *   previous: 3,
 * }); // → { inBar: 2, compact: true }
 * ```
 */
export function fitActions(input: FitInput): FitResult {
  const n = Array.isArray(input.widths) ? input.widths.length : 0;
  const gap = px(input.gap);
  const available = px(input.available);
  const overflowWidth = px(input.overflowWidth);
  const hysteresis = px(input.hysteresis ?? gap);

  // A `pinned` count past the end of the list means every action is pinned.
  const pinned = Math.min(n, Math.max(0, Math.trunc(px(input.pinned))));
  const previous = Math.min(n, Math.max(0, Math.trunc(px(input.previous))));

  const naturalPrefix = prefixSums(input.widths, n);

  /**
   * Room needed to seat `k` actions: their widths, plus the trailing cluster
   * when anything is left over to disclose or the tier has caller content,
   * plus one gap between every pair of adjacent boxes on the row.
   *
   * Counting *boxes* rather than actions is what keeps the two ends honest:
   * there is no gap after the last box, and none before the first, so `k`
   * actions beside a cluster pay `k` gaps while `k` actions alone pay `k - 1`.
   *
   * The consequence is that the last step down the ladder is the cheapest one.
   * At `k === n` with no caller content there is nothing to disclose, so the
   * cluster *and* the gap in front of it leave the budget entirely — seating
   * every action can genuinely need less room than seating all but one.
   */
  const required = (k: number, prefix: readonly number[]): number => {
    const needsControl = input.tierAlwaysPresent || k < n;
    const boxes = needsControl ? k + 1 : k;
    return prefix[k] + (needsControl ? overflowWidth : 0) + gap * Math.max(boxes - 1, 0);
  };

  /**
   * The largest seatable `k`, floored at `pinned`. Growing past `previous` has
   * to clear the extra slack; holding or shrinking does not.
   *
   * `pinned` itself is returned without being tested, because it is not a
   * candidate — it is the floor. A pinned action does not leave the bar when it
   * stops fitting; the row wraps under it, which is what `ActionBar` did before
   * any of this measuring existed.
   */
  const best = (prefix: readonly number[]): number => {
    for (let k = n; k > pinned; k -= 1) {
      const budget = available - (k > previous ? hysteresis : 0);
      if (required(k, prefix) <= budget) return k;
    }
    return pinned;
  };

  // The only exit that keeps the icons: every action already fits with its
  // glyph on, so the bar is not cramped and the one-way door has not opened.
  if (best(naturalPrefix) === n) return { inBar: n, compact: false };

  // A missing compact measurement falls back to the natural width: an unmeasured
  // action is not evidence that dropping its icon would help.
  const measured = Array.isArray(input.compactWidths) ? input.compactWidths : [];
  const compactPrefix = prefixSums(
    Array.from({ length: n }, (_, i) => measured[i] ?? input.widths[i]),
    n,
  );

  // Unconditional, not `compact > full`. The compact ladder can never seat
  // fewer (compact widths are never wider), so this loses nothing — and taking
  // it only when it strictly wins would hand the icons back at widths where the
  // two ladders happen to tie, which is visible as a flicker on a drag.
  return { inBar: best(compactPrefix), compact: true };
}
