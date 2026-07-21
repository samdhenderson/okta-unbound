import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserProfileCard from './UserProfileCard';
import type { OktaUser } from '../../../shared/types';

/**
 * Tests for UserProfileCard's tabbed detail sections: the `afterCard` slot, the
 * self-hiding Preferences + Custom tabs (with the security-field exclusion), and
 * the searchable "All attributes" tab. The card is pure presentational, so these
 * render directly with no messaging stubs.
 */
const baseUser: OktaUser = {
  id: 'u1',
  status: 'ACTIVE',
  created: '2020-01-01T00:00:00.000Z',
  lastLogin: '2020-06-01T00:00:00.000Z',
  profile: {
    login: 'ada@example.com',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
  },
};

const withProfile = (extra: Record<string, unknown>): OktaUser => ({
  ...baseUser,
  profile: { ...baseUser.profile, ...extra },
});

describe('UserProfileCard', () => {
  it('renders the afterCard slot content', () => {
    render(<UserProfileCard user={baseUser} afterCard={<div>LIFECYCLE_SLOT</div>} />);
    expect(screen.getByText('LIFECYCLE_SLOT')).toBeInTheDocument();
  });

  it('shows the Preferences tab with locale and timezone when selected', async () => {
    const user = userEvent.setup();
    render(<UserProfileCard user={withProfile({ locale: 'en_US', timezone: 'UTC' })} />);

    await user.click(screen.getByRole('tab', { name: /Prefs/ }));

    expect(screen.getByText('en_US')).toBeInTheDocument();
    expect(screen.getByText('UTC')).toBeInTheDocument();
  });

  it('does not render the Preferences tab when neither locale nor timezone is set', () => {
    render(<UserProfileCard user={baseUser} />);
    expect(screen.queryByRole('tab', { name: /Prefs/ })).not.toBeInTheDocument();
  });

  it('lists non-standard fields under the Custom tab but excludes security-sensitive keys', async () => {
    const user = userEvent.setup();
    render(
      <UserProfileCard
        user={withProfile({ favoriteColor: 'blue', securityQuestion: 'first pet?' })}
      />,
    );

    await user.click(screen.getByRole('tab', { name: /Custom/ }));

    expect(screen.getByText('favoriteColor')).toBeInTheDocument();
    expect(screen.getByText('blue')).toBeInTheDocument();
    // Security-sensitive keys must never be surfaced.
    expect(screen.queryByText('securityQuestion')).not.toBeInTheDocument();
    expect(screen.queryByText('first pet?')).not.toBeInTheDocument();
  });

  it('lists every attribute in the All tab and filters by query, excluding security keys', async () => {
    const user = userEvent.setup();
    render(
      <UserProfileCard
        user={withProfile({ favoriteColor: 'blue', securityQuestion: 'first pet?' })}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'All' }));

    // Both standard and custom attributes appear in the flat list.
    expect(screen.getByText('favoriteColor')).toBeInTheDocument();
    expect(screen.getByText('login')).toBeInTheDocument();
    // Security-sensitive keys are excluded even from the All view.
    expect(screen.queryByText('securityQuestion')).not.toBeInTheDocument();

    // Filtering narrows the list.
    await user.type(screen.getByPlaceholderText(/Filter all attributes/), 'favorite');
    expect(screen.getByText('favoriteColor')).toBeInTheDocument();
    expect(screen.queryByText('login')).not.toBeInTheDocument();
  });

  it('hides the detail-section tabs when showCollapsibleSections is false, but keeps afterCard', () => {
    render(
      <UserProfileCard
        user={withProfile({ locale: 'en_US', favoriteColor: 'blue' })}
        showCollapsibleSections={false}
        afterCard={<div>LIFECYCLE_SLOT</div>}
      />,
    );

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText('LIFECYCLE_SLOT')).toBeInTheDocument();
  });
});
