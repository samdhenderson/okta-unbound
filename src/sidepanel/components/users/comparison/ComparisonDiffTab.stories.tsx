import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ComparisonDiffTab from './ComparisonDiffTab';
import type { DiffItem } from './comparisonAnalytics';

const comparedItems: DiffItem[] = [
  { id: 'g1', label: 'Engineering - Platform' },
  { id: 'g2', label: 'VPN Access' },
  { id: 'g3', label: 'On-call Rotation' },
];

const sharedItems: DiffItem[] = [
  { id: 'g4', label: 'All Employees' },
  { id: 'g5', label: 'Slack Workspace' },
];

const contextItems: DiffItem[] = [{ id: 'g6', label: 'Finance Approvers' }];

/** Three tone-coded diff buckets (only-compared / shared / only-context) for groups or apps. */
const meta = {
  title: 'Users/Comparison/ComparisonDiffTab',
  component: ComparisonDiffTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Three tone-coded diff buckets (only-compared / shared / only-context) for groups or apps.\n\n' +
          'Reused for both the Groups and Apps detail tabs via the `noun` and empty-text props. Optional `renderAction` / `renderContextAction` render-props add per-row "Add" controls to the compared-only and context-only buckets (groups only), enabling one-way or bidirectional copy. Each bucket scrolls within a fixed-height list and shows its empty-state text when the bucket is empty.',
      },
    },
  },
  args: {
    contextName: 'Jane Doe',
    comparedName: 'John Smith',
    comparedItems,
    sharedItems,
    contextItems,
    emptyComparedText: 'No groups unique to John Smith.',
    emptySharedText: 'No shared groups.',
    emptyContextText: 'No groups unique to Jane Doe.',
    noun: 'group',
  },
  argTypes: {
    contextName: { description: 'Display name of the context user (baseline).' },
    comparedName: { description: 'Display name of the compared user.' },
    comparedItems: { description: 'Items unique to the compared user (the "add" bucket).' },
    sharedItems: { description: 'Items both users share.' },
    contextItems: { description: 'Items unique to the context user.' },
    emptyComparedText: { description: 'Empty-state text for the only-compared bucket.' },
    emptySharedText: { description: 'Empty-state text for the shared bucket.' },
    emptyContextText: { description: 'Empty-state text for the only-context bucket.' },
    noun: { description: 'Singular noun for the items ("group" or "app"), used in subtitles.' },
    renderAction: {
      description:
        'Optional per-row action for the only-compared bucket (Add to context user); groups only.',
    },
    renderContextAction: {
      description:
        'Optional per-row action for the only-context bucket (Add to compared user); groups only.',
    },
  },
} satisfies Meta<typeof ComparisonDiffTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default three-bucket diff with a mix of items in each bucket. */
export const Default: Story = {};

/** Groups tab variant with a per-row "Add" action rendered in the compared-only bucket. */
export const WithRowAction: Story = {
  args: {
    renderAction: (item) => (
      <button
        type="button"
        onClick={fn()}
        className="text-xs font-semibold text-primary-text hover:text-primary-dark"
      >
        Add {item.label}
      </button>
    ),
  },
};

/**
 * Bidirectional groups variant: Add actions in BOTH the compared-only bucket
 * (copy onto the context user) and the context-only bucket (copy onto the
 * compared user). Their subtitles flip to read "Add groups to <the other user>".
 */
export const WithBidirectionalActions: Story = {
  args: {
    renderAction: (item) => (
      <button
        type="button"
        onClick={fn()}
        className="text-xs font-semibold text-primary-text hover:text-primary-dark"
      >
        Add {item.label} to Jane Doe
      </button>
    ),
    renderContextAction: (item) => (
      <button
        type="button"
        onClick={fn()}
        className="text-xs font-semibold text-primary-text hover:text-primary-dark"
      >
        Add {item.label} to John Smith
      </button>
    ),
  },
};

/** All three buckets empty (identical or brand-new users). */
export const Empty: Story = {
  args: {
    comparedItems: [],
    sharedItems: [],
    contextItems: [],
  },
};

/** Apps tab: no row action, different noun and copy. */
export const AppsVariant: Story = {
  args: {
    noun: 'app',
    emptyComparedText: 'No apps unique to John Smith.',
    emptySharedText: 'No shared apps.',
    emptyContextText: 'No apps unique to Jane Doe.',
  },
};

/** A bucket with many items scrolls within its fixed-height list. */
export const LongLists: Story = {
  args: {
    comparedItems: Array.from({ length: 20 }, (_, i) => ({
      id: `long-${i}`,
      label: `Group with a fairly long descriptive name #${i + 1}`,
    })),
  },
};
