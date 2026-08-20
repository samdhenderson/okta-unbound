import type { ComponentProps } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ComparisonAttributesTab from './ComparisonAttributesTab';
import type { AttributeParityRow, AttributeVerdict } from './attributeParity';
import {
  DEFAULT_PROFILE_DISPLAY_CONFIG,
  type ProfileDisplayConfig,
} from '../../../../shared/storage/profileDisplayStore';

/**
 * The Attributes tab's behaviour — what the stories cannot state as an assertion
 * about a *count* or a *placement*.
 *
 * The five verdicts, the compact layout and the API-name swap are covered by
 * `ComparisonAttributesTab.stories.tsx`, which runs as a browser test (ADR-0011);
 * per ADR-0023 they are not repeated here. What is here is the disclosure of
 * hidden differences — the honesty requirement — and the filtering, both of which
 * are stateful and both of which have a wrong answer that renders perfectly well.
 */

const row = (
  name: string,
  label: string,
  contextValue: string,
  comparedValue: string,
  verdict: AttributeVerdict,
  over: Partial<AttributeParityRow> = {},
): AttributeParityRow => ({
  key: `profile.${name}`,
  name,
  label,
  kind: 'base',
  contextValue,
  comparedValue,
  verdict,
  categoryKey: 'organization',
  hiddenByConfig: false,
  ...over,
});

const ROWS: AttributeParityRow[] = [
  row('department', 'Department', 'Engineering', 'Design', 'differs'),
  row('manager', 'Manager', 'dana@example.com', '', 'onlyContext'),
  row('userType', 'User type', 'Employee', 'Employee', 'same', { categoryKey: 'identity' }),
  row('nickName', 'Nickname', '', '', 'bothEmpty', { categoryKey: '' }),
];

const HIDDEN_ROWS: AttributeParityRow[] = [
  row('employeeNumber', 'Employee number', 'E-0001', 'E-0002', 'differs', {
    hiddenByConfig: true,
  }),
];

const CONFIG: ProfileDisplayConfig = {
  ...DEFAULT_PROFILE_DISPLAY_CONFIG,
  categories: [
    { key: 'identity', name: 'Identity' },
    { key: 'organization', name: 'Organization' },
  ],
};

const renderTab = (over: Partial<ComponentProps<typeof ComparisonAttributesTab>> = {}) =>
  render(
    <ComparisonAttributesTab
      contextName="Ada Context"
      comparedName="Bo Compared"
      rows={ROWS}
      hiddenRows={HIDDEN_ROWS}
      hiddenDifferences={1}
      config={CONFIG}
      ruleReads={{ department: ['Engineering → VPN Access'] }}
      {...over}
    />,
  );

describe('ComparisonAttributesTab', () => {
  it('opens on the differences, so an agreement is not listed until All is chosen', () => {
    renderTab();
    expect(screen.getByText('Department')).toBeInTheDocument();
    expect(screen.queryByText('User type')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(screen.getByText('User type')).toBeInTheDocument();
    expect(screen.getByText('Nickname')).toBeInTheDocument();
  });

  it('names both users on a one-sided row rather than leaving the gap to inference', () => {
    renderTab();
    expect(screen.getByRole('img', { name: 'Only Ada Context has a value' })).toBeInTheDocument();
  });

  it('filters on a value, not only on the attribute name', () => {
    renderTab();
    fireEvent.change(screen.getByLabelText('Filter attributes by name or value'), {
      target: { value: 'engineering' },
    });
    expect(screen.getByText('Department')).toBeInTheDocument();
    expect(screen.queryByText('Manager')).not.toBeInTheDocument();
  });

  it('says how many differing attributes the display config is hiding', () => {
    const singular = renderTab();
    expect(
      screen.getByText('1 differing attribute hidden by your display config'),
    ).toBeInTheDocument();
    singular.unmount();

    renderTab({
      hiddenRows: [...HIDDEN_ROWS, row('costCenter', 'Cost center', '', 'CC-42', 'onlyCompared')],
      hiddenDifferences: 2,
    });
    expect(
      screen.getByText('2 differing attributes hidden by your display config'),
    ).toBeInTheDocument();
  });

  it('says nothing about hidden attributes when none of them differ', () => {
    renderTab({ hiddenDifferences: 0 });
    expect(screen.queryByRole('button', { name: 'Show' })).not.toBeInTheDocument();
    expect(screen.queryByText(/hidden by your display config/)).not.toBeInTheDocument();
  });

  it('reveals a hidden row into its own category, and counts it once revealed', () => {
    renderTab();
    expect(screen.queryByText('Employee number')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Differences 2' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    const organization = screen.getByRole('list', { name: 'Organization' });
    expect(within(organization).getByText('Employee number')).toBeInTheDocument();
    // The row says it is one the config hides, so revealing never disguises it as
    // an ordinary row.
    expect(
      within(organization).getByTitle(/display configuration hides this attribute/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Differences 3' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText('Employee number')).not.toBeInTheDocument();
  });

  it('honours showRuleChips: the admin turning the chips off turns them off here too', () => {
    const withChips = renderTab();
    expect(screen.getByText('1 rule')).toBeInTheDocument();
    withChips.unmount();

    renderTab({ config: { ...CONFIG, showRuleChips: false } });
    expect(screen.queryByText('1 rule')).not.toBeInTheDocument();
  });

  it('distinguishes "nothing matches" from "nothing to compare"', () => {
    const empty = renderTab({ rows: [], hiddenRows: [], hiddenDifferences: 0 });
    expect(screen.getByText('No attributes to compare')).toBeInTheDocument();
    empty.unmount();

    renderTab();
    fireEvent.change(screen.getByLabelText('Filter attributes by name or value'), {
      target: { value: 'zzzz' },
    });
    expect(screen.getByText('No attributes match')).toBeInTheDocument();
  });
});
