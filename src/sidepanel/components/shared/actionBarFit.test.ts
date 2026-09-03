import { describe, it, expect } from 'vitest';
import { fitActions, type FitInput, type FitResult } from './actionBarFit';

/**
 * A neutral baseline. `previous` is clamped to the action count, so `99` means
 * "no candidate is a promotion" and the hysteresis term drops out — the plain
 * ladder tables measure the arithmetic, the deadband tables set `previous`
 * deliberately.
 */
const fit = (over: Partial<FitInput>): FitResult =>
  fitActions({
    widths: [],
    compactWidths: [],
    available: 0,
    gap: 8,
    overflowWidth: 50,
    pinned: 0,
    tierAlwaysPresent: false,
    previous: 99,
    ...over,
  });

/**
 * Three 100px actions, an 8px gap and a 50px More cluster. Requirements:
 *   k=3 → 300 + 16                  = 316  (nothing left to disclose: no cluster)
 *   k=2 → 200 +  8 +  8 + 50        = 266
 *   k=1 → 100 +  0 +  8 + 50        = 158
 */
const THREE = { widths: [100, 100, 100], compactWidths: [100, 100, 100] } as const;

/**
 * The six-action set from the measured regression. 100px each with a glyph,
 * 80px without; the two ladders tie at several widths on the way down, which is
 * where the old `comp > full` rule handed the icons back.
 *   full    k=6 → 640  k=5 → 590  k=4 → 482  k=3 → 374  k=2 → 266  k=1 → 158
 *   compact k=6 → 520  k=5 → 490  k=4 → 402  k=3 → 314  k=2 → 226  k=1 → 138
 */
const SIX = {
  widths: [100, 100, 100, 100, 100, 100],
  compactWidths: [80, 80, 80, 80, 80, 80],
} as const;

describe('the plain fit ladder', () => {
  // `compact` is `true` from the first row that loses an action: the ladder is a
  // one-way door, so it never returns to `false` further down this table.
  it.each([
    { available: 400, inBar: 3, compact: false },
    { available: 316, inBar: 3, compact: false }, // exactly the requirement — inclusive
    { available: 315, inBar: 2, compact: true },
    { available: 266, inBar: 2, compact: true },
    { available: 265, inBar: 1, compact: true },
    { available: 158, inBar: 1, compact: true },
    { available: 157, inBar: 0, compact: true },
  ])('seats $inBar of 3 actions in $available px', ({ available, inBar, compact }) => {
    expect(fit({ ...THREE, available })).toEqual({ inBar, compact });
  });

  it('charges the gap between items but not after the last one', () => {
    // Two actions and the cluster: 200 + one inter-item gap + one gap before
    // the cluster = 266. A third gap would push this over.
    expect(fit({ ...THREE, available: 266 }).inBar).toBe(2);
    expect(fit({ ...THREE, available: 265 }).inBar).toBe(1);
  });
});

describe('the needsControl budget', () => {
  /**
   * A narrow last action, so that seating *all three* costs less than seating
   * two: at k=3 with no caller content there is nothing to disclose, so the
   * cluster and the gap in front of it leave the budget entirely.
   *   k=3 → 220 + 16              = 236
   *   k=2 → 200 +  8 + 8 + 50     = 266   ← more than k=3
   *   k=1 → 100 +  0 + 8 + 50     = 158
   */
  const TAPERED = { widths: [100, 100, 20], compactWidths: [100, 100, 20] } as const;

  it('seats every action in a width that could not seat all but one', () => {
    expect(fit({ ...TAPERED, available: 240 })).toEqual({ inBar: 3, compact: false });
    // Proof the 240px budget really is below the two-action requirement: widen
    // only the third action and the same budget collapses to a single action,
    // because now the cluster has to be paid for.
    expect(
      fit({ widths: [100, 100, 200], compactWidths: [100, 100, 200], available: 240 }),
    ).toEqual({ inBar: 1, compact: true });
  });

  it('charges the cluster to every split once the tier always has content', () => {
    // Same geometry, same 240px: with caller content in the tier the More
    // cluster is rendered even at k=3, so k=3 needs 236 + 8 + 50 = 294 and
    // k=2 needs 266 — neither fits, and the row falls to one action.
    expect(fit({ ...TAPERED, available: 240, tierAlwaysPresent: true })).toEqual({
      inBar: 1,
      compact: true,
    });
  });

  it('costs the cluster its width at the top of the ladder', () => {
    // Two 100px actions in exactly 208px = 200 + one gap.
    const TWO = { widths: [100, 100], compactWidths: [100, 100], available: 208 } as const;
    expect(fit(TWO).inBar).toBe(2);
    expect(fit({ ...TWO, tierAlwaysPresent: true }).inBar).toBe(1);
  });
});

