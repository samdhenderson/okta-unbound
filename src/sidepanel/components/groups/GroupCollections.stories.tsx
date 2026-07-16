import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupCollections from './GroupCollections';
import type { GroupSummary } from '../../../shared/types';
import { mockGroup } from '../../../test/mocks/handlers';

const sampleGroups: GroupSummary[] = [
  {
    id: mockGroup.id,
    name: mockGroup.profile.name,
    description: mockGroup.profile.description,
    type: mockGroup.type,
    memberCount: 42,
    hasRules: false,
    ruleCount: 0,
  },
  {
    id: 'group456',
    name: 'Engineering - All',
    type: 'OKTA_GROUP',
    memberCount: 128,
    hasRules: true,
    ruleCount: 2,
  },
  {
    id: 'group789',
    name: 'App Push - Salesforce',
    type: 'APP_GROUP',
    memberCount: 17,
    hasRules: false,
    ruleCount: 0,
  },
];

/**
 * Panel for saving, loading, renaming, and deleting named collections of
 * selected group ids, persisted in `chrome.storage.local`.
 */
const meta = {
  title: 'Groups/GroupCollections',
  component: GroupCollections,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    groups: sampleGroups,
    selectedGroupIds: new Set([mockGroup.id, 'group456']),
    onLoadCollection: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof GroupCollections>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default panel with a couple of groups selected (Save enabled, no saved collections yet). */
export const Default: Story = {};

/** No groups selected — the Save button is disabled with a "select groups first" hint. */
export const EmptySelection: Story = {
  args: { selectedGroupIds: new Set() },
};

/** A large selection, exercising the "N groups will be saved" count in the create form. */
export const ManyGroupsSelected: Story = {
  args: { selectedGroupIds: new Set(sampleGroups.map((g) => g.id)) },
};
