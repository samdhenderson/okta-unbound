import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ExportFilterBox from './ExportFilterBox';

/**
 * Raw filter input with the descriptor's inline help text and a debounced live
 * match-count readout (driven by the tab hook's first-page probe).
 */
const meta = {
  title: 'Export/ExportFilterBox',
  component: ExportFilterBox,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    value: '',
    onChange: fn(),
    help: 'Optional Okta `search` expression (SCIM). Leave blank to export all users.',
    placeholder: 'status eq "ACTIVE" and profile.department eq "Sales"',
    matchCount: null,
    matchCountLoading: false,
    disabled: false,
  },
} satisfies Meta<typeof ExportFilterBox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty filter, no probe yet. */
export const Default: Story = {};

/** A match-count probe is in flight. */
export const Checking: Story = {
  args: { value: 'status eq "ACTIVE"', matchCountLoading: true },
};

/** Matches found, with more pages beyond the first. */
export const Matching: Story = {
  args: { value: 'status eq "ACTIVE"', matchCount: { count: 200, hasMore: true } },
};

/** The filter matched nothing (likely a typo). */
export const NoMatches: Story = {
  args: { value: 'status eq "TYPO"', matchCount: { count: 0, hasMore: false } },
};

/** Disabled until a context entity is chosen. */
export const Disabled: Story = {
  args: { disabled: true },
};
