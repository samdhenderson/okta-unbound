import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserProfileCard from './UserProfileCard';
import type { OktaUser } from '../../../shared/types';

/**
 * Tests for UserProfileCard's shared-card behavior, focused on the sections added
 * when it was adopted by UsersTab: the `afterCard` slot and the Preferences +
 * Custom Attributes collapsible sections (with the security-field exclusion). The
 * card is pure presentational, so these render directly with no messaging stubs.
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

  it('shows the Preferences section with locale and timezone when expanded', async () => {
    const user = userEvent.setup();
    render(<UserProfileCard user={withProfile({ locale: 'en_US', timezone: 'UTC' })} />);

    const header = screen.getByRole('button', { name: /Preferences/ });
    await user.click(header);

    expect(screen.getByText('en_US')).toBeInTheDocument();
    expect(screen.getByText('UTC')).toBeInTheDocument();
  });

  it('does not render Preferences when neither locale nor timezone is set', () => {
    render(<UserProfileCard user={baseUser} />);
    expect(screen.queryByRole('button', { name: /Preferences/ })).not.toBeInTheDocument();
  });

  it('lists non-standard fields under Custom Attributes but excludes security-sensitive keys', async () => {
    const user = userEvent.setup();
    render(
      <UserProfileCard
        user={withProfile({ favoriteColor: 'blue', securityQuestion: 'first pet?' })}
      />,
    );

    const header = screen.getByRole('button', { name: /Custom Attributes/ });
    await user.click(header);

    expect(screen.getByText('favoriteColor')).toBeInTheDocument();
    expect(screen.getByText('blue')).toBeInTheDocument();
    // Security-sensitive keys must never be surfaced as custom attributes.
    expect(screen.queryByText('securityQuestion')).not.toBeInTheDocument();
    expect(screen.queryByText('first pet?')).not.toBeInTheDocument();
  });

  it('hides all collapsible sections when showCollapsibleSections is false, but keeps afterCard', () => {
    render(
      <UserProfileCard
        user={withProfile({ locale: 'en_US', favoriteColor: 'blue' })}
        showCollapsibleSections={false}
        afterCard={<div>LIFECYCLE_SLOT</div>}
      />,
    );

    expect(screen.queryByRole('button', { name: /Account Details/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Preferences/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Custom Attributes/ })).not.toBeInTheDocument();
    expect(screen.getByText('LIFECYCLE_SLOT')).toBeInTheDocument();
  });
});