describe('dropping icons', () => {
  /** The same three actions, 20px narrower each without their glyph. */
  const COMPACT = { widths: [100, 100, 100], compactWidths: [80, 80, 80] } as const;

  it('drops icons to seat more actions', () => {
    // 250px seats one action with icons (158) but two without (226).
    expect(fit({ ...COMPACT, available: 250 })).toEqual({ inBar: 2, compact: true });
  });

  it('drops icons to seat the whole row', () => {
    // 300px: icons on → 2 (266); icons off → all 3 (240 + 16 = 256).
    expect(fit({ ...COMPACT, available: 300 })).toEqual({ inBar: 3, compact: true });
  });

  it('keeps icons when everything already fits', () => {
    // 320px clears the full-width requirement of 316, so compact is never tried.
    expect(fit({ ...COMPACT, available: 320 })).toEqual({ inBar: 3, compact: false });
  });

  it('still drops icons when dropping them seats no more', () => {
    // 2px narrower each buys nothing at 250px — compact seats one either way
    // (156 vs 262). The icons still come off, because the bar has already lost
    // actions and a narrower panel must never restore a glyph.
    expect(fit({ widths: [100, 100, 100], compactWidths: [98, 98, 98], available: 250 })).toEqual({
      inBar: 1,
      compact: true,
    });
  });

  it('does not restore icons at a width where the two ladders tie', () => {
    // The measured regression, reduced. Six 100px actions, 80px without glyphs:
    // at 489px the full ladder seats 4 (482) and so does the compact one (402).
    // Under the old "only if it seats strictly more" rule that tie handed the
    // icons back — at a width narrower than the one that had already dropped
    // them.
    expect(fit({ ...SIX, available: 489, previous: 4 })).toEqual({ inBar: 4, compact: true });
  });

  it('never turns compact back off as the panel narrows', () => {
    // Sweep the panel inward a pixel at a time, threading each result's `inBar`
    // back in as `previous` exactly as a real drag does, so the hysteresis is
    // live throughout. Two things must hold at every step: the row only ever
    // gets shorter, and once the glyphs are gone they stay gone.
    let previous: number = SIX.widths.length;
    let lastInBar: number = SIX.widths.length;
    let sawCompact = false;

    for (let available = 900; available >= 100; available -= 1) {
      const result = fit({ ...SIX, available, pinned: 1, previous });

      expect(result.inBar).toBeLessThanOrEqual(lastInBar);
      if (sawCompact) {
        expect({ available, compact: result.compact }).toEqual({ available, compact: true });
      }

      sawCompact = sawCompact || result.compact;
      lastInBar = result.inBar;
      previous = result.inBar;
    }

    // Non-vacuity: the sweep really did cross both transitions.
    expect(sawCompact).toBe(true);
    expect(lastInBar).toBeLessThan(SIX.widths.length);
  });

  it('is all-or-nothing: the result carries one flag for the whole row', () => {
    const result = fit({ ...COMPACT, available: 250 });
    expect(result.compact).toBe(true);
    expect(Object.keys(result).sort()).toEqual(['compact', 'inBar']);
  });
});

