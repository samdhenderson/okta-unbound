import { describe, it, expect } from 'vitest';
import { spreadSegments } from './attributeSpread';
import { CHART_TAIL_HATCH, INDIGO_RAMP } from '../../../theme/chartPalette';
import { NONE_VALUE, OTHER_VALUE, type BreakdownRow } from '../../members/memberAnalytics';

const row = (value: string, count: number, pct = 0): BreakdownRow => ({
  value,
  label: value,
  count,
  pct,
});

describe('spreadSegments', () => {
  it('takes ramp stops in row order, deepest first', () => {
    const segments = spreadSegments([row('A', 5), row('B', 3), row('C', 1)]);
    expect(segments.map((s) => s.background)).toEqual([
      INDIGO_RAMP[0],
      INDIGO_RAMP[1],
      INDIGO_RAMP[2],
    ]);
  });

  it('hatches the aggregated tail rather than tinting it', () => {
    const segments = spreadSegments([row('A', 5), row(OTHER_VALUE, 3)]);
    expect(segments.at(-1)).toMatchObject({ background: CHART_TAIL_HATCH, isTail: true });
    // And the tail never consumes a ramp stop meant for a named value.
    expect(segments[0]?.background).toBe(INDIGO_RAMP[0]);
  });

  it('excludes blanks — the bar describes populated members only', () => {
    const segments = spreadSegments([row('A', 5), row(NONE_VALUE, 40), row('B', 3)]);
    expect(segments.map((s) => s.row.value)).toEqual(['A', 'B']);
    // The blank did not shift `B` down the ramp on its way past.
    expect(segments[1]?.background).toBe(INDIGO_RAMP[1]);
  });

  it('excludes zero-count rows, which would draw a segment nobody is in', () => {
    expect(spreadSegments([row('A', 5), row('B', 0)]).map((s) => s.row.value)).toEqual(['A']);
  });

  it('reuses the last ramp stop past its end rather than wrapping to the darkest', () => {
    // Wrapping would paint the *smallest* slice the most prominent colour.
    const segments = spreadSegments(
      Array.from({ length: INDIGO_RAMP.length + 3 }, (_, i) => row(`V${i}`, 10 - i)),
    );
    const last = INDIGO_RAMP[INDIGO_RAMP.length - 1];
    for (const segment of segments.slice(INDIGO_RAMP.length - 1)) {
      expect(segment.background).toBe(last);
    }
  });

  it('draws nothing when every member is blank', () => {
    expect(spreadSegments([row(NONE_VALUE, 40)])).toEqual([]);
  });

  it('draws nothing for an empty distribution', () => {
    expect(spreadSegments([])).toEqual([]);
  });
});
