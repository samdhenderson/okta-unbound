/**
 * Tests for the "Attributed to" cap.
 *
 * The list is stateful (it opens a reveal), so ADR-0023's "no test *and* story
 * for a pure-render component" does not apply — `MemberSourceNotes.stories.tsx`
 * covers the render and the axe pass, and this covers what a click does.
 *
 * The rest of the component's behaviour — the indeterminate correction, the
 * provenance chips, the deep-link — stays where it already was, in the stories
 * and in `GroupMembersSection.test.tsx`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemberSourceNotes from './MemberSourceNotes';
import type { MemberSourceBreakdown } from '../../../../shared/membership/groupSource';

function breakdownWith(ruleCount: number): MemberSourceBreakdown {
  return {
    total: ruleCount * 2,
    direct: 0,
    ruleBased: ruleCount * 2,
    unattributed: 0,
    byRule: Array.from({ length: ruleCount }, (_, i) => ({
      ruleId: `0prFAKE${i + 1}`,
      ruleName: `Feeding rule ${i + 1}`,
      count: 2,
    })),
  };
}

describe('the "Attributed to" list', () => {
  it('names every rule inline while there are three or fewer', () => {
    render(<MemberSourceNotes breakdown={breakdownWith(3)} />);

    expect(screen.getByText('Feeding rule 1')).toBeInTheDocument();
    expect(screen.getByText('Feeding rule 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more rule/ })).not.toBeInTheDocument();
  });

  it('caps the inline list at three and states how many it is holding back', () => {
    render(<MemberSourceNotes breakdown={breakdownWith(7)} />);

    expect(screen.getByText('Feeding rule 3')).toBeInTheDocument();
    expect(screen.queryByText('Feeding rule 4')).not.toBeInTheDocument();
    // Deferred with its count stated, never silently truncated.
    expect(screen.getByRole('button', { name: /\+4 more rules/ })).toBeInTheDocument();
  });

  it('opens every rule in the reveal, deep-links and all', async () => {
    const onNavigateToRule = vi.fn();
    render(<MemberSourceNotes breakdown={breakdownWith(7)} onNavigateToRule={onNavigateToRule} />);

    await userEvent.click(screen.getByRole('button', { name: /\+4 more rules/ }));

    const dialog = screen.getByRole('dialog', { name: 'Attributed to' });
    expect(
      within(dialog).getByText('All 7 rules that account for members of this group.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Feeding rule 7')).toBeInTheDocument();

    // A rule past the cap is not a weaker row: it still deep-links.
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Open rule Feeding rule 7 in the Rules tab' }),
    );
    expect(onNavigateToRule).toHaveBeenCalledWith('0prFAKE7');
  });
});
