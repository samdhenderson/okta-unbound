import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GroupListItemSignal from './GroupListItemSignal';
import { summarizeGroupRow } from './groupSourceSummary';
import type { GroupSummary } from '../../../shared/types';
import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';

const group: GroupSummary = {
  id: '00gFAKEgroup0000001',
  name: 'Engineering',
  type: 'OKTA_GROUP',
  memberCount: 70,
  hasRules: true,
  ruleCount: 2,
};

const breakdown: MemberSourceBreakdown = {
  total: 70,
  direct: 1,
  ruleBased: 69,
  unattributed: 0,
  byRule: [
    { ruleId: 'r1', ruleName: 'Eng feeder', count: 41 },
    { ruleId: 'r2', ruleName: 'Contractor feeder', count: 29 },
  ],
  byRuleMembers: [
    {
      ruleId: 'r1',
      ruleName: 'Eng feeder',
      soleCount: 40,
      oktaAttributedCount: 41,
      clientAttributedCount: 0,
    },
    {
      ruleId: 'r2',
      ruleName: 'Contractor feeder',
      soleCount: 28,
      oktaAttributedCount: 29,
      clientAttributedCount: 0,
    },
  ],
  multiRuleMembers: 1,
};

describe('GroupListItemSignal member-source bar', () => {
  it('draws one slice per rule while the text stays coarse enough for one line', () => {
    render(<GroupListItemSignal model={summarizeGroupRow(group, breakdown)} />);

    // 2 rule slices + the shared-member slice + the manual slice.
    const slices = document.querySelectorAll('span[style*="width"]');
    expect(slices).toHaveLength(4);
    expect(screen.getByText('Rule-managed 69 · Manual 1')).toBeInTheDocument();
    expect(screen.queryByText(/Eng feeder/)).not.toBeInTheDocument();
  });

  it('colours rule slices from the chart ramp and keeps the rest on tokens', () => {
    render(<GroupListItemSignal model={summarizeGroupRow(group, breakdown)} />);

    const slices = [...document.querySelectorAll('span[style*="width"]')];
    expect(slices[0].getAttribute('style')).toContain('background-color');
    // The manual slice is the last one and stays token-coloured.
    expect(slices[3].className).toContain('bg-neutral-400');
    expect(slices[3].getAttribute('style')).not.toContain('background-color');
  });

  it('keeps a one-member slice visible with a minimum width', () => {
    const slices = [
      ...render(
        <GroupListItemSignal model={summarizeGroupRow(group, breakdown)} />,
      ).container.querySelectorAll('span[style*="width"]'),
    ];

    for (const slice of slices) expect(slice.className).toContain('min-w-0.5');
  });

  it('names every segment in the bar tooltip, which the one-line text cannot', () => {
    render(<GroupListItemSignal model={summarizeGroupRow(group, breakdown)} />);

    const [bar] = document.querySelectorAll('span[title]');
    expect(bar.getAttribute('title')).toContain('Eng feeder');
    expect(bar.getAttribute('title')).toContain('Matched by 2+ rules');
  });
});
