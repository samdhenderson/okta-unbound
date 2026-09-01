import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupMembersSection from './GroupMembersSection';
import type { OktaUser } from '../../../../shared/types';
import type { MemberSourceBreakdown } from '../../../../shared/membership/groupSource';
import { buildMemberSourceIndex } from '../../../../shared/membership/memberSourceIndex';

const makeUser = (id: string, firstName: string, lastName: string): OktaUser => ({
  id,
  status: 'ACTIVE',
  profile: {
    login: `${firstName.toLowerCase()}@example.com`,
    email: `${firstName.toLowerCase()}@example.com`,
    firstName,
    lastName,
  },
});

const members: OktaUser[] = [
  makeUser('00uFAKE1', 'Ada', 'Lovelace'),
  makeUser('00uFAKE2', 'Grace', 'Hopper'),
];

/*
  Attribution fixtures. `GroupMembershipSourceSection` used to own these
  assertions from its own card; it is deleted and its readout is the strip inside
  this section's roster, so the cases move here with it (ADR-0022: the unit was
  replaced and the suite is retargeted assertion by assertion).

  The index is built by the real classifier, so the strip's pills and the
  breakdown's numbers can only agree if the production path agrees with itself.
*/
const identity = { id: '00gFAKE1', name: 'Engineering', type: 'OKTA_GROUP' as const };

const breakdown: MemberSourceBreakdown = {
  total: 4,
  direct: 1,
  ruleBased: 3,
  unattributed: 0,
  byRule: [{ ruleId: 'r1', ruleName: 'All Engineers', count: 3 }],
};

const sourceIndex = buildMemberSourceIndex(identity, members, []);

const base = {
  groupType: 'OKTA_GROUP' as const,
  memberCount: 2,
  members: null as OktaUser[] | null,
  status: 'idle' as const,
  error: null,
  onAnalyze: () => {},
  // No breakdown/index: the source meter and its filter pills are absent, which
  // is the honest rendering for a roster nothing has classified. The cases below
  // are about the gate, the roster and the remove confirm, none of which depend
  // on attribution.
  breakdown: null,
  memberSourceIndex: null,
  mfaResults: null,
  scanStatus: 'idle' as const,
  onRunScan: () => {},
  onRequestConfirm: () => {},
  onCancelConfirm: () => {},
  removeTarget: null as OktaUser | null,
  onRequestRemove: () => {},
  onCancelRemove: () => {},
  onConfirmRemove: () => {},
  removeStatus: 'idle' as const,
  removeError: null,
};

// The roster is `MemberExplorer`, whose list constructs an IntersectionObserver
// for auto-paging on mount; jsdom ships none. A no-op stub is enough — paging
// behaviour is `MemberList`'s own test, not this one's.
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

