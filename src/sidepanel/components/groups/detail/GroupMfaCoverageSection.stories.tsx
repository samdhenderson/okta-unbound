import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupMfaCoverageSection from './GroupMfaCoverageSection';
import type { OktaUser, MemberMfaResult } from '../../../../shared/types';

const members: OktaUser[] = Array.from({ length: 12 }, (_, i) => ({
  id: `user${i + 1}`,
  status: 'ACTIVE',
  profile: {
    login: `user${i + 1}@example.com`,
    email: `user${i + 1}@example.com`,
    firstName: `First${i + 1}`,
    lastName: `Last${i + 1}`,
  },
}));

const mfaResults = new Map<string, MemberMfaResult>(
  members.map((m, i) => [
    m.id,
    {
      userId: m.id,
      factors: [],
      enrolled: i % 4 !== 0,
      factorCount: i % 4 === 0 ? 0 : 1,
      factorLabels: i % 4 === 0 ? [] : ['Okta Verify'],
    },
  ]),
);

const meta = {
  title: 'Groups/GroupMfaCoverageSection',
  component: GroupMfaCoverageSection,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "The gated, opt-in MFA-coverage trigger for GroupHealthPane's Health tab. Never " +
          'auto-runs — `MfaScanButton` starts (or confirms) the scan, and above ' +
          '`MFA_AUTO_THRESHOLD` (500) members a `Modal` confirmation gate stands between the ' +
          'trigger and the scan, since it costs one API call per member. Once complete, the one ' +
          '"no factors enrolled" coverage line replaces the pre-scan prompt.',
      },
    },
  },
  argTypes: {
    members: { description: 'The group roster — the scan reads exactly these members.' },
    mfaResults: { description: 'Per-member MFA scan results, or `null` before a scan has run.' },
    scanStatus: { description: 'Current MFA scan lifecycle status.' },
  },
  args: {
    members,
    mfaResults: null,
    scanStatus: 'idle',
    onRunScan: fn(),
    onRequestConfirm: fn(),
    onCancelConfirm: fn(),
  },
} satisfies Meta<typeof GroupMfaCoverageSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Before any scan — primary "Run MFA scan" trigger. */
export const Idle: Story = {};

/** A large-group scan gated behind confirmation. */
export const Confirming: Story = { args: { scanStatus: 'confirming' } };

/** A scan in progress. */
export const Scanning: Story = { args: { scanStatus: 'scanning' } };

/** Scan complete — the coverage summary plus a "Rescan" trigger. */
export const Complete: Story = { args: { scanStatus: 'complete', mfaResults } };

/** The scan failed — an alert plus a retry via the same trigger. */
export const ErrorState: Story = { args: { scanStatus: 'error' } };
