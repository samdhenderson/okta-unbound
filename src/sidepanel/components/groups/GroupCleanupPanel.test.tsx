import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupCleanupPanel from './GroupCleanupPanel';
import type { GroupSummary } from '../../../shared/types';

function group(overrides: Partial<GroupSummary> & { id: string; name: string }): GroupSummary {
  return {
    type: 'OKTA_GROUP',
    memberCount: 5,
    hasRules: false,
    ruleCount: 0,
    description: 'desc',
    ...overrides,
  };
}

describe('GroupCleanupPanel', () => {
  it('shows a clean-directory empty state when nothing is flagged', () => {
    render(
      <GroupCleanupPanel
        groups={[group({ id: 'g1', name: 'Alpha' }), group({ id: 'g2', name: 'Beta' })]}
        onSelectGroups={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('No clutter detected')).toBeInTheDocument();
  });

  it('selects the empty-group category and previews reasons', async () => {
    const onSelectGroups = vi.fn();
    render(
      <GroupCleanupPanel
        groups={[
          group({ id: 'g1', name: 'Empty One', memberCount: 0 }),
          group({ id: 'g2', name: 'Healthy' }),
        ]}
        onSelectGroups={onSelectGroups}
        onClose={() => {}}
      />,
    );
    // Reason chip is previewed.
    expect(screen.getByText('No members')).toBeInTheDocument();
    // The Empty category tile is a clickable selector.
    await userEvent.click(screen.getByRole('button', { name: /Empty/ }));
    expect(onSelectGroups).toHaveBeenCalledWith(['g1']);
  });

  it('selects all flagged groups', async () => {
    const onSelectGroups = vi.fn();
    render(
      <GroupCleanupPanel
        groups={[
          group({ id: 'g1', name: 'Dup', memberCount: 0 }),
          group({ id: 'g2', name: 'dup' }),
        ]}
        onSelectGroups={onSelectGroups}
        onClose={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Select all flagged/ }));
    // g1 (empty + duplicate) and g2 (duplicate) are both flagged.
    expect(onSelectGroups).toHaveBeenCalledWith(expect.arrayContaining(['g1', 'g2']));
  });

  it('renders an empty category as a non-interactive tile', () => {
    render(
      <GroupCleanupPanel
        groups={[group({ id: 'g1', name: 'Empty One', memberCount: 0 })]}
        onSelectGroups={() => {}}
        onClose={() => {}}
      />,
    );
    // No duplicate names here -> the Duplicate names tile is present but not a selector.
    expect(screen.getByText('Duplicate names')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Duplicate names/ })).not.toBeInTheDocument();
  });
});
