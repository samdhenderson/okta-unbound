import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupMergeModal from './GroupMergeModal';
import type { GroupSummary } from '../../../shared/types';
import type { MergePlan } from '../../../shared/membership/mergePlan';

function group(id: string, name: string, memberCount: number): GroupSummary {
  return { id, name, type: 'OKTA_GROUP', memberCount, hasRules: false, ruleCount: 0 };
}

const selected = [group('g1', 'Big', 10), group('g2', 'Small', 3)];

const base = {
  isOpen: true,
  selectedGroups: selected,
  phase: 'idle' as const,
  plan: null as MergePlan | null,
  results: null,
  error: null,
  onPreview: vi.fn(),
  onExecute: vi.fn(),
  onClose: vi.fn(),
};

const plan: MergePlan = {
  survivor: { id: 'g1', name: 'Big' },
  toCopy: [],
  totalCopies: 3,
  totalRemovals: 3,
  blocked: false,
  sources: [
    {
      id: 'g2',
      name: 'Small',
      membersToRemove: [],
      hasActiveFeedingRule: false,
      feedingRuleNames: [],
    },
  ],
};

describe('GroupMergeModal', () => {
  it('defaults the survivor to the largest group and previews with the rest as sources', async () => {
    const onPreview = vi.fn();
    render(<GroupMergeModal {...base} onPreview={onPreview} />);
    // Largest ("Big", 10) is pre-selected.
    expect(screen.getByRole('radio', { name: /Big/ })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Preview merge' }));
    expect(onPreview).toHaveBeenCalledTimes(1);
    const [survivor, sources] = onPreview.mock.calls[0];
    expect(survivor.id).toBe('g1');
    expect(sources.map((s: GroupSummary) => s.id)).toEqual(['g2']);
  });

  it('lets the admin pick a different survivor', async () => {
    const onPreview = vi.fn();
    render(<GroupMergeModal {...base} onPreview={onPreview} />);
    await userEvent.click(screen.getByRole('radio', { name: /Small/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Preview merge' }));
    expect(onPreview.mock.calls[0][0].id).toBe('g2');
  });

  it('shows the delta and confirms the merge from the preview', async () => {
    const onExecute = vi.fn();
    render(<GroupMergeModal {...base} phase="preview" plan={plan} onExecute={onExecute} />);
    expect(screen.getByText('Members to copy')).toBeInTheDocument();
    expect(screen.getByText(/these groups will be emptied/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Merge 1 group/ }));
    expect(onExecute).toHaveBeenCalledTimes(1);
  });

  it('blocks the merge when a source is fed by an active rule', () => {
    const blockedPlan: MergePlan = {
      ...plan,
      blocked: true,
      sources: [
        {
          id: 'g2',
          name: 'Small',
          membersToRemove: [],
          hasActiveFeedingRule: true,
          feedingRuleNames: ['Feeder'],
        },
      ],
    };
    render(<GroupMergeModal {...base} phase="preview" plan={blockedPlan} />);
    expect(screen.getByText(/blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/Feeder/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Merge 1 group/ })).toBeDisabled();
  });

  it('summarizes results when done', () => {
    render(
      <GroupMergeModal
        {...base}
        phase="done"
        plan={plan}
        results={{ copied: 3, copyFailed: 0, removed: 3, removeFailed: 0 }}
      />,
    );
    expect(screen.getByText('Copied')).toBeInTheDocument();
    expect(screen.getByText('Emptied')).toBeInTheDocument();
  });
});