describe('the pinned floor', () => {
  it('never drops below pinned, even with no room at all', () => {
    // Compact, because the bar lost an action on the way down here: a row that
    // is about to wrap does so without its icons, having already spent the
    // cheaper currency.
    expect(
      fit({ widths: [100, 100, 100], compactWidths: [80, 80, 80], available: 10, pinned: 2 }),
    ).toEqual({ inBar: 2, compact: true });
  });

  it('still overflows down to the floor, not past it', () => {
    // 100px cannot seat two (266) but the floor of 1 holds regardless.
    expect(
      fit({ widths: [100, 100, 100], compactWidths: [80, 80, 80], available: 100, pinned: 1 }),
    ).toEqual({ inBar: 1, compact: true });
  });

  it('does not let the floor block a wider fit', () => {
    expect(fit({ ...THREE, available: 400, pinned: 1 }).inBar).toBe(3);
  });
});

describe('the one-sided deadband', () => {
  /** Two 100px actions: k=2 needs 208, k=1 needs 158. Default hysteresis = gap = 8. */
  const TWO = { widths: [100, 100], compactWidths: [100, 100] } as const;

  it('demotes at the exact threshold, with no slack granted', () => {
    expect(fit({ ...TWO, available: 208, previous: 2 }).inBar).toBe(2);
    expect(fit({ ...TWO, available: 207, previous: 2 }).inBar).toBe(1);
  });

  it.each([
    { available: 207 },
    { available: 208 }, // the width that held it a moment ago — still not enough
    { available: 212 },
    { available: 215 }, // one pixel short of the full deadband
  ])('does not re-promote at $available px once demoted', ({ available }) => {
    expect(fit({ ...TWO, available, previous: 1 }).inBar).toBe(1);
  });

  it('re-promotes only once the budget clears the requirement by a full hysteresis', () => {
    expect(fit({ ...TWO, available: 216, previous: 1 }).inBar).toBe(2);
  });

  it('honours an explicit hysteresis over the gap default', () => {
    expect(fit({ ...TWO, available: 208, previous: 1, hysteresis: 0 }).inBar).toBe(2);
    expect(fit({ ...TWO, available: 240, previous: 1, hysteresis: 40 }).inBar).toBe(1);
    expect(fit({ ...TWO, available: 248, previous: 1, hysteresis: 40 }).inBar).toBe(2);
  });

  it('applies the deadband on the compact ladder too', () => {
    // compact k=2 needs 160 + 8 + 8 + 50 = 226; full k=1 needs 158.
    const COMPACT = { widths: [100, 100, 100], compactWidths: [80, 80, 80] } as const;
    expect(fit({ ...COMPACT, available: 226, previous: 2 })).toEqual({ inBar: 2, compact: true });
    expect(fit({ ...COMPACT, available: 226, previous: 1 })).toEqual({ inBar: 1, compact: true });
    expect(fit({ ...COMPACT, available: 234, previous: 1 })).toEqual({ inBar: 2, compact: true });
  });
});

