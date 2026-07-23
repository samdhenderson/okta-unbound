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
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Expandable panel of status, MFA-factor, and sort controls for the member list.\n\n' +
          'Presentational: it reflects the active filter set into pressed pill states and ' +
          'reports every change (status toggles, per-factor has/missing modes, quick MFA ' +
          'counts, sort field/direction) via callbacks. Hosts the MFA scan trigger inline — ' +
          'scanning lives next to the factor filters it enables — and the factor controls ' +
          'stay hidden until scan results are supplied.',
      },
    },
  },
  argTypes: {
    filters: { description: 'Active facet filters, reflected into pressed pill states.' },
    statusRows: { description: 'Status distribution (value + count) used to build status pills.' },
    mfaResults: { description: 'Per-member MFA scan results, or null before a scan has run.' },
    factorLabels: {
      description: 'Observed factor labels across the group, for per-factor toggles.',
    },
    memberCount: {
      description: "Member count; drives the scan button's disabled/confirm behaviour.",
    },
    scanStatus: { description: 'Current MFA scan lifecycle status.' },
    onRunScanClick: { description: 'Start (or confirm) the MFA scan.' },
    sortBy: { description: 'Current sort field.' },
    sortDesc: { description: 'Whether the current sort is descending.' },
    onToggleStatus: { description: 'Toggle a status value as a filter.' },
    onClearStatus: { description: 'Clear all status filters.' },
    onToggleMfaValue: { description: "Toggle a count-based MFA value (e.g. 'none', 'multiple')." },
    onSetFactorMode: { description: 'Set a per-factor has/missing/off mode.' },
    onToggleSort: { description: 'Toggle the sort field (or flip direction if already selected).' },
    onRemoveFilter: { description: 'Remove a single active filter.' },
    onClearAll: { description: 'Clear every active filter.' },
  },
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
