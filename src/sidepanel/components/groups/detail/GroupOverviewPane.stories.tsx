import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupOverviewPane from './GroupOverviewPane';
import type { MemberSourceBreakdown } from '../../../../shared/membership/groupSource';
import type { GroupSummary } from '../../../../shared/types';

/** A group with two feeding rules, one manual add, and a live app push. */
const groupWithPush: GroupSummary = {
  id: '00gFAKEgroup00001',
  name: 'Engineering',
  description: 'Eng team',
  type: 'OKTA_GROUP',
  memberCount: 70,
  hasRules: true,
  ruleCount: 2,
  pushMappings: [
    {
      mappingId: 'm1',
      sourceUserGroupId: '00gFAKEgroup00001',
      targetGroupName: 'Engineering (Slack)',
      priority: 1,
      appId: '0oaFAKEAPP1',
      appName: 'Slack',
    },
  ],
};

/** The same group, but never pushed anywhere — the push tile must not render. */
const groupWithoutPush: GroupSummary = { ...groupWithPush, pushMappings: undefined };

/** Two Okta-attributed rules, one shared member, one manual add. */
const analyzedBreakdown: MemberSourceBreakdown = {
  total: 70,
  direct: 1,
  ruleBased: 69,
  unattributed: 0,
  byRule: [
    { ruleId: '0prFAKE1', ruleName: 'Eng — full-time', count: 45 },
    { ruleId: '0prFAKE2', ruleName: 'Eng — contract', count: 25 },
  ],
};

/** Every member was added by hand — no feeding rule accounts for any of them. */
const allManualBreakdown: MemberSourceBreakdown = {
  total: 12,
  direct: 12,
  ruleBased: 0,
  unattributed: 0,
  byRule: [],
};

const meta = {
  title: 'Groups/GroupOverviewPane',
  component: GroupOverviewPane,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "The Group Detail view's landing pane: verdict tiles, each a derived claim, that " +
          'drill into the tab that answers it. Presentational only — every figure is a re-read ' +
          'of state `GroupDetailView` already computes; this pane issues no fetch of its own.\n\n' +
          'A tile never restates a fact `PageHeader` already owns (name, id, member count, rule ' +
          'count, timestamps — ADR-0032). A fact that has not loaded yet is **omitted**, never a ' +
          'zero: the membership-source tile renders a call-to-action until the gated analysis has ' +
          'run, the Access and Rules tiles are simply absent until their automatic reads resolve, ' +
          'and the app-push tile only exists when the group carries at least one mapping — never a ' +
          '"0 mappings" card.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
      },
    },
  },
  argTypes: {
    group: { description: 'The group being described. Only `pushMappings` is read here.' },
    breakdown: {
      description: 'The manual-vs-rule membership split, once the gated analysis has run.',
    },
    memberStatus: { description: 'Status of the gated member-source analysis.' },
    feedingRulesCount: { description: 'Number of rules that assign into this group.' },
    rulesStatus: { description: 'Status of the feeding-rules load.' },
    appsCount: { description: 'Number of apps this group is assigned to.' },
    appsStatus: { description: 'Status of the app-assignment read.' },
    rolesCount: { description: 'Number of admin roles this group grants.' },
    rolesStatus: { description: 'Whether the admin-roles read could be completed.' },
    referencingRulesCount: {
      description: 'Number of rules that reference this group in a condition expression.',
    },
    referencingStatus: { description: 'Status of the referencing-rules load.' },
    onNavigate: { description: "Switches the Group Detail view's active tab." },
  },
  args: {
    group: groupWithoutPush,
    breakdown: null,
    memberStatus: 'idle',
    feedingRulesCount: 0,
    rulesStatus: 'loading',
    appsCount: 0,
    appsStatus: 'loading',
    rolesCount: 0,
    rolesStatus: 'loading',
    referencingRulesCount: 0,
    referencingStatus: 'loading',
    onNavigate: fn(),
  },
} satisfies Meta<typeof GroupOverviewPane>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Nothing has loaded yet: the membership-source tile shows its call-to-action
 * (never a fake number), and the Access/Rules tiles are simply absent while
 * their automatic reads are still in flight.
 */
export const NotAnalyzed: Story = {};

/**
 * Every read has resolved and the group has a live push mapping: all four
 * tiles render, each a derived claim rather than a header fact restated.
 */
export const AllTilesLoaded: Story = {
  args: {
    group: groupWithPush,
    breakdown: analyzedBreakdown,
    memberStatus: 'done',
    feedingRulesCount: 2,
    rulesStatus: 'done',
    appsCount: 5,
    appsStatus: 'done',
    rolesCount: 2,
    rolesStatus: 'available',
    referencingRulesCount: 1,
    referencingStatus: 'done',
  },
};

/**
 * A confirmed "grants nothing, reaches nowhere, all-manual" group, never
 * pushed to an app. Every count here is a real, loaded zero — not the
 * omitted-until-loaded state `NotAnalyzed` shows — and the push tile is
 * absent because `pushMappings` is empty, never rendered as a "0 mappings"
 * card.
 */
export const Empty: Story = {
  args: {
    group: groupWithoutPush,
    breakdown: allManualBreakdown,
    memberStatus: 'done',
    feedingRulesCount: 0,
    rulesStatus: 'done',
    appsCount: 0,
    appsStatus: 'done',
    rolesCount: 0,
    rolesStatus: 'available',
    referencingRulesCount: 0,
    referencingStatus: 'done',
  },
};
