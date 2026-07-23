import type { Meta, StoryObj } from '@storybook/react-vite';
import UserIdentity from './UserIdentity';
import { mockUsers } from '../../../test/mocks/handlers';
import type { OktaUser } from '../../../shared/types';

const baseUser = mockUsers[10];

const activeUser: OktaUser = {
  ...baseUser,
  status: 'ACTIVE',
  profile: {
    ...baseUser.profile,
    title: 'Staff Engineer',
    department: 'Platform',
    genderPronouns: 'she/her',
  },
};

const minimalUser: OktaUser = {
  id: 'user-minimal',
  status: 'STAGED',
  profile: {
    login: 'newhire@example.com',
    email: 'newhire@example.com',
    firstName: 'New',
    lastName: 'Hire',
  },
};

const suspendedUser: OktaUser = mockUsers.find((u) => u.status === 'SUSPENDED') ?? baseUser;

/** Compact identity header for a single Okta user: avatar, name, status, contact line. */
const meta = {
  title: 'Users/UserIdentity',
  component: UserIdentity,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Compact identity header for a single Okta user — the slim replacement for the former tall "user ID card".\n\n' +
          'Renders avatar initials, name, a color-coded status badge, optional title/department, email, an optional copyable user id, an optional pronouns chip, and an optional "Open in Okta" deep link. Purely presentational; the copy-to-clipboard is self-contained. Shared by UserProfileCard (Users tab) and UserOverview so both render identity consistently.',
      },
    },
  },
  args: { user: activeUser },
  argTypes: {
    user: { description: 'The user whose identity to render.' },
    oktaOrigin: {
      description:
        'Okta origin used to build the "Open in Okta" admin link; the link hides when absent.',
    },
    showOktaLink: {
      description: 'Whether to render the "Open in Okta" deep link. Defaults to `true`.',
    },
    showId: {
      description:
        'Whether to show the copyable user id row. Defaults to `true`; the Overview passes `false`.',
    },
  },
} satisfies Meta<typeof UserIdentity>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Active user with title, department, and pronouns. */
export const Default: Story = {};

/** Minimal staged user — only required fields. */
export const MinimalProfile: Story = {
  args: { user: minimalUser },
};

/** Suspended account status badge. */
export const Suspended: Story = {
  args: { user: suspendedUser },
};

/** Id row hidden (e.g. when the masthead already shows the id). */
export const WithoutId: Story = {
  args: { showId: false },
};

/** "Open in Okta" deep link shown when an org origin is known. */
export const WithOktaLink: Story = {
  args: { oktaOrigin: 'https://example.okta.com' },
};
