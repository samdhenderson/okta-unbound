import { describe, it, expect } from 'vitest';
import { mfaEnrollmentSegments } from './mfaSpread';
import { spreadSegments } from './attributeSpread';
import { MFA_ENROLLMENT_PAINT, INDIGO_RAMP } from '../../../theme/chartPalette';
import type { BreakdownRow } from '../../members/memberAnalytics';

const rows: BreakdownRow[] = [
  { value: 'none', label: 'No factors enrolled', count: 2, pct: 5 },
  { value: 'single', label: 'One factor', count: 7, pct: 17.5 },
  { value: 'multiple', label: 'Two or more factors', count: 31, pct: 77.5 },
];

describe('mfaEnrollmentSegments', () => {
  it('draws the "no factors" bucket, which the attribute walk would have dropped', () => {
    // `spreadSegments` skips the `NONE_VALUE` sentinel because a blank attribute
    // is the absence of a value. "No factors enrolled" is the opposite: it is the
    // finding the card exists to report, and it carries the value 'none', not
    // '__none__'. This test is what stops the two from being confused again.
    expect(mfaEnrollmentSegments(rows).map((s) => s.row.value)).toEqual([
      'none',
      'single',
      'multiple',
    ]);
  });

  it('paints each bucket for what it is, not for where it sits', () => {
    const segments = mfaEnrollmentSegments(rows);
    expect(segments[0].background).toBe(MFA_ENROLLMENT_PAINT.none);
    expect(segments[1].background).toBe(MFA_ENROLLMENT_PAINT.single);
    expect(segments[2].background).toBe(MFA_ENROLLMENT_PAINT.multiple);

    // The positional ramp would have given the worst bucket the deepest, most
    // emphatic stop purely because it is listed first.
    expect(segments[0].background).not.toBe(INDIGO_RAMP[0]);
    expect(spreadSegments(rows)[0].background).toBe(INDIGO_RAMP[0]);
  });

  it('drops an empty bucket rather than drawing a sliver for it', () => {
    const noneEmpty: BreakdownRow[] = [
      { value: 'none', label: 'No factors enrolled', count: 0, pct: 0 },
      ...rows.slice(1),
    ];
    expect(mfaEnrollmentSegments(noneEmpty).map((s) => s.row.value)).toEqual([
      'single',
      'multiple',
    ]);
  });

  it('never marks a bucket as an aggregate — there is no tail here', () => {
    expect(mfaEnrollmentSegments(rows).every((s) => !s.isTail)).toBe(true);
  });
});
