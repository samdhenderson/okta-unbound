import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { MemberMfaResult } from '../../../../shared/types';
import MemberFilterPanel from './MemberFilterPanel';
import type { BreakdownRow, MemberFilter } from './memberAnalytics';

const statusRows: BreakdownRow[] = [
  { value: 'ACTIVE', label: 'ACTIVE', count: 240, pct: 96 },
  { value: 'SUSPENDED', label: 'SUSPENDED', count: 5, pct: 2 },
  { value: 'DEPROVISIONED', label: 'DEPROVISIONED', count: 5, pct: 2 },
];

const mfaResults = new Map<string, MemberMfaResult>([
  [
    'user1',
    {
      userId: 'user1',
      factors: [],
      enrolled: true,
      factorCount: 2,
      factorLabels: ['Okta Verify (Fastpass)', 'SMS'],
    },
  ],
  ['user2', { userId: 'user2', factors: [], enrolled: false, factorCount: 0, factorLabels: [] }],
]);

const activeFilters: MemberFilter[] = [
  { dimension: 'status', value: 'ACTIVE', label: 'Status: ACTIVE' },
  { dimension: 'mfa', value: 'has:SMS', label: 'Has SMS' },
];

/** Expandable panel of status, MFA-factor, and sort controls for the member list. */
const meta = {
  title: 'Overview/Members/MemberFilterPanel',
  component: MemberFilterPanel,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    filters: [],
    statusRows,
    mfaResults: null,
    factorLabels: [],
    memberCount: 250,
    scanStatus: 'idle',
    onRunScanClick: fn(),
    sortBy: 'name',
    sortDesc: false,
    onToggleStatus: fn(),
    onClearStatus: fn(),
    onToggleMfaValue: fn(),
    onSetFactorMode: fn(),
    onToggleSort: fn(),
    onRemoveFilter: fn(),
    onClearAll: fn(),
  },
} satisfies Meta<typeof MemberFilterPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No scan yet run: status/sort controls active, MFA section prompts to run a scan. */
export const Default: Story = {};

/** MFA scan complete: per-factor has/missing toggles and quick counts are active. */
export const WithMfaResults: Story = {
  args: {
    mfaResults,
    factorLabels: ['Okta Verify (Fastpass)', 'SMS'],
    scanStatus: 'complete',
  },
};

/** Several active filters shown as removable chips at the top of the panel. */
export const WithActiveFilters: Story = {
  args: {
    filters: activeFilters,
    mfaResults,
    factorLabels: ['Okta Verify (Fastpass)', 'SMS'],
    scanStatus: 'complete',
  },
};

/** Sorting by factor count, descending. */
export const SortedByFactors: Story = {
  args: {
    mfaResults,
    factorLabels: ['Okta Verify (Fastpass)', 'SMS'],
    scanStatus: 'complete',
    sortBy: 'factors',
    sortDesc: true,
  },
};

/** A scan in progress: the trigger shows its loading state. */
export const Scanning: Story = {
  args: {
    scanStatus: 'scanning',
  },
};
