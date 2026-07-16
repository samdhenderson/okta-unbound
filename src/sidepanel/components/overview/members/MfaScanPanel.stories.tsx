import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { MemberMfaResult } from '../../../../shared/types';
import MfaScanPanel from './MfaScanPanel';
import { mockUsers } from '../../../../test/mocks/handlers';

const smallGroup = mockUsers.slice(0, 50);
const largeGroup = mockUsers; // 250 members, still below the 500 auto-threshold in this fixture set

const mfaResults = new Map<string, MemberMfaResult>(
  smallGroup.map((user, i) => [
    user.id,
    {
      userId: user.id,
      factors: [],
      enrolled: i % 3 !== 0,
      factorCount: i % 3 === 0 ? 0 : (i % 3) + 1,
      factorLabels:
        i % 3 === 0 ? [] : ['Okta Verify (Fastpass)'].concat(i % 3 === 2 ? ['SMS'] : []),
    },
  ]),
);

/** Trigger + results panel for the group MFA factor scan, with a confirmation gate for large groups. */
const meta = {
  title: 'Overview/Members/MfaScanPanel',
  component: MfaScanPanel,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    members: smallGroup,
    mfaResults: null,
    scanStatus: 'idle',
    filters: [],
    onRunScan: fn(),
    onRequestConfirm: fn(),
    onCancelConfirm: fn(),
    onToggleMfaFilter: fn(),
  },
} satisfies Meta<typeof MfaScanPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Idle, no scan run yet — "Run MFA scan" button. */
export const Default: Story = {};

/** Scan in progress — button shows a spinner and is disabled. */
export const Scanning: Story = {
  args: { scanStatus: 'scanning' },
};

/** Large-group confirmation gate is open before the scan starts. */
export const Confirming: Story = {
  args: { members: largeGroup, scanStatus: 'confirming' },
};

/** Scan complete — enrolled count and the MFA factor breakdown render. */
export const Complete: Story = {
  args: { members: smallGroup, mfaResults, scanStatus: 'complete' },
};

/** Scan complete with one factor row selected as an active member-list filter. */
export const WithActiveFilter: Story = {
  args: {
    members: smallGroup,
    mfaResults,
    scanStatus: 'complete',
    filters: [{ dimension: 'mfa', value: 'has:SMS', label: 'Has SMS' }],
  },
};

/** The scan failed — inline error message shown below the trigger. */
export const WithError: Story = {
  args: { scanStatus: 'error' },
};

/** No members in the group — the trigger button is disabled. */
export const Empty: Story = {
  args: { members: [] },
};
