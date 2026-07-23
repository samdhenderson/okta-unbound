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
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Shared trigger button for the group MFA factor scan.\n\n' +
          'Renders the scan/rescan button with the right label, loading, and disabled ' +
          'state for the current scan status: `Run MFA scan` before a scan, a loading ' +
          '`Scanning…` while one runs, `Rescan` once results exist, and disabled for an ' +
          'empty group. Used by both the filter panel and the Composition MFA tab so the ' +
          'two entry points stay consistent; the large-group confirmation gate is owned ' +
          'by the caller via `onScanClick`.',
      },
    },
  },
  argTypes: {
    mfaResults: { description: 'Per-member MFA scan results, or null before a scan has run.' },
    scanStatus: { description: 'Current MFA scan lifecycle status.' },
    memberCount: { description: 'Member count; scanning is disabled for an empty group.' },
    onScanClick: {
      description: 'Start (or confirm) the scan — the caller decides whether to gate large groups.',
    },
    size: { description: 'Button size; defaults to `sm`.' },
  },
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
export const Disabled: Story = {
  args: { memberCount: 0 },
};
