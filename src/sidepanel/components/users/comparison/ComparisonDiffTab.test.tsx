import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ComparisonDiffTab, { type DiffBucketKind } from './ComparisonDiffTab';
import { groupDiffItem, type DiffItem } from './comparisonAnalytics';
import type { GroupMembership } from '../../../../shared/types';

/**
 * Phase 4.2 — `renderMeta`, the one prop the Apps tab added to this shared
 * component.
 *
 * `ComparisonDiffTab` is rendered by BOTH the Groups and the Apps tab, so the
 * suite below pins two things: that a caller can render a per-row detail *and
 * tell which bucket it is in*, and that the Groups tab — which passes no
 * `renderMeta` — produces exactly the markup it did before the prop existed.
 */

const baseProps = {
  contextName: 'Alice Context',
  comparedName: 'Bob Compared',
  emptyComparedText: 'Nothing unique to Bob Compared.',
  emptySharedText: 'Nothing in common.',
  emptyContextText: 'Nothing unique to Alice Context.',
};

const items = (...ids: string[]): DiffItem[] => ids.map((id) => ({ id, label: `Label ${id}` }));

/** The <li> row for an item, found through the `title` attr on its label span. */
const rowFor = (label: string): HTMLElement => {
  const li = screen.getByTitle(label).closest('li');
  if (!li) throw new Error(`no row for "${label}"`);
  return li;
};

describe('ComparisonDiffTab — renderMeta', () => {
  it('renders the per-row detail in every bucket, telling the caller which bucket it is', () => {
    const seen: Array<[string, DiffBucketKind]> = [];

    render(
      <ComparisonDiffTab
        {...baseProps}
        noun="app"
        comparedItems={items('a1')}
        sharedItems={items('a2')}
        contextItems={items('a3')}
        renderMeta={(item, bucket) => {
          seen.push([item.id, bucket]);
          return <span>meta:{bucket}</span>;
        }}
      />,
    );

    expect(seen).toEqual([
      ['a1', 'onlyCompared'],
      ['a2', 'shared'],
      ['a3', 'onlyContext'],
    ]);

    expect(within(rowFor('Label a1')).getByText('meta:onlyCompared')).toBeInTheDocument();
    expect(within(rowFor('Label a2')).getByText('meta:shared')).toBeInTheDocument();
    expect(within(rowFor('Label a3')).getByText('meta:onlyContext')).toBeInTheDocument();
  });

  it('keeps the row label first and separately titled, so a row still reads as its label', () => {
    render(
      <ComparisonDiffTab
        {...baseProps}
        noun="app"
        comparedItems={items('a1')}
        sharedItems={[]}
        contextItems={[]}
        renderMeta={() => <span title="a caveat">detail</span>}
      />,
    );

    const row = rowFor('Label a1');
    expect(row.querySelector('span[title]')?.textContent).toBe('Label a1');
    expect(row).toHaveTextContent('Label a1detail');
  });

  it('renders nothing extra when renderMeta returns null for a bucket', () => {
    render(
      <ComparisonDiffTab
        {...baseProps}
        noun="app"
        comparedItems={items('a1')}
        sharedItems={items('a2')}
        contextItems={[]}
        renderMeta={(_item, bucket) => (bucket === 'shared' ? null : <span>detail</span>)}
      />,
    );

    expect(within(rowFor('Label a1')).getByText('detail')).toBeInTheDocument();
    expect(within(rowFor('Label a2')).queryByText('detail')).not.toBeInTheDocument();
    expect(rowFor('Label a2').innerHTML).toBe(
      '<span class="truncate text-sm text-neutral-800" title="Label a2">Label a2</span>',
    );
  });
});

describe('ComparisonDiffTab — the groups path is untouched by renderMeta', () => {
  const membership = (id: string, name: string): GroupMembership => ({
    group: { id, type: 'OKTA_GROUP', profile: { name } },
    membershipType: 'DIRECT',
    rules: [],
    attribution: 'exact',
  });

  const groupsProps = {
    ...baseProps,
    noun: 'group',
    comparedItems: [membership('g1', 'VPN Access')].map(groupDiffItem),
    sharedItems: [membership('g2', 'All Employees')].map(groupDiffItem),
    contextItems: [membership('g3', 'Finance Approvers')].map(groupDiffItem),
  };

  it('renders a group row as the bare label span it always was', () => {
    const { container } = render(<ComparisonDiffTab {...groupsProps} />);

    for (const name of ['VPN Access', 'All Employees', 'Finance Approvers']) {
      expect(rowFor(name).innerHTML).toBe(
        `<span class="truncate text-sm text-neutral-800" title="${name}">${name}</span>`,
      );
    }

    // No stray wrapper element crept in around any label.
    expect(container.querySelectorAll('li > span')).toHaveLength(3);
  });

  it('still renders bucket headings, counts, and the per-row Add affordance', () => {
    render(
      <ComparisonDiffTab
        {...groupsProps}
        renderAction={(item) => <button type="button">Add {item.label}</button>}
        renderContextAction={(item) => <button type="button">Copy {item.label}</button>}
      />,
    );

    expect(screen.getByTitle('Only Bob Compared')).toBeInTheDocument();
    expect(screen.getByTitle('Add groups to Alice Context')).toBeInTheDocument();
    expect(screen.getByTitle('Common groups between both users')).toBeInTheDocument();
    expect(screen.getByTitle('Add groups to Bob Compared')).toBeInTheDocument();

    expect(within(rowFor('VPN Access')).getByRole('button', { name: 'Add VPN Access' }));
    expect(
      within(rowFor('Finance Approvers')).getByRole('button', { name: 'Copy Finance Approvers' }),
    );
    expect(within(rowFor('All Employees')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders empty buckets with their empty text, unchanged', () => {
    render(
      <ComparisonDiffTab
        {...baseProps}
        noun="group"
        comparedItems={[]}
        sharedItems={[]}
        contextItems={[]}
      />,
    );

    expect(screen.getByText('Nothing unique to Bob Compared.')).toBeInTheDocument();
    expect(screen.getByText('Nothing in common.')).toBeInTheDocument();
    expect(screen.getByText('Nothing unique to Alice Context.')).toBeInTheDocument();
  });
});

describe('ComparisonDiffTab — a long detail never displaces the row action', () => {
  it('stacks the detail under the label, outside the element holding the action', () => {
    render(
      <ComparisonDiffTab
        {...baseProps}
        noun="group"
        comparedItems={items('a1')}
        sharedItems={[]}
        contextItems={[]}
        renderAction={() => <button type="button">Add</button>}
        renderMeta={() => (
          <span>Likely added by rule: Contractors → VPN Access, Remote Access Baseline</span>
        )}
      />,
    );

    const row = rowFor('Label a1');
    const action = within(row).getByRole('button', { name: 'Add' });
    const detail = within(row).getByText(/Likely added by rule/);

    // The detail shares a column with the label — that column is what truncates.
    const column = detail.parentElement;
    expect(column).toContainElement(within(row).getByTitle('Label a1'));
    expect(column?.className).toContain('min-w-0');
    expect(column?.className).toContain('flex-col');

    // The action sits OUTSIDE that column and does not shrink, so no length of
    // rule name can push it out of view (the bug this pins).
    expect(column).not.toContainElement(action);
    expect(action.parentElement?.className).toContain('shrink-0');
  });
});
