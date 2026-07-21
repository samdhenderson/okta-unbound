import type { Meta, StoryObj } from '@storybook/react-vite';
import UserProfileCard from './UserProfileCard';
import Button from '../shared/Button';
import { mockUsers } from '../../../test/mocks/handlers';
import type { OktaUser } from '../../../shared/types';

const baseUser = mockUsers[10];

const richUser: OktaUser = {
  ...baseUser,
  status: 'ACTIVE',
  created: '2023-01-15T10:00:00.000Z',
  activated: '2023-01-15T10:05:00.000Z',
  statusChanged: '2023-01-15T10:05:00.000Z',
  lastLogin: '2026-07-15T08:30:00.000Z',
  lastUpdated: '2026-06-01T12:00:00.000Z',
  passwordChanged: '2026-05-01T09:00:00.000Z',
  profile: {
    ...baseUser.profile,
    genderPronouns: 'she/her',
    secondEmail: 'personal@example.com',
    mobilePhone: '+1-555-0100',
    primaryPhone: '+1-555-0101',
    streetAddress: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    countryCode: 'US',
    division: 'Cloud Platform',
    organization: 'Acme Corp',
    manager: 'Jamie Rivera',
    costCenter: 'CC-4021',
    employeeNumber: 'E10042',
    userType: 'Employee',
    locale: 'en_US',
    timezone: 'America/Chicago',
    costume: 'none',
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
const deprovisionedUser: OktaUser = mockUsers.find((u) => u.status === 'DEPROVISIONED') ?? baseUser;

/** Presentational summary card for a single Okta user: identity header + tabbed detail sections. */
const meta = {
  title: 'Users/UserProfileCard',
  component: UserProfileCard,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    user: richUser,
  },
} satisfies Meta<typeof UserProfileCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Active user with full profile data across all collapsible sections. */
export const Default: Story = {};

/** A newly staged user with only the required profile fields — org/contact tabs self-hide. */
export const MinimalProfile: Story = {
  args: { user: minimalUser },
};

/** Suspended account status badge. */
export const Suspended: Story = {
  args: { user: suspendedUser },
};

/** Deprovisioned account status badge. */
export const Deprovisioned: Story = {
  args: { user: deprovisionedUser },
};

/** Collapsible detail sections hidden, leaving only the summary card. */
export const WithoutCollapsibleSections: Story = {
  args: { showCollapsibleSections: false },
};

/** "Open in Okta" admin console link shown when an org origin is known. */
export const WithOktaOriginLink: Story = {
  args: { oktaOrigin: 'https://example.okta.com' },
};

/** Caller-supplied content (e.g. lifecycle action controls) rendered between the card and sections. */
export const WithAfterCardSlot: Story = {
  args: {
    afterCard: (
      <div className="flex gap-2">
        <Button variant="secondary" size="sm">
          Suspend User
        </Button>
        <Button variant="danger" size="sm">
          Deactivate
        </Button>
      </div>
    ),
  },
};
