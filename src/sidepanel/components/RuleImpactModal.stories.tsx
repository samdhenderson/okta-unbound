import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import RuleImpactModal from './RuleImpactModal';
import type { RuleImpactSummary, TargetGroupImpact } from '../../shared/membership/ruleImpact';
import { mockUsers } from '../../test/mocks/fixtures';

const soleHeldUsers = mockUsers.slice(10, 22);
const manySoleHeldUsers = mockUsers.slice(10, 90);

/** A target group with some members held by this rule alone. */
const targetWithSoleHolds: TargetGroupImpact = {
  groupId: 'grp1',
  groupName: 'Engineering',
  memberCount: 60,
  heldSolelyCount: soleHeldUsers.length,
  heldSolelyByRule: soleHeldUsers,
};

/** A target group holding a lot of members on this rule alone (exercises the "N more" overflow). */
const targetWithManySoleHolds: TargetGroupImpact = {
  groupId: 'grp2',
  groupName: 'Engineering Contractors',
  memberCount: 90,
  heldSolelyCount: manySoleHeldUsers.length,
  heldSolelyByRule: manySoleHeldUsers,
};

/** A target group where every current member is also placed by another rule — no change. */
const targetNoSoleHolds: TargetGroupImpact = {
  groupId: 'grp3',
  groupName: 'Engineering Managers',
  memberCount: 12,
  heldSolelyCount: 0,
  heldSolelyByRule: [],
};

/** A completed impact summary spanning three target groups. */
const mockSummary: RuleImpactSummary = {
  ruleId: 'rule1',
  ruleName: 'Engineering - US',
  targetGroups: [targetWithSoleHolds, targetNoSoleHolds],
  distinctMemberCount: 72,
  totalHeldSolely: soleHeldUsers.length,
};

/** A completed impact summary with a large solely-held list, for the overflow variant. */
const mockLargeSummary: RuleImpactSummary = {
  ruleId: 'rule2',
  ruleName: 'Engineering - EU',
  targetGroups: [targetWithManySoleHolds],
  distinctMemberCount: 90,
  totalHeldSolely: manySoleHeldUsers.length,
};

/** A completed impact summary for a rule with no target groups. */
const mockEmptySummary: RuleImpactSummary = {
  ruleId: 'rule3',
  ruleName: 'Orphaned rule',
  targetGroups: [],
  distinctMemberCount: 0,
  totalHeldSolely: 0,
};

/**
 * D-047: `totalHeldSolely === 0` alone cannot tell "nothing to check this rule
 * against" apart from "checked, and nothing collides" — both `Default`-shape
 * summaries below share that count but must render distinct copy.
 */
const targetNoOverlap: TargetGroupImpact = {
  groupId: 'grp4',
  groupName: 'Engineering',
  memberCount: 12,
  heldSolelyCount: 0,
  heldSolelyByRule: [],
};

/** The org holds no other group rules — there was nothing to compare against. */
const mockNoRuleInventorySummary: RuleImpactSummary = {
  ruleId: 'rule4',
  ruleName: 'Only Rule',
  targetGroups: [targetNoOverlap],
  distinctMemberCount: 12,
  totalHeldSolely: 0,
  emptyRuleInventory: true,
};

/** The org's other rules were checked and none of them collide with this one. */
const mockEvaluatedNoOverlapSummary: RuleImpactSummary = {
  ruleId: 'rule5',
  ruleName: 'Engineering - US',
  targetGroups: [targetNoOverlap],
  distinctMemberCount: 12,
  totalHeldSolely: 0,
  emptyRuleInventory: false,
};

/**
 * Read-only "what does this rule hold up?" preview for a group rule, and — in
 * `deactivate` mode — the confirmation gate for deactivating it.
 */
const meta = {
  title: 'Rules/RuleImpactModal',
  component: RuleImpactModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Read-only "what does this rule hold up?" preview for a group rule.\n\n' +
          "Shows a rule's target groups with live member counts and, crucially, how many members are held by this rule **alone** — nobody else's rule explains their membership. Doubles as the confirmation gate for a deactivation: in `deactivate` mode its footer commits the change. Computation is read-only — see `shared/membership/ruleImpact`.\n\n" +
          'It used to call that population "lose access" in both modes, which was wrong for the only verb it can perform (D-052): deactivating a rule removes nobody, it merely leaves those members unattributed. Removal exists only on delete, via `removeUsers`, irreversibly.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), [Shared utilities](?path=/docs/internals-shared-utilities--docs)',
      },
    },
  },
  argTypes: {
    isOpen: { description: 'Whether the modal is shown.' },
    ruleName: { description: 'The rule name being analyzed (for the header/copy).' },
    mode: { description: 'Preview vs deactivation-confirmation intent.' },
    status: { description: 'Async status of the capture.' },
    summary: { description: 'The captured summary once available.' },
    error: { description: "Error message when `status === 'error'`." },
    progress: { description: 'Load progress while capturing.' },
    onClose: { description: 'Close/cancel the modal.' },
    onConfirmDeactivate: {
      description: 'Commit the deactivation (only used in `deactivate` mode).',
    },
    onNavigateToGroup: {
      description: "Jump to a target group in the Groups tab (reverse of A2's rule deep-link).",
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

/** Deactivation-confirmation gate: nobody is removed, N become unattributed. */
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

/** A large solely-held list, exercising the per-group "and N more…" overflow. */
export const LargeSoleHoldList: Story = {
  args: { ruleName: 'Engineering - EU', summary: mockLargeSummary },
};

/**
 * D-047: the org genuinely has no other group rules, so there was nothing to
 * check this rule against — distinct from `EvaluatedNoOverlap` below, which
 * reads identically on the stat tile alone (`totalHeldSolely` is 0 either way).
 */
export const NoOtherRulesInOrg: Story = {
  args: { ruleName: 'Only Rule', summary: mockNoRuleInventorySummary },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(
      canvas.getByText(
        'This org has no other group rules, so there was nothing to check this rule against.',
      ),
    ).toBeVisible();
    await expect(
      canvas.queryByText(/Checked against every other group rule in the org/),
    ).not.toBeInTheDocument();
  },
};

/**
 * D-047: other group rules exist and were checked against this one — none of
 * them collide. Same `totalHeldSolely` as `NoOtherRulesInOrg` above, but a
 * different fact, so the copy must not read the same.
 */
export const EvaluatedNoOverlap: Story = {
  args: { summary: mockEvaluatedNoOverlapSummary },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(
      canvas.getByText(
        'Checked against every other group rule in the org — none collide with this one.',
      ),
    ).toBeVisible();
    await expect(canvas.queryByText(/no other group rules/)).not.toBeInTheDocument();
  },
};
