/**
 * @module sidepanel/components/groups/BulkOperationsPanel.stories
 * @description Storybook stories for {@link BulkOperationsPanel}.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import BulkOperationsPanel from './BulkOperationsPanel';
import { mockGroup } from '../../../test/mocks/handlers';
import type { GroupSummary, BulkOperationResult } from '../../../shared/types';

/** Build a minimal {@link GroupSummary} fixture reusing the mock group's type. */
function makeGroup(id: string, name: string, memberCount: number): GroupSummary {
  return {
    id,
    name,
    type: mockGroup.type,
    memberCount,
    hasRules: false,
    ruleCount: 0,
  };
}

const selectedGroups: GroupSummary[] = [
  makeGroup('g1', 'Engineering', 120),
  makeGroup('g2', 'Product', 45),
  makeGroup('g3', 'Sales', 30),
];

const successResults: BulkOperationResult[] = selectedGroups.map((g) => ({
  groupId: g.id,
  groupName: g.name,
  status: 'success' as const,
  itemsProcessed: g.memberCount,
}));

/** Inline panel for running clean/export/remove bulk operations over selected groups. */
const meta = {
  title: 'Groups/BulkOperationsPanel',
  component: BulkOperationsPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Inline panel for running bulk operations over the selected groups.\n\n' +
          'Presents the operation picker (clean / export / remove), runs the chosen ' +
          'operation with per-group progress, and renders a per-group success/failure ' +
          'summary. A rejected operation surfaces an error instead of the summary.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Scheduler & messaging](?path=/docs/internals-scheduler-messaging--docs), ' +
          '[Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  argTypes: {
    selectedGroups: { description: 'Groups the operation runs against (the current selection).' },
    executeBulkOperation: {
      description:
        'Runs a bulk operation, reporting per-group progress and resolving with results.',
    },
    onClose: { description: 'Dismisses the panel.' },
    onExportSelection: {
      description: 'Opens the export flow (used by the "Export All Members" operation).',
    },
  },
  args: {
    selectedGroups,
    executeBulkOperation: fn(async () => successResults),
    onClose: fn(),
    onExportSelection: fn(),
  },
} satisfies Meta<typeof BulkOperationsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: three groups selected, the operation picker shown. */
export const Default: Story = {};

/** Only a single group selected. */
export const SingleGroupSelected: Story = {
  args: { selectedGroups: [makeGroup('g1', 'Engineering', 120)] },
};

/** No groups selected — the operation picker still renders, count reads zero. */
export const NoGroupsSelected: Story = {
  args: { selectedGroups: [] },
};

/** The bulk operation call rejects outright (e.g. a network failure). */
export const ExecuteThrows: Story = {
  args: {
    executeBulkOperation: fn(async () => {
      throw new Error('Network request failed');
    }),
  },
};
