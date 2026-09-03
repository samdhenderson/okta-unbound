/**
 * Pinning suite for `MemberExplorer`'s filter behaviour.
 *
 * Written **before** the filter state moved out of the component into
 * `hooks/useMemberFilters`, so the extraction has something to be verified
 * against rather than reviewed by eye. Everything here is stated in terms a
 * reader can see — which members are listed, what the count says, which chips
 * exist — never in terms of the state shape that is about to move.
 *
 * The suite deliberately reaches every facet control the same way a keyboard
 * user would: open **Filters**, then act. That is already true of the panel
 * controls, and writing the source pills the same way keeps the cases honest
 * about the disclosure they sit behind.
 *
 * Not covered here on purpose:
 * - the attribute value facets, whose route to a value differs between the
 *   composition report and the drawer that replaces it — the AND/OR grammar
 *   across attribute dimensions is pinned in `useMemberFilters.test.ts`, where
 *   it is a property of the filter set rather than of one layout;
 * - anything positional (drawer height, chip wrapping): jsdom lays out nothing
 *   and the headless Storybook runner loads no Tailwind, so such an assertion
 *   would be vacuous (ADR-0023).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemberExplorer, { type MemberSourceContext } from './MemberExplorer';
import { toMemberSourceSegments } from '../groups/memberSourceBuckets';
import { buildMemberSourceIndex } from '../../../shared/membership/memberSourceIndex';
import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';
import type { OktaUser, UserStatus } from '../../../shared/types';

// jsdom ships no IntersectionObserver; `MemberList`'s auto-paging sentinel
// constructs one on mount. Paging is `MemberList`'s own test, not this one's.
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

function member(
  n: number,
  status: UserStatus,
  department: string,
  title: string,
  firstName = 'Ada',
): OktaUser {
  return {
    id: `00uFAKE0000000000${n}`,
    status,
    profile: {
      firstName,
      lastName: `Lovelace ${n}`,
      email: `member${n}@example.com`,
      login: `member${n}@example.com`,
      department,
      title,
    },
  };
}

/*
  Six members: four ACTIVE / two SUSPENDED, crossed with two departments, so
  every combination the cases below assert on is a different number.
*/
const members: OktaUser[] = [
  member(1, 'ACTIVE', 'Engineering', 'Engineer'),
  member(2, 'ACTIVE', 'Engineering', 'Engineer'),
  member(3, 'ACTIVE', 'Support', 'Agent'),
  member(4, 'ACTIVE', 'Support', 'Agent', 'Grace'),
  member(5, 'SUSPENDED', 'Engineering', 'Engineer'),
  member(6, 'SUSPENDED', 'Support', 'Agent'),
];

const identity = { id: '00gFAKE1', name: 'Engineering', type: 'OKTA_GROUP' as const };

/*
  No feeding rules, so the classifier puts every member in `direct` / Manual.
  That is the point for the cases below: the source dimension is exercised for
  how it *composes* with the others, and a bucket holding everyone keeps the
  arithmetic of an intersection unambiguous.
*/
const breakdown: MemberSourceBreakdown = {
  total: 6,
  direct: 6,
  ruleBased: 0,
  unattributed: 0,
  byRule: [],
};

const memberSource: MemberSourceContext = {
  index: buildMemberSourceIndex(identity, members, []),
  segments: toMemberSourceSegments(breakdown),
};

const base = {
  members,
  mfaResults: null,
  scanStatus: 'idle' as const,
  onRunScan: () => {},
  onRequestConfirm: () => {},
  onCancelConfirm: () => {},
};

/** Open the filter disclosure — every facet control lives behind it. */
async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^Filters/ }));
}

/** The heading's "shown of total" readout, which is the filtered count. */
function shownOfTotal(): string {
  return screen.getByText(/^\d+ of \d+$/).textContent ?? '';
}

