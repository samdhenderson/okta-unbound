import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupRulesSection from './GroupRulesSection';

const ASSIGNS = 'Assigns members into this group';
const REFERENCES = 'References this group in a condition';

const base = {
  assigningRules: [{ id: 'r1', name: 'All Engineers', status: 'ACTIVE' }],
  assigningStatus: 'done' as const,
  assigningError: null,
  referencingRules: [{ id: 'r2', name: 'Contractors gate', status: 'INACTIVE' }],
  referencingStatus: 'done' as const,
  referencingError: null,
};

/** The list under a given sub-heading, so the two axes can be asserted apart. */
function listUnder(heading: string) {
  const block = screen.getByText(new RegExp(`^${heading}`)).parentElement as HTMLElement;
  return within(block);
}

describe('GroupRulesSection', () => {
  it('lists the two rule relationships separately rather than summing them', async () => {
    render(<GroupRulesSection {...base} />);

    expect(listUnder(ASSIGNS).getByText('All Engineers')).toBeInTheDocument();
    expect(listUnder(ASSIGNS).queryByText('Contractors gate')).not.toBeInTheDocument();

    expect(listUnder(REFERENCES).getByText('Contractors gate')).toBeInTheDocument();
    expect(listUnder(REFERENCES).queryByText('All Engineers')).not.toBeInTheDocument();
  });

  it('counts each list independently in its heading', () => {
    render(
      <GroupRulesSection
        {...base}
        assigningRules={[
          { id: 'r1', name: 'A', status: 'ACTIVE' },
          { id: 'r3', name: 'B', status: 'ACTIVE' },
        ]}
      />,
    );

    expect(screen.getByText(`${ASSIGNS} (2)`)).toBeInTheDocument();
    expect(screen.getByText(`${REFERENCES} (1)`)).toBeInTheDocument();
  });

  it('shows a distinct empty message per axis', () => {
    render(<GroupRulesSection {...base} assigningRules={[]} referencingRules={[]} />);

    expect(screen.getByText(/No rule assigns users to this group/)).toBeInTheDocument();
    expect(screen.getByText(/No rule condition references this group by id/)).toBeInTheDocument();
  });

  it('does not overclaim: says name-based references are not detected', () => {
    render(<GroupRulesSection {...base} />);
    expect(screen.getByText(/matching on group name is not listed/)).toBeInTheDocument();
  });

  it('renders a spinner while an axis is still loading', () => {
    render(<GroupRulesSection {...base} referencingStatus="loading" referencingRules={[]} />);
    expect(screen.getAllByText('Loading rules…').length).toBe(1);
    expect(screen.getByText('All Engineers')).toBeInTheDocument();
  });

  it('renders a danger alert for the failing axis only', () => {
    render(
      <GroupRulesSection
        {...base}
        referencingStatus="error"
        referencingError="Rules listing unavailable"
        referencingRules={[]}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Rules listing unavailable');
    expect(screen.getByText('All Engineers')).toBeInTheDocument();
  });

  it('deep-links a rule by name when a navigation handler is supplied', async () => {
    const onNavigateToRule = vi.fn();
    render(<GroupRulesSection {...base} onNavigateToRule={onNavigateToRule} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Open rule Contractors gate in the Rules tab' }),
    );
    expect(onNavigateToRule).toHaveBeenCalledWith('r2');
  });

  it('renders inert rows when no navigation handler is supplied', () => {
    render(<GroupRulesSection {...base} />);
    expect(screen.queryByRole('button', { name: /Open rule/ })).not.toBeInTheDocument();
    expect(screen.getByText('All Engineers')).toBeInTheDocument();
  });

  it("shows each rule's Okta status verbatim", () => {
    render(<GroupRulesSection {...base} />);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('INACTIVE')).toBeInTheDocument();
  });
});
