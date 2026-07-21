import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tabs, { type TabItem } from './Tabs';

const TABS: TabItem[] = [
  { key: 'account', label: 'Account' },
  { key: 'org', label: 'Org' },
  { key: 'custom', label: 'Custom', count: 7 },
];

describe('Tabs', () => {
  it('renders a tablist and marks the active tab with aria-selected', () => {
    render(<Tabs tabs={TABS} activeKey="org" onChange={vi.fn()} ariaLabel="Sections" />);
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Org' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Account/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('gives only the active tab a tabIndex of 0 (roving tabindex)', () => {
    render(<Tabs tabs={TABS} activeKey="account" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Org' })).toHaveAttribute('tabindex', '-1');
  });

  it('fires onChange with the tab key when clicked', async () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} activeKey="account" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Org' }));
    expect(onChange).toHaveBeenCalledWith('org');
  });

  it('renders the count badge when provided', () => {
    render(<Tabs tabs={TABS} activeKey="account" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /Custom/ })).toHaveTextContent('7');
  });

  it('moves selection with arrow keys and wraps at the ends', async () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} activeKey="account" onChange={onChange} />);
    const account = screen.getByRole('tab', { name: 'Account' });
    account.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('org');
    // From the first tab, ArrowLeft wraps to the last.
    account.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('custom');
  });

  it('supports the segmented variant', () => {
    render(<Tabs tabs={TABS} activeKey="account" onChange={vi.fn()} variant="segmented" />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});