describe('MemberExplorer filtering', () => {
  it('lists every member and reports the full count before anything is filtered', () => {
    render(<MemberExplorer {...base} />);

    expect(screen.getByText('Ada Lovelace 1')).toBeInTheDocument();
    expect(screen.getByText('Grace Lovelace 4')).toBeInTheDocument();
    expect(shownOfTotal()).toBe('6 of 6');
  });

  it('narrows the list to the members matching the search text', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} />);

    await user.type(screen.getByRole('searchbox'), 'grace');

    await waitFor(() => expect(shownOfTotal()).toBe('1 of 6'));
    expect(screen.getByText('Grace Lovelace 4')).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace 1')).not.toBeInTheDocument();
  });

  it('says so rather than showing an empty box when nothing matches', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} />);

    await user.type(screen.getByRole('searchbox'), 'nobody-by-this-name');

    await waitFor(() => expect(shownOfTotal()).toBe('0 of 6'));
    expect(
      screen.getByText('No members match the current search and filters.'),
    ).toBeInTheDocument();
  });

  it('applies a status facet, and says which filter is applied', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} />);

    await openFilters(user);
    await user.click(screen.getByRole('button', { name: /SUSPENDED \(2\)/ }));

    expect(shownOfTotal()).toBe('2 of 6');
    expect(screen.getByText('Status: SUSPENDED')).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace 1')).not.toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace 5')).toBeInTheDocument();
  });

  it('ORs two values of the same dimension rather than intersecting them', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} />);

    await openFilters(user);
    await user.click(screen.getByRole('button', { name: /SUSPENDED \(2\)/ }));
    await user.click(screen.getByRole('button', { name: /ACTIVE \(4\)/ }));

    // Both values selected is "either", not "both" — which would be nobody.
    expect(shownOfTotal()).toBe('6 of 6');
  });

  it('ANDs across dimensions — a source pill and a status pill intersect', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} memberSource={memberSource} />);

    await openFilters(user);
    await user.click(screen.getByRole('button', { name: /Manual 6/ }));
    expect(shownOfTotal()).toBe('6 of 6');

    await user.click(screen.getByRole('button', { name: /SUSPENDED \(2\)/ }));

    expect(shownOfTotal()).toBe('2 of 6');
    expect(screen.getByText('Source: Manual')).toBeInTheDocument();
    expect(screen.getByText('Status: SUSPENDED')).toBeInTheDocument();
  });

  it('composes a filter with the search text', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} />);

    await openFilters(user);
    await user.click(screen.getByRole('button', { name: /ACTIVE \(4\)/ }));
    await user.type(screen.getByRole('searchbox'), 'grace');

    await waitFor(() => expect(shownOfTotal()).toBe('1 of 6'));
    expect(screen.getByText('Grace Lovelace 4')).toBeInTheDocument();
  });

  it('removes one filter from its chip and leaves the others applied', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} memberSource={memberSource} />);

    await openFilters(user);
    await user.click(screen.getByRole('button', { name: /Manual 6/ }));
    await user.click(screen.getByRole('button', { name: /SUSPENDED \(2\)/ }));
    expect(shownOfTotal()).toBe('2 of 6');

    await user.click(screen.getByRole('button', { name: 'Remove Status: SUSPENDED filter' }));

    expect(shownOfTotal()).toBe('6 of 6');
    expect(screen.queryByText('Status: SUSPENDED')).not.toBeInTheDocument();
    expect(screen.getByText('Source: Manual')).toBeInTheDocument();
  });

  it('toggling the same value twice removes it again', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} />);

    await openFilters(user);
    await user.click(screen.getByRole('button', { name: /SUSPENDED \(2\)/ }));
    expect(shownOfTotal()).toBe('2 of 6');

    await user.click(screen.getByRole('button', { name: /SUSPENDED \(2\)/ }));
    expect(shownOfTotal()).toBe('6 of 6');
  });

  it('clears every filter at once, across dimensions', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} memberSource={memberSource} />);

    await openFilters(user);
    await user.click(screen.getByRole('button', { name: /Manual 6/ }));
    await user.click(screen.getByRole('button', { name: /SUSPENDED \(2\)/ }));

    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(shownOfTotal()).toBe('6 of 6');
    expect(screen.queryByText('Status: SUSPENDED')).not.toBeInTheDocument();
    expect(screen.queryByText('Source: Manual')).not.toBeInTheDocument();
  });

  it('leaves the search text alone when the filters are cleared', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} />);

    await user.type(screen.getByRole('searchbox'), 'grace');
    await openFilters(user);
    await user.click(screen.getByRole('button', { name: /ACTIVE \(4\)/ }));
    await waitFor(() => expect(shownOfTotal()).toBe('1 of 6'));

    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    // The query is not a facet: clearing filters must not silently widen the
    // list back to everyone.
    await waitFor(() => expect(shownOfTotal()).toBe('1 of 6'));
    expect(screen.getByRole('searchbox')).toHaveValue('grace');
  });

  it('counts the applied filters on the Filters control', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} memberSource={memberSource} />);

    await openFilters(user);
    await user.click(screen.getByRole('button', { name: /Manual 6/ }));
    await user.click(screen.getByRole('button', { name: /SUSPENDED \(2\)/ }));

    expect(screen.getByRole('button', { name: 'Filters, 2 applied' })).toBeInTheDocument();
  });

  it('empties the copy affordance rather than offering it over nobody', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} />);

    await user.type(screen.getByRole('searchbox'), 'nobody-by-this-name');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Copy members/ })).toBeDisabled(),
    );
  });

  it('shows the source pill as pressed once it is applied', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} memberSource={memberSource} />);

    await openFilters(user);
    const manual = screen.getByRole('button', { name: /Manual 6/ });
    expect(manual).toHaveAttribute('aria-pressed', 'false');

    await user.click(manual);
    expect(screen.getByRole('button', { name: /Manual 6/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('keeps the roster reachable behind a filter that matches nobody', async () => {
    const user = userEvent.setup();
    render(<MemberExplorer {...base} />);

    await openFilters(user);
    await user.click(screen.getByRole('button', { name: /SUSPENDED \(2\)/ }));
    await user.type(screen.getByRole('searchbox'), 'grace');

    await waitFor(() => expect(shownOfTotal()).toBe('0 of 6'));

    // Clearing the one that is wrong is enough — the other survives.
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await waitFor(() => expect(shownOfTotal()).toBe('2 of 6'));
  });
});
