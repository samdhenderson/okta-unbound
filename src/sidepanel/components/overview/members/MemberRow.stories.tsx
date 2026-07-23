import type { Meta, StoryObj } from '@storybook/react-vite';
import type { MemberMfaResult } from '../../../../shared/types';
import MemberRow from './MemberRow';
import { mockUsers } from '../../../../test/mocks/handlers';

const activeUser = mockUsers.find((u) => u.status === 'ACTIVE')!;
const suspendedUser = mockUsers.find((u) => u.status === 'SUSPENDED')!;
const deprovisionedUser = mockUsers.find((u) => u.status === 'DEPROVISIONED')!;

const enrolledMfa: MemberMfaResult = {
  userId: activeUser.id,
  factors: [],
  enrolled: true,
  factorCount: 2,
  factorLabels: ['Okta Verify (Fastpass)', 'SMS'],
};

const noFactorsMfa: MemberMfaResult = {
  userId: activeUser.id,
  factors: [],
  enrolled: false,
  factorCount: 0,
  factorLabels: [],
};

/** Single member card: name, email, login, status badge, and (once scanned) MFA factor tags. */
const meta = {
  title: 'Overview/Members/MemberRow',
  component: MemberRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Single member card: name, email, login, a status badge, and MFA factor tags.\n\n' +
          'Memoized for large lists. The status badge maps the user status to a semantic ' +
          'token set (success / warning / danger, neutral fallback). Factor tags — or a ' +
          '"No MFA" badge for 0-factor users — render only once a scan has completed. When ' +
          "an org origin is provided the whole row becomes a deep link to the member's " +
          'Okta Admin Console profile.',
      },
    },
  },
  argTypes: {
    user: { description: 'The member to render.' },
    mfa: { description: "This member's MFA scan result, if available." },
    mfaScanned: {
      description: 'True once an MFA scan has completed, so "No MFA" can show for 0-factor users.',
    },
    oktaOrigin: {
      description:
        'Okta org origin; when set, the row links to the member’s Admin Console profile.',
    },
  },
  args: {
    user: activeUser,
    mfaScanned: false,
    oktaOrigin: null,
  },
} satisfies Meta<typeof MemberRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Active member, no MFA scan run yet — status badge only. */
export const Default: Story = {};

/** Suspended member — warning-colored status badge. */
export const Suspended: Story = {
  args: { user: suspendedUser },
};

/** Deprovisioned member — danger-colored status badge. */
export const Deprovisioned: Story = {
  args: { user: deprovisionedUser },
};

/** MFA scan complete and this member has enrolled factors — factor tags render. */
export const WithMfaFactors: Story = {
  args: { mfaScanned: true, mfa: enrolledMfa },
};

/** MFA scan complete but this member has zero factors — "No MFA" badge renders. */
export const NoMfaEnrolled: Story = {
  args: { mfaScanned: true, mfa: noFactorsMfa },
};

/** With an org origin, the whole row becomes a deep link to the Admin Console profile. */
export const WithOktaOrigin: Story = {
  args: { oktaOrigin: 'https://example.okta.com', mfaScanned: true, mfa: enrolledMfa },
};
