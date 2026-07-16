import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupSourceModal from './GroupSourceModal';
import type { GroupSummary } from '../../../shared/types';
import type { FeedingRule } from '../../hooks/useGroupSource';
import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';

/** A representative group with rules, an app push, and a rule count/member count. */
const baseGroup: GroupSummary = {
  id: 'group123',
  name: 'Engineering Team',
  description: 'All engineering staff',
  type: 'OKTA_GROUP',
  memberCount: 42,
  hasRules: true,
  ruleCount: 2,
  pushMappings: [
    {
      mappingId: 'map1',
      sourceUserGroupId: 'group123',
      targetGroupName: 'Engineering Team (Push)',
      status: 'ACTIVE',
      appId: 'app1',
      appName: 'Slack',
    },
    {
      mappingId: 'map2',
      sourceUserGroupId: 'group123',
      targetGroupName: 'Engineering Team (Push)',
      status: 'ACTIVE',
      appId: 'app2',
      appName: 'GitHub',
    },
  ],
};

const feedingRules: FeedingRule[] = [
  { id: 'rule1', name: 'All Engineers', status: 'ACTIVE' },
  { id: 'rule2', name: 'Contractors — Engineering', status: 'INACTIVE' },
];

const breakdown: MemberSourceBreakdown = {
  total: 42,
  direct: 12,
  ruleBased: 30,
  byRule: [
    { ruleId: 'rule1', ruleName: 'All Engineers', count: 28 },
    { ruleId: 'rule2', ruleName: 'Contractors — Engineering', count: 2 },
  ],
};

/**
 * Read-only "why does this group exist?" detail: feeding rules, app push, and a
 * gated manual-vs-rule membership breakdown.
 */
const meta = {
  title: 'Groups/GroupSourceModal',
  component: GroupSourceModal,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    group: baseGroup,
    feedingRules,
    rulesStatus: 'done',
    breakdown: null,
    memberStatus: 'idle',
    error: null,
    onClose: fn(),
    onAnalyzeMembers: fn(),
    onNavigateToRule: fn(),
  },
} satisfies Meta<typeof GroupSourceModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Feeding rules loaded, membership breakdown not yet run. */
export const Default: Story = {};

/** No group rules feed this group — members are manual or pushed from an app. */
export const NoFeedingRules: Story = {
  args: { feedingRules: [], group: { ...baseGroup, hasRules: false, ruleCount: 0 } },
};

/** Not pushed to any application. */
export const NoAppPush: Story = {
  args: { group: { ...baseGroup, pushMappings: [] } },
};

/** Feeding rules are still loading. */
export const RulesLoading: Story = {
  args: { rulesStatus: 'loading' },
};

/** The feeding-rules load failed. */
export const RulesError: Story = {
  args: { rulesStatus: 'error', error: 'Failed to load group rules.' },
};

/** The gated member-source analysis is running. */
export const AnalyzingMembers: Story = {
  args: { memberStatus: 'loading' },
};

/** The member-source analysis failed. */
export const MembersError: Story = {
  args: { memberStatus: 'error', error: 'Failed to analyze members.' },
};

/** Analysis complete: manual-vs-rule breakdown with per-rule contributions. */
export const MembersAnalyzed: Story = {
  args: { memberStatus: 'done', breakdown },
};

/** Modal closed (group is null) — renders nothing visible. */
export const Closed: Story = {
  args: { group: null },
};
