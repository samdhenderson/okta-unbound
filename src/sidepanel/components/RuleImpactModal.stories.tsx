import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import RuleImpactModal from './RuleImpactModal';
import type { RuleImpactSummary, TargetGroupImpact } from '../../shared/membership/ruleImpact';
import { mockUsers } from '../../test/mocks/handlers';

const losingUsers = mockUsers.slice(10, 22);
const manyLosingUsers = mockUsers.slice(10, 90);

/** A target group with some members who'd lose access. */
const targetWithLoss: TargetGroupImpact = {
  groupId: 'grp1',
  groupName: 'Engineering',
  memberCount: 60,
  losingCount: losingUsers.length,
  losing: losingUsers,
};

/** A target group with a lot of members who'd lose access (exercises the "N more" overflow). */
const targetWithManyLoss: TargetGroupImpact = {
  groupId: 'grp2',
  groupName: 'Engineering Contractors',
  memberCount: 90,
  losingCount: manyLosingUsers.length,
  losing: manyLosingUsers,
};

/** A target group where every current member is also placed by another rule — no change. */
const targetNoLoss: TargetGroupImpact = {
  groupId: 'grp3',
  groupName: 'Engineering Managers',
  memberCount: 12,
  losingCount: 0,
  losing: [],
};

/** A completed impact summary spanning three target groups. */
const mockSummary: RuleImpactSummary = {
  ruleId: 'rule1',
  ruleName: 'Engineering - US',
  targetGroups: [targetWithLoss, targetNoLoss],
  distinctMemberCount: 72,
  totalLosing: losingUsers.length,
};

/** A completed impact summary with a large loss list, for the overflow variant. */
const mockLargeSummary: RuleImpactSummary = {
  ruleId: 'rule2',
  ruleName: 'Engineering - EU',
  targetGroups: [targetWithManyLoss],
  distinctMemberCount: 90,
  totalLosing: manyLosingUsers.length,
};

/** A completed impact summary for a rule with no target groups. */
const mockEmptySummary: RuleImpactSummary = {
  ruleId: 'rule3',
  ruleName: 'Orphaned rule',
  targetGroups: [],
  distinctMemberCount: 0,
  totalLosing: 0,
};

/**
 * Read-only "who loses access?" preview for a group rule, and — in `deactivate`
 * mode — the confirmation gate for deactivating it.
 */
const meta = {
  title: 'Components/RuleImpactModal',
  component: RuleImpactModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Read-only "who loses access?" preview for a group rule.\n\n' +
          "Shows a rule's target groups with live member counts and, crucially, how many members would lose access if the rule were deactivated (the members held by this rule alone). Doubles as the confirmation gate for a deactivation: in `deactivate` mode it leads with the loss headline and its footer commits the change. Computation is read-only — see `shared/membership/ruleImpact`.\n\n" +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), [Shared utilities](?path=/docs/internals-shared-utilities--docs)',
      },
    },
  },
  args: {
    isOpen: true,
    ruleName: 'Engineering - US',
    mode: 'preview',
    status: 'done',
    summary: mockSummary,
    error: null,
    progress: null,
    onClose: fn(),
    onConfirmDeactivate: fn(),
    onNavigateToGroup: fn(),
  },
} satisfies Meta<typeof RuleImpactModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Read-only preview: impact summary across target groups. */
export const Default: Story = {};

/** Deactivation-confirmation gate, leading with the loss headline. */
export const DeactivateConfirm: Story = {
  args: { mode: 'deactivate' },
};

/** Capturing member counts across target groups. */
export const Loading: Story = {
  args: {
    status: 'loading',
    summary: null,
    progress: { current: 2, total: 3, message: 'Loading Engineering Contractors…' },
  },
};

/** The impact capture failed. */
export const ErrorState: Story = {
  args: { status: 'error', summary: null, error: 'Failed to load group members.' },
};

/** A rule with no target groups — nothing would change. */
export const NoTargetGroups: Story = {
  args: { summary: mockEmptySummary },
};

/** A large loss list, exercising the per-group "and N more…" overflow. */
export const LargeLossList: Story = {
  args: { ruleName: 'Engineering - EU', summary: mockLargeSummary },
};
