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
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Raw filter input for the Export tab with a debounced live match-count.\n\n' +
          "Wraps the shared `Input` with the descriptor's inline help text and a live " +
          '"N matching" readout driven by the tab hook\'s first-page probe. The readout has ' +
          'three states: `Checking…` while a probe is in flight, `No matches` (warning tone) ' +
          'for a zero-result query, and `N+ matching` when rows are found. Presentational ' +
          'only — the filter text and match-count are owned by the hook.',
      },
    },
  },
  argTypes: {
    value: { description: 'Controlled raw filter expression.' },
    onChange: { description: 'Called with the new filter text on each change.' },
    help: { description: 'Inline help text shown under the field (from the descriptor).' },
    placeholder: { description: 'Example expression shown as the input placeholder.' },
    matchCount: { description: 'Debounced first-page match-count, or `null` while unknown.' },
    matchCountLoading: { description: 'Whether a match-count probe is in flight.' },
    disabled: { description: 'Disable the input (e.g. no context entity chosen yet).' },
  },
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
export const Loading: Story = {
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
