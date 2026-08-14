import type { Meta, StoryObj } from '@storybook/react-vite';
import GroupListItemSignal from './GroupListItemSignal';
import { summarizeGroupRow } from './groupSourceSummary';
import type { GroupSummary } from '../../../shared/types';
import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';

const group: GroupSummary = {
  id: '00gFAKE000000000001',
  name: 'Engineering',
  description: 'All engineering staff.',
  type: 'OKTA_GROUP',
  memberCount: 70,
  hasRules: true,
  ruleCount: 2,
  usedInRuleCount: 1,
};

/** One rule's counts, all Okta-attributed. */
const rule = (ruleId: string, ruleName: string, soleCount: number) => ({
  ruleId,
  ruleName,
  soleCount,
  oktaAttributedCount: soleCount,
  clientAttributedCount: 0,
});

const twoRules: MemberSourceBreakdown = {
  total: 70,
  direct: 1,
  ruleBased: 69,
  unattributed: 0,
  byRule: [],
  byRuleMembers: [rule('0prFAKE1', 'Eng — full-time', 44), rule('0prFAKE2', 'Eng — contract', 24)],
  multiRuleMembers: 1,
};

const manyRules: MemberSourceBreakdown = {
  total: 96,
  direct: 6,
  ruleBased: 90,
  unattributed: 0,
  byRule: [],
  byRuleMembers: [
    rule('0prFAKE1', 'Engineering', 30),
    rule('0prFAKE2', 'Sales', 25),
    rule('0prFAKE3', 'Support', 20),
    rule('0prFAKE4', 'Finance', 10),
    rule('0prFAKE5', 'Legal', 5),
  ],
  multiRuleMembers: 0,
};

const meta = {
  title: 'Groups/GroupListItemSignal',
  component: GroupListItemSignal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          "The one-line signal region of a group row: the compact member-source bar, the exact member count, what the source split says, and the group's rule/push facts.\n\n" +
          'The 56px bar draws one slice per attributing rule (three named rules, then an aggregated tail) with a minimum slice ' +
          'width so a single shared member is still visible. Its *text* deliberately stays coarser — `Rule-managed / Manual / ' +
          'Indeterminate` — because rule names are unbounded and a list row is not; the full per-segment detail is in the bar ' +
          'tooltip. The bar is `aria-hidden`, so nothing is available only as colour.\n\n' +
          'A row never fetches: it renders a bar only from a breakdown already banked in the session cache, and otherwise says ' +
          '"Source not analyzed" rather than showing an empty meter.',
      },
    },
  },
  argTypes: {
    model: { description: 'The derived row model from `groupSourceSummary.summarizeGroupRow`.' },
  },
  args: { model: summarizeGroupRow(group, twoRules) },
} satisfies Meta<typeof GroupListItemSignal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two feeding rules plus one member both rules claim. */
export const Default: Story = {};

/** More rules than the compact bar names: the rest aggregate into the tail. */
export const ManyRules: Story = { args: { model: summarizeGroupRow(group, manyRules) } };

/** Nothing computed for this group yet — the row says so instead of guessing. */
export const NotAnalyzed: Story = { args: { model: summarizeGroupRow(group, null) } };

/** An empty group: no meter, no claim about sources. */
export const Empty: Story = {
  args: { model: summarizeGroupRow({ ...group, memberCount: 0 }, null) },
};