describe('GroupMembersSection', () => {
  it('gates behind a load prompt before the analysis has run, not an empty list', () => {
    render(<GroupMembersSection {...base} />);

    expect(screen.getByText(/Not loaded yet/)).toBeInTheDocument();
    expect(screen.queryByText('No members')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load members' })).toBeInTheDocument();
  });

  it('runs the shared analysis on the gate button click', async () => {
    const onAnalyze = vi.fn();
    render(<GroupMembersSection {...base} onAnalyze={onAnalyze} />);

    await userEvent.click(screen.getByRole('button', { name: 'Load members' }));
    expect(onAnalyze).toHaveBeenCalledTimes(1);
  });

  it('offers no gate for an empty group', () => {
    render(<GroupMembersSection {...base} memberCount={0} />);
    expect(screen.queryByRole('button', { name: 'Load members' })).not.toBeInTheDocument();
    expect(screen.getByText('This group has no members.')).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    render(<GroupMembersSection {...base} status="loading" />);
    expect(screen.getByText('Loading members…')).toBeInTheDocument();
  });

  it('shows a dismissible-style danger alert with retry on failure', async () => {
    const onAnalyze = vi.fn();
    render(
      <GroupMembersSection
        {...base}
        status="error"
        error="Members could not be read"
        onAnalyze={onAnalyze}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Members could not be read');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onAnalyze).toHaveBeenCalledTimes(1);
  });

  it('lists every member once loaded, with a remove control per row', () => {
    render(<GroupMembersSection {...base} status="done" members={members} />);

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove Ada Lovelace from this group' }),
    ).toBeInTheDocument();
  });

  describe('read-only for group types Okta rejects membership writes on', () => {
    it('hides the remove control for APP_GROUP, with a one-line reason', () => {
      render(
        <GroupMembersSection {...base} groupType="APP_GROUP" status="done" members={members} />,
      );

      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Remove Ada Lovelace from this group' }),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/imported from the app that owns this group/)).toBeInTheDocument();
    });

    it('hides the remove control for BUILT_IN, with a one-line reason', () => {
      render(
        <GroupMembersSection {...base} groupType="BUILT_IN" status="done" members={members} />,
      );

      expect(
        screen.queryByRole('button', { name: 'Remove Ada Lovelace from this group' }),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/managed by Okta, not here/)).toBeInTheDocument();
    });

    it('still shows the roster for a read-only group type', () => {
      render(
        <GroupMembersSection {...base} groupType="BUILT_IN" status="done" members={members} />,
      );
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
      expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    });

    it('never emits a claim about a feeding rule re-adding a removed member', () => {
      render(<GroupMembersSection {...base} status="done" members={members} />);
      expect(screen.queryByText(/rule.*re-add/i)).not.toBeInTheDocument();
    });
  });

  describe('remove confirm gate', () => {
    it('opens the confirm modal for the targeted member and names them', () => {
      render(
        <GroupMembersSection {...base} status="done" members={members} removeTarget={members[0]} />,
      );

      const dialog = screen.getByRole('dialog', { name: 'Remove member' });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveTextContent('Ada Lovelace');
    });

    it('does not remove on request alone — only Cancel/Remove in the modal act', async () => {
      const onRequestRemove = vi.fn();
      const onConfirmRemove = vi.fn();
      render(
        <GroupMembersSection
          {...base}
          status="done"
          members={members}
          onRequestRemove={onRequestRemove}
          onConfirmRemove={onConfirmRemove}
        />,
      );

      await userEvent.click(
        screen.getByRole('button', { name: 'Remove Ada Lovelace from this group' }),
      );
      expect(onRequestRemove).toHaveBeenCalledWith(members[0]);
      // Requesting is not confirming — the mutation must wait for the modal.
      expect(onConfirmRemove).not.toHaveBeenCalled();
    });

    it('cancel dismisses without removing', async () => {
      const onCancelRemove = vi.fn();
      const onConfirmRemove = vi.fn();
      render(
        <GroupMembersSection
          {...base}
          status="done"
          members={members}
          removeTarget={members[0]}
          onCancelRemove={onCancelRemove}
          onConfirmRemove={onConfirmRemove}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancelRemove).toHaveBeenCalledTimes(1);
      expect(onConfirmRemove).not.toHaveBeenCalled();
    });

    it('confirming inside the modal calls onConfirmRemove', async () => {
      const onConfirmRemove = vi.fn();
      render(
        <GroupMembersSection
          {...base}
          status="done"
          members={members}
          removeTarget={members[0]}
          onConfirmRemove={onConfirmRemove}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
      expect(onConfirmRemove).toHaveBeenCalledTimes(1);
    });

    it('surfaces a remove failure inside the modal', () => {
      render(
        <GroupMembersSection
          {...base}
          status="done"
          members={members}
          removeTarget={members[0]}
          removeError="Failed to remove member."
        />,
      );

      expect(screen.getByRole('dialog')).toHaveTextContent('Failed to remove member.');
    });
  });

  /*
    Supersedes 'truncates very large rosters and points at Export members for the
    full list'. That case pinned `DISPLAY_CAP = 200` — a hard slice that hid
    members 201 and up behind a sentence sending the reader to a CSV. The cap is
    deleted, not relaxed: the explorer's list mounts a page at a time and grows on
    scroll, so a 205-member roster is fully reachable in place. What is worth
    pinning is that the roster no longer *stops*, so this asserts the count the
    footer reports rather than the number of rows currently mounted.
  */
  it('does not cap a large roster — every member stays reachable', () => {
    const many = Array.from({ length: 205 }, (_, i) => makeUser(`00uFAKE${i}`, 'User', `${i}`));
    render(<GroupMembersSection {...base} status="done" members={many} memberCount={205} />);

    expect(screen.queryByText(/Showing the first 200/)).not.toBeInTheDocument();
    // Two places now say it, and both are the point: the heading's count renders
    // `205 of 205` from first paint rather than growing into that form when a
    // filter applies (D-053f), and the list footer still reports how far the
    // roster has been mounted.
    expect(screen.getAllByText(/of 205$/)).not.toHaveLength(0);
    expect(screen.getByText(/Showing \d+ of 205$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Load more/ })).toBeInTheDocument();
  });
});

