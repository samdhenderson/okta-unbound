import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupRulesSection from './GroupRulesSection';
import { NavigationProvider } from '../../../contexts/NavigationContext';
import type { FormattedRule } from '../../../../shared/types';

/** Obviously fake ids and names — no real org data ever ships in a story. */
const GROUP_NAMES: Record<string, string> = {
  '00gFAKEGROUP0001': 'Engineering — Platform',
  '00gFAKEGROUP0002': 'Contractors — EMEA',
};

const rule = (
  over: Partial<FormattedRule> & Pick<FormattedRule, 'id' | 'name'>,
): FormattedRule => ({
  status: 'ACTIVE',
  condition: 'department == "Engineering"',
  conditionExpression: 'user.department == "Engineering"',
  groupIds: ['00gFAKEGROUP0001'],
  userAttributes: ['department'],
  created: '2024-01-01T00:00:00.000Z',
  lastUpdated: '2025-01-01T00:00:00.000Z',
  ...over,
});

const assigningRules: FormattedRule[] = [
  rule({ id: '0prFAKE1', name: 'Engineering intake' }),
  rule({
    id: '0prFAKE2',
    name: 'Platform contractors',
    condition: 'in Contractors — EMEA and department is Platform',
    conditionExpression: 'isMemberOfAnyGroup("00gFAKEGROUP0002") AND user.department == "Platform"',
    allGroupNamesMap: GROUP_NAMES,
  }),
];

const referencingRules: FormattedRule[] = [
  rule({
    id: '0prFAKE3',
    name: 'Contractors gate',
    status: 'INACTIVE',
    condition: 'in Engineering — Platform',
    conditionExpression: 'isMemberOfAnyGroup("00gFAKEGROUP0001")',
    allGroupNamesMap: GROUP_NAMES,
  }),
];

const meta = {
  title: 'Groups/GroupRulesSection',
  component: GroupRulesSection,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The two rule relationships a group can have, listed separately: rules that **assign members into** it, and rules that merely **consult** it in a condition. Those are opposite facts, so they never share a count.\n\n' +
          'Each row is the same `RuleCard` the Rules tab renders, and pressing it deep-links to that rule’s detail rung. Under the row sits a read-only **When** line carrying the condition expression, so "what does that rule actually say?" is answered without leaving the Group tab (I-031). Group ids inside the expression resolve to named badges through the shared `RuleExpressionText`.\n\n' +
          'The section wires **no write verb at all** — it cannot activate, deactivate or create a rule, and it renders no control that would pretend otherwise (ADR-0039). Each list carries its own loading, empty and error state.',
      },
    },
  },
  // The badges inside a condition only navigate when a host supplies a handler;
  // this mirrors Group Detail, where pressing a resolved group opens it.
  decorators: [
    (Story) => (
      <NavigationProvider handlers={{ group: fn() }}>
        <Story />
      </NavigationProvider>
    ),
  ],
  argTypes: {
    assigningRules: { description: 'Rules whose `assignUserToGroups` targets this group.' },
    assigningStatus: { description: 'Status of the assigning-rules load.' },
    assigningError: { description: 'Error message when the assigning-rules load failed.' },
    referencingRules: {
      description: 'Rules whose condition expression names this group by id.',
    },
    referencingStatus: { description: 'Status of the referencing-rules load.' },
    referencingError: { description: 'Error message when the referencing-rules load failed.' },
    onNavigateToRule: {
      description: "Opens a rule's detail rung on the Rules tab. Pressing a row is the jump.",
    },
  },
  args: {
    assigningRules,
    assigningStatus: 'done',
    assigningError: null,
    referencingRules,
    referencingStatus: 'done',
    referencingError: null,
    onNavigateToRule: fn(),
  },
} satisfies Meta<typeof GroupRulesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Both relationships populated. Every row states its condition in place; the second
 * assigning rule and the referencing rule resolve a group id to a named badge.
 */
export const Default: Story = {};

/**
 * A single rule whose condition reads a group by id. The **When** line is the whole
 * point: the expression is on screen without a press and without a tab change.
 */
export const ConditionInPlace: Story = {
  args: {
    assigningRules: [assigningRules[1]],
    referencingRules: [],
  },
};

/** Neither relationship exists — two distinct facts, and no create control. */
export const NoRules: Story = {
  args: {
    assigningRules: [],
    referencingRules: [],
  },
};

/** One axis still loading while the other has already answered. */
export const LoadingOneAxis: Story = {
  args: {
    referencingStatus: 'loading',
    referencingRules: [],
  },
};

/** One axis failed; the other keeps its rules rather than disappearing with it. */
export const OneAxisFailed: Story = {
  args: {
    referencingStatus: 'error',
    referencingError: 'Rules listing unavailable',
    referencingRules: [],
  },
};

/** No navigation handler: the rows are inert by design, but still state their conditions. */
export const NoDeepLink: Story = {
  args: { onNavigateToRule: undefined },
};
