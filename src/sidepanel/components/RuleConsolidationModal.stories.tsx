import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import RuleConsolidationModal from './RuleConsolidationModal';
import type {
  ConsolidationPreview,
  ConsolidationResult,
  RetireRuleRef,
} from '../hooks/useRuleConsolidation';

/** A search hit used by the add-target group-picker step. */
const mockGroupHits = [
  { id: 'grp1', name: 'Engineering' },
  { id: 'grp2', name: 'Engineering Managers' },
  { id: 'grp3', name: 'Engineering Contractors' },
];

/** Source rules that would be retired once the consolidated rule is live. */
const mockRetireRules: RetireRuleRef[] = [
  { id: 'rule1', name: 'Engineering - US', status: 'ACTIVE' },
  { id: 'rule2', name: 'Engineering - EU', status: 'ACTIVE' },
];

/** A dry-run preview of an add-target consolidation. */
const mockPreview: ConsolidationPreview = {
  mode: 'add-target',
  baseName: 'Engineering - US',
  resultingName: 'Engineering - US (consolidated)',
  resultingGroupIds: ['grp1', 'grp2'],
  addedGroupIds: ['grp2'],
  addedGroupNames: ['Engineering Managers'],
  retireRules: mockRetireRules,
  willActivate: true,
};

/** A dry-run preview of a merge consolidation (identical-condition rules). */
const mockMergePreview: ConsolidationPreview = {
  mode: 'merge',
  baseName: 'Engineering - US',
  resultingName: 'Engineering (consolidated)',
  resultingGroupIds: ['grp1', 'grp3'],
  addedGroupIds: ['grp3'],
  addedGroupNames: ['Engineering Contractors'],
  retireRules: mockRetireRules,
  willActivate: true,
};

/** The outcome of a completed consolidation run. */
const mockResult: ConsolidationResult = {
  createdRuleId: 'rule99',
  createdRuleName: 'Engineering - US (consolidated)',
  retired: 2,
  retireFailed: 0,
};

/**
 * Wizard for rule consolidation (add a target group, or merge identical-condition
 * rules) — search-select, dry-run diff, then confirm/execute.
 */
const meta = {
  title: 'Components/RuleConsolidationModal',
  component: RuleConsolidationModal,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    phase: 'select',
    preview: null,
    result: null,
    error: null,
    searchGroups: fn(async () => mockGroupHits),
    onChooseGroup: fn(),
    onExecute: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof RuleConsolidationModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Add-target flow: the group search-select step. */
export const Default: Story = {};

/** Loading the source rule before the wizard can proceed. */
export const Loading: Story = {
  args: { phase: 'loading' },
};

/** Dry-run diff for adding a target group to an existing rule. */
export const AddTargetPreview: Story = {
  args: { phase: 'preview', preview: mockPreview },
};

/** Dry-run diff for merging two identical-condition rules. */
export const MergePreview: Story = {
  args: { phase: 'preview', preview: mockMergePreview },
};

/** The write is in flight: creating the new rule and retiring the sources. */
export const Running: Story = {
  args: { phase: 'running' },
};

/** A successfully completed consolidation. */
export const Done: Story = {
  args: { phase: 'done', result: mockResult },
};

/** The consolidation failed and surfaced an error message. */
export const Failed: Story = {
  args: { phase: 'error', error: 'Failed to create the consolidated rule: rate limited.' },
};
