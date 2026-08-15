import type { Meta, StoryObj } from '@storybook/react-vite';
import UserProfileCard from './UserProfileCard';
import Button from '../shared/Button';
import { mockUsers } from '../../../test/mocks/fixtures';
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

/** Presentational summary card for a single Okta user: tabbed detail sections. */
const meta = {
  title: 'Users/UserProfileCard',
  component: UserProfileCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Presentational card summarizing a single Okta user's profile.\n\n" +
          'Renders an optional `afterCard` slot (e.g. lifecycle-action controls) and tabbed detail sections (Account / Org / Contact / Prefs / Custom) plus an **All** tab — a flat, searchable list of every profile attribute. Sections with no data self-hide, so a minimal user collapses to just Account + All. Used by the Users tab.\n\n' +
          'It no longer opens with an identity card: the tab’s `PageHeader` describes the user on this rung (ADR-0032).',
      },
    },
  },
  args: {
    user: richUser,
  },
  argTypes: {
    user: { description: 'The user to render.' },
    showCollapsibleSections: {
      description: 'When true (default), renders the tabbed detail sections.',
    },
    afterCard: {
      description:
        'Optional content rendered above the detail sections (renders regardless of `showCollapsibleSections`).',
    },
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

/** Collapsible detail sections hidden, leaving only the `afterCard` slot. */
export const WithoutCollapsibleSections: Story = {
  args: { showCollapsibleSections: false },
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
