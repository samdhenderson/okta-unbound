import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupMergeModal from './GroupMergeModal';
import type { GroupSummary } from '../../../shared/types';
import type { MergePlan } from '../../../shared/membership/mergePlan';
import type { MergeResults } from '../../hooks/useGroupMerge';
import { mockUsers } from '../../../test/mocks/handlers';

const selectedGroups: GroupSummary[] = [
  {
    id: 'group1',
    name: 'Engineering - All',
    type: 'OKTA_GROUP',
    memberCount: 128,
    hasRules: false,
    ruleCount: 0,
  },
  {
    id: 'group2',
    name: 'Engineering - Backend',
    type: 'OKTA_GROUP',
    memberCount: 42,
    hasRules: true,
    ruleCount: 1,
  },
  {
    id: 'group3',
    name: 'Engineering - Frontend',
    type: 'OKTA_GROUP',
    memberCount: 31,
    hasRules: false,
    ruleCount: 0,
  },
];

const previewPlanBlocked: MergePlan = {
  survivor: { id: 'group1', name: 'Engineering - All' },
  toCopy: mockUsers.slice(0, 12),
  sources: [
    {
      id: 'group2',
      name: 'Engineering - Backend',
      membersToRemove: mockUsers.slice(0, 8),
      hasActiveFeedingRule: false,
      feedingRuleNames: [],
    },
    {
      id: 'group3',
      name: 'Engineering - Frontend',
      membersToRemove: mockUsers.slice(8, 12),
      hasActiveFeedingRule: true,
      feedingRuleNames: ['Sync frontend contractors'],
    },
  ],
  totalCopies: 12,
  totalRemovals: 12,
  blocked: true,
};

const previewPlanClear: MergePlan = {
  ...previewPlanBlocked,
  blocked: false,
  sources: previewPlanBlocked.sources.map((s) => ({
    ...s,
    hasActiveFeedingRule: false,
    feedingRuleNames: [],
  })),
};

const doneResults: MergeResults = { copied: 10, copyFailed: 2, removed: 11, removeFailed: 1 };

/**
 * Merge wizard modal: choose a survivor, preview the member delta and any
 * rule blockers on the sources, then execute the consolidation.
 */
const meta = {
  title: 'Groups/GroupMergeModal',
  component: GroupMergeModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Wizard to consolidate (merge) 2+ selected groups.\n\n' +
          'Choose a survivor → preview the member delta and "what breaks" (feeding rules / ' +
          'app push on the sources) → confirm → copy source members into the survivor and ' +
          'empty the sources. Emptying is blocked when a source is fed by an active rule. ' +
          'Every run is audited and recorded for undo; group deletion is intentionally not ' +
          'performed (the emptied husks are left for the admin to delete in Okta).\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  args: {
    isOpen: true,
    selectedGroups,
    phase: 'idle',
    plan: null,
    results: null,
    error: null,
    onPreview: fn(),
    onExecute: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof GroupMergeModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Step 1 — choose the survivor group before previewing the merge. */
export const Default: Story = {};

/** Step 1 (loading) — the preview is being built; "Preview merge" spins. */
export const PreviewLoading: Story = {
  args: { phase: 'preview-loading' },
};

/** Step 2 — preview with a source blocked by an active feeding rule. */
export const PreviewBlocked: Story = {
  args: { phase: 'preview', plan: previewPlanBlocked },
};

/** Step 2 — preview with no blockers; the merge can proceed. */
export const PreviewClear: Story = {
  args: { phase: 'preview', plan: previewPlanClear },
};

/** Step 3 — the merge is executing. */
export const Running: Story = {
  args: { phase: 'running' },
};

/** Step 4 — merge completed, including some failed operations. */
export const Done: Story = {
  args: { phase: 'done', results: doneResults },
};

/** Step 4 — the merge failed outright. */
export const ErrorState: Story = {
  args: { phase: 'error', results: doneResults, error: 'Network error while emptying group.' },
};

/** Closed — the modal renders nothing. */
export const Closed: Story = {
  args: { isOpen: false },
};
