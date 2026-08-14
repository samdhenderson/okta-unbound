/*
 * The groups behind a failing `isMemberOf*` clause.
 *
 * The load-bearing property: the two polarities show DIFFERENT entries. A
 * positive clause failed because none matched, so every candidate is listed; a
 * negated clause failed because one did, so only that one is — otherwise the
 * single actionable membership is buried under nineteen the rule merely mentions.
 *
 * Fixtures use obviously fake placeholders only.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClauseGroupList from './ClauseGroupList';
import type { ClauseGroupReference } from '../../../../shared/rules/explainExpression';

const ref = (over: Partial<ClauseGroupReference> = {}): ClauseGroupReference => ({
  match: 'id',
  value: '00gFAKEGROUP000001',
  satisfied: false,
  ...over,
});

describe('a positive clause lists every candidate', () => {
  it('names all of them and marks the satisfied ones in words', () => {
    render(
      <ClauseGroupList
        requirement="member"
        contextName="Sam"
        references={[
          ref({ value: '00gFAKEA', satisfied: true, matchedGroupName: 'build.engineers' }),
          ref({ value: '00gFAKEB' }),
        ]}
      />,
    );

    expect(screen.getByText('build.engineers')).toBeInTheDocument();
    expect(screen.getByText('already in')).toBeInTheDocument();
  });

  it('offers the action only on groups the user is missing', () => {
    const action = vi.fn((_reference: ClauseGroupReference) => <button type="button">Add</button>);
    render(
      <ClauseGroupList
        requirement="member"
        references={[ref({ value: '00gFAKEA', satisfied: true }), ref({ value: '00gFAKEB' })]}
        renderGroupAction={action}
      />,
    );

    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0][0].value).toBe('00gFAKEB');
  });

  it('collapses a long candidate list behind a control that reveals the rest', async () => {
    const references = Array.from({ length: 8 }, (_, i) => ref({ value: `00gFAKE${i}` }));
    render(<ClauseGroupList requirement="member" references={references} />);

    expect(screen.getByText('00gFAKE4')).toBeInTheDocument();
    expect(screen.queryByText('00gFAKE7')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /show 3 more groups/i }));
    expect(screen.getByText('00gFAKE7')).toBeInTheDocument();
  });
});

describe('a negated clause shows only what actually blocks', () => {
  const excluded = [
    ref({ value: '00gFAKEBLOCK', satisfied: true, matchedGroupName: 'emea.contractors' }),
    ref({ value: '00gFAKEOTHER1' }),
    ref({ value: '00gFAKEOTHER2' }),
  ];

  it('names the one membership they hold and counts the rest without listing them', () => {
    render(<ClauseGroupList requirement="non-member" contextName="Sam" references={excluded} />);

    expect(screen.getByText('emea.contractors')).toBeInTheDocument();
    expect(screen.getByText('blocking')).toBeInTheDocument();
    expect(screen.queryByText('00gFAKEOTHER1')).not.toBeInTheDocument();
    expect(screen.getByText(/excludes 2 other groups Sam is not in/i)).toBeInTheDocument();
  });

  it('leads with how many of the excluded groups they are in', () => {
    render(<ClauseGroupList requirement="non-member" contextName="Sam" references={excluded} />);

    expect(
      screen.getByText(/must not be in any of 3 excluded groups\. They are in 1:/i),
    ).toBeInTheDocument();
  });

  it('offers the action on the blocking group — the opposite of the positive case', () => {
    const action = vi.fn((_reference: ClauseGroupReference) => (
      <a href="https://example.okta.com">Open group</a>
    ));
    render(
      <ClauseGroupList requirement="non-member" references={excluded} renderGroupAction={action} />,
    );

    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0][0].value).toBe('00gFAKEBLOCK');
  });
});

describe('group ids are labelled, not dumped', () => {
  it('shows the resolved name with the id beneath it', () => {
    render(
      <ClauseGroupList
        requirement="member"
        references={[ref({ value: '00gFAKENAMED01' })]}
        resolveGroupName={(id) => (id === '00gFAKENAMED01' ? 'us.employees.union' : undefined)}
      />,
    );

    expect(screen.getByText('us.employees.union')).toBeInTheDocument();
    expect(screen.getByText('00gFAKENAMED01')).toBeInTheDocument();
  });

  it('shows an unresolvable id exactly once, as itself', () => {
    render(
      <ClauseGroupList requirement="member" references={[ref({ value: '00gFAKEUNKNOWN' })]} />,
    );

    expect(screen.getAllByText('00gFAKEUNKNOWN')).toHaveLength(1);
  });

  it('reads a pattern match as a description rather than a group name', () => {
    render(
      <ClauseGroupList
        requirement="member"
        references={[ref({ match: 'nameStartsWith', value: 'sso.' })]}
      />,
    );

    expect(screen.getByText(/any group whose name starts with/i)).toBeInTheDocument();
  });
});

describe('nothing to say', () => {
  it('renders nothing at all when there are no references', () => {
    const { container } = render(<ClauseGroupList requirement="member" references={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
