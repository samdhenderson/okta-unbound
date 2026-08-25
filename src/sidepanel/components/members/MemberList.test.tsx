/**
 * Tests for MemberList — the windowed, auto-paging member list.
 *
 * Covers the three states its container can be in (rows, reloading, empty) plus the
 * entrance wiring: rows live under a single `.rise-in-stagger` wrapper so the
 * wrapper (not a per-row index prop) drives the staggering and `MemberRow` needs no
 * index, and the paging sentinel stays outside that wrapper so its intersection is
 * never delayed.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { OktaUser } from '../../../shared/types';
import MemberList from './MemberList';

// jsdom ships no IntersectionObserver; the auto-paging sentinel constructs one on
// mount. A no-op stub is enough — the paging behaviour itself is not under test here.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

/** Minimal member fixture — obviously fake ids, per the no-real-org rule. */
function member(n: number): OktaUser {
  return {
    id: `00uFAKE00000000000${n}`,
    status: 'ACTIVE',
    profile: {
      firstName: 'Ada',
      lastName: `Lovelace ${n}`,
      email: `ada${n}@example.com`,
      login: `ada${n}@example.com`,
    },
  } as OktaUser;
}

const members = Array.from({ length: 12 }, (_, i) => member(i));

const baseProps = {
  mfaResults: null,
  mfaScanned: false,
  visibleCount: 12,
  onLoadMore: vi.fn(),
};

describe('MemberList', () => {
  it('renders the visible rows inside one rise-in-stagger wrapper', () => {
    const { container } = render(<MemberList {...baseProps} members={members} />);

    const stagger = container.querySelector('.rise-in-stagger');
    expect(stagger).not.toBeNull();
    // One wrapper for every row — the stagger cap is CSS, not a per-row prop.
    expect(stagger?.children).toHaveLength(members.length);
    expect(screen.getByText('Ada Lovelace 0')).toBeInTheDocument();
  });

  it('keeps the paging sentinel out of the stagger wrapper', () => {
    const { container } = render(<MemberList {...baseProps} members={members} visibleCount={5} />);

    const stagger = container.querySelector('.rise-in-stagger');
    expect(stagger?.children).toHaveLength(5);
    // The sentinel is the wrapper's sibling, not its last child.
    expect(stagger?.querySelector('[aria-hidden="true"].h-px')).toBeNull();
  });

  it('swaps the rows for skeleton placeholders while reloading', () => {
    render(<MemberList {...baseProps} members={members} loading />);

    expect(screen.getByRole('status', { name: 'Reloading members' })).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace 0')).not.toBeInTheDocument();
  });

  it('shows the no-match message for an empty list once loading has finished', () => {
    render(<MemberList {...baseProps} members={[]} visibleCount={12} />);

    expect(screen.getByText(/No members match/)).toBeInTheDocument();
  });

  it('does not show the no-match message while an empty list is reloading', () => {
    render(<MemberList {...baseProps} members={[]} visibleCount={12} loading />);

    expect(screen.queryByText(/No members match/)).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Reloading members' })).toBeInTheDocument();
  });
});
