import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { MemberMfaResult } from '../../../../shared/types';
import MemberExplorer from './MemberExplorer';
import { mockUsers } from '../../../../test/mocks/handlers';

const mfaResults = new Map<string, MemberMfaResult>(
  mockUsers.map((user, i) => [
    user.id,
    {
      userId: user.id,
      factors: [],
      enrolled: i % 4 !== 0,
      factorCount: i % 4 === 0 ? 0 : (i % 4) + 1,
      factorLabels: i % 4 === 0 ? [] : ['Okta Verify (Fastpass)'].concat(i % 4 >= 2 ? ['SMS'] : []),
    },
  ]),
);

/** Orchestrator for in-group member search, faceting, MFA scanning, and listing. */
const meta = {
  title: 'Overview/Members/MemberExplorer',
  component: MemberExplorer,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    members: mockUsers,
    mfaResults: null,
    scanStatus: 'idle',
    onRunScan: fn(),
    onRequestConfirm: fn(),
    onCancelConfirm: fn(),
    oktaOrigin: null,
  },
} satisfies Meta<typeof MemberExplorer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No MFA scan yet run: search, composition, and the member list are all live. */
export const Default: Story = {};

/** Confirmation gate shown before scanning a large group. */
export const ConfirmingScan: Story = {
  args: { scanStatus: 'confirming' },
};

/** MFA scan in progress. */
export const Scanning: Story = {
  args: { scanStatus: 'scanning' },
};

/** MFA scan complete: factor breakdowns and per-member factor tags render. */
export const ScanComplete: Story = {
  args: { mfaResults, scanStatus: 'complete' },
};

/** An empty group renders the explorer's empty state throughout. */
export const EmptyGroup: Story = {
  args: { members: [] },
};
