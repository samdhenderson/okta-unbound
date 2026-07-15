import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RuleConsolidationModal from './RuleConsolidationModal';
import type { ConsolidationPreview } from '../hooks/useRuleConsolidation';

const base = {
  phase: 'idle' as const,
  preview: null as ConsolidationPreview | null,
  result: null,
  error: null,
  searchGroups: vi.fn(async () => [] as Array<{ id: string; name: string }>),
  onChooseGroup: vi.fn(),
  onExecute: vi.fn(),
  onClose: vi.fn(),
};

const addPreview: ConsolidationPreview = {
  mode: 'add-target',
  baseName: 'Eng',
  resultingName: 'Eng (consolidated)',
  resultingGroupIds: ['g1', 'g2'],
  addedGroupIds: ['g2'],
  addedGroupNames: ['Sales'],
  retireRules: [{ id: 'r1', name: 'Eng', status: 'ACTIVE' }],
  willActivate: true,
};

describe('RuleConsolidationModal', () => {
  it('is closed when idle', () => {
    const { container } = render(<RuleConsolidationModal {...base} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('searches and selects a group in the add-target step', async () => {
    const searchGroups = vi.fn(async () => [{ id: 'g2', name: 'Sales' }]);
    const onChooseGroup = vi.fn();
    render(
      <RuleConsolidationModal
        {...base}
        phase="select"
        searchGroups={searchGroups}
        onChooseGroup={onChooseGroup}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText(/Search groups/i), 'Sal');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sales' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Sales' }));
    expect(onChooseGroup).toHaveBeenCalledWith('g2', 'Sales');
  });

  it('shows the dry-run diff and confirms from preview', async () => {
    const onExecute = vi.fn();
    render(
      <RuleConsolidationModal
        {...base}
        phase="preview"
        preview={addPreview}
        onExecute={onExecute}
      />,
    );
    expect(screen.getByText('Eng (consolidated)')).toBeInTheDocument();
    // Added group highlighted with a + and resolved name.
    expect(screen.getByText('+ Sales')).toBeInTheDocument();
    // Retiring the source rule.
    expect(screen.getByText('Will retire (1)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Create/ }));
    expect(onExecute).toHaveBeenCalledTimes(1);
  });

  it('notes no access change for a merge', () => {
    render(
      <RuleConsolidationModal
        {...base}
        phase="preview"
        preview={{
          ...addPreview,
          mode: 'merge',
          addedGroupIds: [],
          addedGroupNames: [],
          retireRules: [
            { id: 'r1', name: 'A', status: 'ACTIVE' },
            { id: 'r2', name: 'B', status: 'INACTIVE' },
          ],
        }}
      />,
    );
    expect(screen.getByText(/No access change/i)).toBeInTheDocument();
    expect(screen.getByText('Will retire (2)')).toBeInTheDocument();
  });

  it('summarizes a completed consolidation', () => {
    render(
      <RuleConsolidationModal
        {...base}
        phase="done"
        result={{
          createdRuleId: 'new',
          createdRuleName: 'Eng (consolidated)',
          retired: 1,
          retireFailed: 0,
        }}
      />,
    );
    expect(screen.getByText('Created Eng (consolidated).')).toBeInTheDocument();
  });

  it('surfaces an error', () => {
    render(<RuleConsolidationModal {...base} phase="error" error="Okta rejected the rule" />);
    expect(screen.getByText('Okta rejected the rule')).toBeInTheDocument();
  });
});
