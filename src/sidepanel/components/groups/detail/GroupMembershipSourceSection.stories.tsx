import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupMembershipSourceSection from './GroupMembershipSourceSection';
import type { MemberSourceBreakdown } from '../../../../shared/membership/groupSource';

/** Two Okta-attributed rules, one shared member, one manual add. */
const analyzed: MemberSourceBreakdown = {
  total: 70,
  direct: 1,
  ruleBased: 69,
  unattributed: 0,
  byRule: [
    { ruleId: '0prFAKE1', ruleName: 'Eng — full-time', count: 45 },
    { ruleId: '0prFAKE2', ruleName: 'Eng — contract', count: 25 },
  ],
  byRuleMembers: [
    {
      ruleId: '0prFAKE1',
      ruleName: 'Eng — full-time',
      soleCount: 44,
      oktaAttributedCount: 45,
      clientAttributedCount: 0,
    },
    {
      ruleId: '0prFAKE2',
      ruleName: 'Eng — contract',
      soleCount: 24,
      oktaAttributedCount: 25,
      clientAttributedCount: 0,
    },
  ],
  multiRuleMembers: 1,
};

/** One rule Okta attributed, one the client-side heuristic only deduced. */
const partlyInferred: MemberSourceBreakdown = {
  total: 30,
  direct: 4,
  ruleBased: 26,
  unattributed: 3,
  byRule: [
    { ruleId: '0prFAKE1', ruleName: 'All employees', count: 20 },
    { ruleId: '0prFAKE3', ruleName: 'Legacy import', count: 6 },
  ],
  byRuleMembers: [
    {
      ruleId: '0prFAKE1',
      ruleName: 'All employees',
      soleCount: 20,
      oktaAttributedCount: 20,
      clientAttributedCount: 0,
    },
    {
      ruleId: '0prFAKE3',
      ruleName: 'Legacy import',
      soleCount: 3,
      oktaAttributedCount: 0,
      clientAttributedCount: 6,
    },
  ],
  multiRuleMembers: 0,
};

const meta = {
  title: 'Groups/GroupMembershipSourceSection',
  component: GroupMembershipSourceSection,
  tags: ['autodocs'],
  parameters: {
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          'Section 2 of the Group Detail view: "where do these members come from?"\n\n' +
          'The analysis costs one paginated read of every member, so it is gated behind a button rather than run on mount — ' +
          'hence the idle / loading / error / done states. Once done it renders the per-rule `MemberSourceMeter` plus the ' +
          '"Attributed to" list, where a rule Okta itself attributed and one the client-side heuristic merely deduced carry ' +
          'different chips: a guess must never read as a fact.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
      },
    },
  },
  argTypes: {
    memberCount: { description: 'Member count, used for the cost estimate on the gate button.' },
    breakdown: { description: 'The analyzed split, once the analysis has completed.' },
    status: { description: 'Status of the gated analysis (`idle`/`loading`/`done`/`error`).' },
    error: { description: 'Error message when the analysis failed.' },
    canAnalyze: { description: '`false` when no Okta tab is connected; disables the gate.' },
  },
  args: {
    memberCount: 70,
    breakdown: null,
    status: 'idle',
    error: null,
    onAnalyze: fn(),
    onNavigateToRule: fn(),
  },
} satisfies Meta<typeof GroupMembershipSourceSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Not analyzed yet: the gate states what running it costs. */
export const Default: Story = {};

/** No Okta tab connected, so the analysis cannot run. */
export const Disabled: Story = { args: { canAnalyze: false } };

/** Reading and classifying every member. */
export const Loading: Story = { args: { status: 'loading' } };

/** The analysis failed and offers a retry. */
export const ErrorState: Story = {
  args: { status: 'error', error: 'Members could not be read.' },
};

/** Analyzed: one meter segment per rule, plus the deep-linkable rule list. */
export const Analyzed: Story = { args: { status: 'done', breakdown: analyzed } };

/** A rule Okta attributed next to one only inferred client-side. */
export const InferredAttribution: Story = {
  args: { status: 'done', breakdown: partlyInferred },
};

/** An empty group: nothing to attribute, and no analysis on offer. */
export const Empty: Story = { args: { memberCount: 0 } };
