import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MemberSourceMeter from './MemberSourceMeter';
import type {
  MemberSourceBreakdown,
  RuleMemberCounts,
} from '../../../../shared/membership/groupSource';

const breakdown = (over: Partial<MemberSourceBreakdown> = {}): MemberSourceBreakdown => ({
  total: 0,
  direct: 0,
  ruleBased: 0,
  unattributed: 0,
  byRule: [],
  ...over,
});

const rule = (
  ruleId: string,
  ruleName: string,
  soleCount: number,
  over: Partial<RuleMemberCounts> = {},
): RuleMemberCounts => ({
  ruleId,
  ruleName,
  soleCount,
  oktaAttributedCount: soleCount,
  clientAttributedCount: 0,
  ...over,
});

describe('MemberSourceMeter', () => {
  it('names each attributing rule in the legend with its member count', () => {
    render(
      <MemberSourceMeter
        breakdown={breakdown({
          total: 10,
          direct: 2,
          ruleBased: 8,
          byRuleMembers: [rule('r1', 'Eng feeder', 5), rule('r2', 'Contractor feeder', 3)],
          multiRuleMembers: 0,
        })}
      />,
    );

    expect(screen.getByText('Eng feeder')).toBeInTheDocument();
    expect(screen.getByText('Contractor feeder')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('(50%)')).toBeInTheDocument();
    expect(screen.getByText('(30%)')).toBeInTheDocument();
    expect(screen.getByText('(20%)')).toBeInTheDocument();
  });

  it('gives a member matched by two rules its own legible segment, counted once', () => {
    render(
      <MemberSourceMeter
        breakdown={breakdown({
          total: 70,
          direct: 1,
          ruleBased: 69,
          byRuleMembers: [rule('r1', 'Eng feeder', 68)],
          multiRuleMembers: 1,
        })}
      />,
    );

    expect(screen.getByText('Matched by 2+ rules')).toBeInTheDocument();
    // A 1-in-70 segment must not disappear: it keeps a minimum bar width.
    const segments = document.querySelectorAll('div[style*="width"]');
    expect(segments).toHaveLength(3);
    for (const segment of segments) expect(segment.className).toContain('min-w-1');
  });

  it('states how many rules the aggregated tail folded in', () => {
    const rules = Array.from({ length: 9 }, (_, i) => rule(`r${i + 1}`, `Rule ${i + 1}`, 10 - i));
    const total = rules.reduce((n, r) => n + r.soleCount, 0);

    render(
      <MemberSourceMeter
        breakdown={breakdown({ total, direct: 0, ruleBased: total, byRuleMembers: rules })}
      />,
    );

    expect(screen.getByText('Other rules')).toBeInTheDocument();
    expect(screen.getByText('+3 more rules')).toBeInTheDocument();
    expect(screen.queryByText('Rule 9')).not.toBeInTheDocument();
  });

  it('renders no empty slice or legend row for a zero-count segment', () => {
    render(
      <MemberSourceMeter
        breakdown={breakdown({
          total: 4,
          direct: 0,
          ruleBased: 4,
          byRuleMembers: [rule('r1', 'Eng feeder', 4), rule('r2', 'Never alone', 0)],
          multiRuleMembers: 0,
        })}
      />,
    );

    expect(screen.queryByText('Never alone')).not.toBeInTheDocument();
    expect(screen.queryByText('Manual')).not.toBeInTheDocument();
    expect(screen.queryByText('Matched by 2+ rules')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('falls back to one aggregate segment when exclusivity was never computed', () => {
    render(<MemberSourceMeter breakdown={breakdown({ total: 4, direct: 1, ruleBased: 3 })} />);

    expect(screen.getByText('Rule-managed')).toBeInTheDocument();
    expect(screen.getByText('(75%)')).toBeInTheDocument();
  });

  it('says so rather than drawing an empty track when there is nothing to attribute', () => {
    render(<MemberSourceMeter breakdown={breakdown()} />);
    expect(screen.getByText('No members to attribute.')).toBeInTheDocument();
  });
});
