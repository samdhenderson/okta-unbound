import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import CompositionReports from './CompositionReports';
import { discoverAttributeBreakdowns, NONE_VALUE, OTHER_VALUE } from './memberAnalytics';
import type { AttributeSummary, BreakdownRow, MemberFilter } from './memberAnalytics';
import type { MemberMfaResult } from '../../../../shared/types';
import { mockUsers } from '../../../../test/mocks/handlers';

// Real distribution discovered from the fixture members.
const discoveredAttributes = discoverAttributeBreakdowns(mockUsers);

// A richer, hand-built set of attributes to show a fuller grid with varied
// distributions (also pushes the count past the search-input threshold).
const manyAttributes: AttributeSummary[] = [
  ...discoveredAttributes,
  {
    key: 'manager',
    label: 'Manager',
    distinct: 12,
    populated: 900,
    total: 1000,
    fillRate: 90,
    rows: [
      { value: 'Alex Kim', label: 'Alex Kim', count: 220, pct: 22 },
      { value: 'Jordan Lee', label: 'Jordan Lee', count: 180, pct: 18 },
      { value: NONE_VALUE, label: '(none)', count: 100, pct: 10 },
      { value: OTHER_VALUE, label: 'Other (10 values)', count: 500, pct: 50 },
    ],
  },
  {
    key: 'city',
    label: 'City',
    distinct: 4,
    populated: 1000,
    total: 1000,
    fillRate: 100,
    rows: [
      { value: 'Austin', label: 'Austin', count: 400, pct: 40 },
      { value: 'Denver', label: 'Denver', count: 350, pct: 35 },
      { value: 'Remote', label: 'Remote', count: 250, pct: 25 },
    ],
  },
  {
    key: 'costCenter',
    label: 'Cost center',
    distinct: 3,
    populated: 1000,
    total: 1000,
    fillRate: 100,
    rows: [
      { value: '1000', label: '1000', count: 500, pct: 50 },
      { value: '2000', label: '2000', count: 300, pct: 30 },
      { value: '3000', label: '3000', count: 200, pct: 20 },
    ],
  },
  {
    key: 'division',
    label: 'Division',
    distinct: 2,
    populated: 1000,
    total: 1000,
    fillRate: 100,
    rows: [
      { value: 'North America', label: 'North America', count: 700, pct: 70 },
      { value: 'EMEA', label: 'EMEA', count: 300, pct: 30 },
    ],
  },
];

const activeFilters: MemberFilter[] = [
  { dimension: 'department', value: 'Engineering', label: 'Engineering' },
];

// Sample MFA factor distribution for the MFA tab.
const mfaRows: BreakdownRow[] = [
  { value: 'Okta Verify (Fastpass)', label: 'Okta Verify (Fastpass)', count: 620, pct: 62 },
  { value: 'WebAuthn', label: 'WebAuthn', count: 240, pct: 24 },
  { value: 'SMS', label: 'SMS', count: 140, pct: 14 },
];
const mfaResults = new Map<string, MemberMfaResult>([
  ['u1', { userId: 'u1', factors: [], enrolled: true, factorCount: 2, factorLabels: [] }],
]);

/** Collapsible "Composition" panel: attribute distribution + MFA factor breakdown. */
const meta = {
  title: 'Overview/Members/CompositionReports',
  component: CompositionReports,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Collapsible "Composition" panel — what a group is made of.\n\n' +
          'One section with a segmented toggle between **Attributes** (an ' +
          '{@link AttributeFacet} per discovered profile attribute) and **MFA factors** ' +
          "(the scan's factor distribution). Above a threshold of attributes it adds a " +
          '"Find attribute…" filter input. Value clicks bubble up as member-list facet ' +
          'toggles; "View all" requests the full-distribution modal. The MFA tab prompts ' +
          'to run the scan before results exist and shows the factor distribution after.\n\n' +
          '**Related internals:** [Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  argTypes: {
    attributes: { description: 'Discovered profile attributes with their value distributions.' },
    filters: { description: 'Active member-list filters, used to highlight selected values.' },
    onToggle: { description: 'Toggle a value within an attribute as a member-list filter.' },
    onExpand: { description: 'Open the full-distribution details view for an attribute.' },
    mfaRows: { description: 'Pre-computed MFA factor distribution rows (empty before a scan).' },
    mfaResults: { description: 'Per-member MFA scan results, or null before a scan has run.' },
    scanStatus: { description: 'Current MFA scan lifecycle status.' },
    memberCount: {
      description: "Member count; drives the scan button's disabled/confirm behaviour.",
    },
    onToggleMfa: { description: 'Toggle an MFA breakdown row as a member-list filter.' },
    onRunScanClick: {
      description: "Start (or confirm) the MFA scan from the MFA tab's empty state.",
    },
  },
  args: {
    attributes: discoveredAttributes,
    filters: [],
    onToggle: fn(),
    onExpand: fn(),
    mfaRows: [],
    mfaResults: null,
    scanStatus: 'idle',
    memberCount: 250,
    onToggleMfa: fn(),
    onRunScanClick: fn(),
  },
} satisfies Meta<typeof CompositionReports>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Attributes discovered from the fixture members (Attributes tab active). */
export const Default: Story = {};

/** No browseable profile attributes at all. */
export const Empty: Story = {
  args: { attributes: [] },
};

/** Enough attributes to cross the search threshold, adding a "Find attribute…" input. */
export const ManyAttributes: Story = {
  args: { attributes: manyAttributes },
};

/** A value is already active as a member-list filter, highlighting its facet. */
export const WithActiveFilter: Story = {
  args: { attributes: manyAttributes, filters: activeFilters },
};

/** MFA tab before a scan — prompts to run the scan. */
export const MfaTabNotScanned: Story = {
  args: { mfaResults: null, scanStatus: 'idle' },
};

/** MFA tab with a completed scan showing the factor distribution. */
export const MfaTabScanned: Story = {
  args: { mfaResults, scanStatus: 'complete', mfaRows },
};
