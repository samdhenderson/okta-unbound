import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { MemberMfaResult } from '../../../../shared/types';
import MfaScanButton from './MfaScanButton';

const mfaResults = new Map<string, MemberMfaResult>([
  ['u1', { userId: 'u1', factors: [], enrolled: true, factorCount: 2, factorLabels: [] }],
]);

/** Shared trigger button for the group MFA factor scan. */
const meta = {
  title: 'Overview/Members/MfaScanButton',
  component: MfaScanButton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    mfaResults: null,
    scanStatus: 'idle',
    memberCount: 250,
    onScanClick: fn(),
  },
} satisfies Meta<typeof MfaScanButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Before any scan — primary "Run MFA scan". */
export const NotScanned: Story = {};

/** A scan in progress — loading state. */
export const Scanning: Story = {
  args: { scanStatus: 'scanning' },
};

/** After a completed scan — secondary "Rescan". */
export const Scanned: Story = {
  args: { mfaResults, scanStatus: 'complete' },
};

/** Empty group — the button is disabled. */
export const EmptyGroup: Story = {
  args: { memberCount: 0 },
};