/*
  Retargeted from `GroupMembershipSourceSection.test.tsx`, deleted in the same
  commit. Its six gate/spinner/error cases were copies of the six above — the
  duplication existed only because two cards shared one analysis, and merging is
  legitimate precisely because the subjects merged. Only the one assertion that
  had no counterpart here ("disables the gate when no Okta tab is connected") is
  carried over as a new case.

  Everything that suite said about the *readout* is asserted here against the
  strip that replaced it, plus `MemberSourceNotes.stories.tsx` for the two notes
  and `MemberSourceFilterBar.stories.tsx` for the segment/percent rendering.
  `MemberSourceMeter.test.tsx` is untouched and still covers the meter itself,
  which survives on the groups-list row expansion.
*/
describe('membership source, folded into the roster', () => {
  it('disables the gate when no Okta tab is connected', () => {
    render(<GroupMembersSection {...base} canAnalyze={false} />);
    expect(screen.getByRole('button', { name: 'Load members' })).toBeDisabled();
  });

  it('states the one read covers both listing and classifying', () => {
    render(<GroupMembersSection {...base} />);
    expect(screen.getByText(/classifies each against the rules/)).toBeInTheDocument();
    expect(screen.getByText(/one read for both/)).toBeInTheDocument();
  });

  it('renders the source split as readable text with its share, not just a bar', () => {
    render(
      <GroupMembersSection
        {...base}
        status="done"
        members={members}
        breakdown={breakdown}
        memberSourceIndex={sourceIndex}
      />,
    );

    // The same four numbers the deleted meter card printed as a legend, now on
    // pills that also filter: label, count, share.
    expect(screen.getByRole('button', { name: /Rule-managed 3 \(75%\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manual 1 \(25%\)/ })).toBeInTheDocument();
  });

  it('offers no source strip before the analysis has classified anyone', () => {
    render(<GroupMembersSection {...base} status="done" members={members} />);

    // Absent is not "everyone is manual": with no breakdown the strip is omitted
    // entirely rather than labelling an unclassified roster.
    expect(screen.queryByRole('button', { name: /Manual/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rule-managed/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Attributed to')).not.toBeInTheDocument();
  });

  it('explains the indeterminate slice as unevaluated, not as a failed match', () => {
    render(
      <GroupMembersSection
        {...base}
        status="done"
        members={members}
        breakdown={{ ...breakdown, unattributed: 1, total: 5 }}
        memberSourceIndex={sourceIndex}
      />,
    );

    expect(
      screen.getByText(/limit of the client-side evaluator, not a failed match/),
    ).toBeInTheDocument();
  });

  it('omits the indeterminate explanation when every member was classified', () => {
    render(
      <GroupMembersSection
        {...base}
        status="done"
        members={members}
        breakdown={breakdown}
        memberSourceIndex={sourceIndex}
      />,
    );

    expect(screen.queryByText(/limit of the client-side evaluator/)).not.toBeInTheDocument();
  });

  it('lists each rule contribution and deep-links it', async () => {
    const onNavigateToRule = vi.fn();
    render(
      <GroupMembersSection
        {...base}
        status="done"
        members={members}
        breakdown={breakdown}
        memberSourceIndex={sourceIndex}
        onNavigateToRule={onNavigateToRule}
      />,
    );

    expect(screen.getByText('3 members')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Open rule All Engineers in the Rules tab' }),
    );
    expect(onNavigateToRule).toHaveBeenCalledWith('r1');
  });

  it('says so when no member could be attributed to a rule', () => {
    render(
      <GroupMembersSection
        {...base}
        status="done"
        members={members}
        breakdown={{ total: 4, direct: 4, ruleBased: 0, unattributed: 0, byRule: [] }}
        memberSourceIndex={sourceIndex}
      />,
    );

    expect(screen.getByText('No member was attributed to a specific rule.')).toBeInTheDocument();
  });
});