describe('degenerate input', () => {
  it('handles an empty action list', () => {
    expect(fit({ available: 500 })).toEqual({ inBar: 0, compact: false });
  });

  it.each([{ available: 0 }, { available: -500 }, { available: Number.NaN }])(
    'floors at pinned for an available width of $available',
    ({ available }) => {
      expect(fit({ ...THREE, available, pinned: 1 })).toEqual({ inBar: 1, compact: true });
    },
  );

  it('clamps a pinned count larger than the action list', () => {
    expect(fit({ widths: [100, 100], compactWidths: [100, 100], available: 0, pinned: 5 })).toEqual(
      { inBar: 2, compact: false },
    );
  });

  it('falls back to the natural width where a compact width is missing', () => {
    // No compact measurements at all, so the compact ladder is the full ladder:
    // one seat, not the three that treating a missing width as `0` would give.
    expect(fit({ widths: [100, 100, 100], compactWidths: [], available: 250 })).toEqual({
      inBar: 1,
      compact: true,
    });
    // Only the first is measured: 80 + 100 + 8 + 8 + 50 = 246 fits in 250, so
    // two seats — the unmeasured actions count at their full 100px, not zero.
    expect(fit({ widths: [100, 100, 100], compactWidths: [80], available: 250 })).toEqual({
      inBar: 2,
      compact: true,
    });
  });

  it('treats unmeasurable widths as zero rather than throwing', () => {
    expect(
      fit({
        widths: [Number.NaN, Number.POSITIVE_INFINITY, 100],
        compactWidths: [Number.NaN, Number.POSITIVE_INFINITY, 100],
        available: 250,
      }),
    ).toEqual({ inBar: 3, compact: false });
  });

  it('does not let a negative width pay for its neighbours', () => {
    // Clamped to 0, all three need 0 + 100 + 100 + 16 = 216 and two need
    // 0 + 100 + 8 + 8 + 50 = 166, so 180px seats two. Summed raw, the -40 would
    // subsidise its neighbours (176 for all three) and wrongly seat the lot.
    expect(
      fit({ widths: [-40, 100, 100], compactWidths: [-40, 100, 100], available: 180 }),
    ).toEqual({ inBar: 2, compact: true });
  });

  it('survives a nonsensical gap, cluster width and previous split', () => {
    expect(() =>
      fit({
        ...THREE,
        available: 300,
        gap: Number.NaN,
        overflowWidth: Number.NaN,
        previous: Number.NaN,
      }),
    ).not.toThrow();
    // gap and cluster collapse to 0, so 300px seats all three.
    expect(
      fit({
        ...THREE,
        available: 300,
        gap: Number.NaN,
        overflowWidth: Number.NaN,
        previous: Number.NaN,
      }),
    ).toEqual({ inBar: 3, compact: false });
  });

  /**
   * The selection register is a second row in the same band, fitted by a second
   * call to this function against its own width. These pin what "independently"
   * has to mean, because the two rows sit in one band at one panel width and it
   * would be easy to assume one answer serves both.
   */
  describe('the selection register is a second, independent row', () => {
    /** Two wide selection verbs — the register's row. */
    const REGISTER = { widths: [160, 160], compactWidths: [140, 140] };
    /** Three narrow page verbs — the action row's, at the same panel width. */
    const ROW = { widths: [80, 80, 80], compactWidths: [64, 64, 64] };

    it('lets one row overflow while the other seats everything', () => {
      // The register owns no More control of its own — both rows spill into the
      // action row's one tier — so its cluster width is 0.
      expect(fit({ ...REGISTER, available: 260, overflowWidth: 0, pinned: 1 })).toEqual({
        inBar: 1,
        compact: true,
      });
      // Same 260px, same band: the action row is untouched by that — 3 x 80 plus
      // two 8px gaps is 256, and it keeps its glyphs.
      expect(fit({ ...ROW, available: 260 })).toEqual({ inBar: 3, compact: false });
    });

    it('lets one row go compact while the other keeps its glyphs', () => {
      // 2 × 160 + 8 = 328 does not fit; 2 × 140 + 8 = 288 does. Compact, both in.
      expect(fit({ ...REGISTER, available: 300, overflowWidth: 0, pinned: 0 })).toEqual({
        inBar: 2,
        compact: true,
      });
      // `compact` is a property of the call, not of the band, so the row above
      // keeps its icons at the very same width.
      expect(fit({ ...ROW, available: 300 })).toEqual({ inBar: 3, compact: false });
    });

    it('never lets a register verb push a page verb out, or the reverse', () => {
      // Widen the register's verbs until they overflow. The action row's split at
      // the same width is byte-identical to the one it gets with no register at
      // all — the only channel between the two rows is the More control's width,
      // which `tierAlwaysPresent` charges, and that is charged once.
      const rowAlone = fit({ ...ROW, available: 320, tierAlwaysPresent: true });
      expect(
        fit({ widths: [900, 900], compactWidths: [900, 900], available: 320, pinned: 1 }),
      ).toEqual({ inBar: 1, compact: true });
      expect(fit({ ...ROW, available: 320, tierAlwaysPresent: true })).toEqual(rowAlone);
    });
  });
});
