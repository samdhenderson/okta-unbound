import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import AttributeSpreadSection from './AttributeSpreadSection';
import type { FeedingRule } from '../../../hooks/useGroupSource';
import type { OktaUser } from '../../../../shared/types';

/**
 * Forty members carrying one attribute per ranking signal: `department` is
 * spelled two ways *and* feeds a rule (4 + 1), `costCenter` folds three of its
 * nine values into a tail holding 30% of the group (2), and `userType` is
 * unremarkable (0).
 */
const members: OktaUser[] = Array.from({ length: 40 }, (_, i) => ({
  id: `member${i + 1}`,
  status: 'ACTIVE',
  profile: {
    login: `member${i + 1}@example.com`,
    email: `member${i + 1}@example.com`,
    firstName: `First${i + 1}`,
    lastName: `Last${i + 1}`,
    department: i < 25 ? 'Engineering' : i < 28 ? 'engineering' : 'Product',
    costCenter: `CC-${100 + (i % 9)}`,
    userType: i % 4 === 0 ? 'CONTRACTOR' : 'EMPLOYEE',
  },
}));

const feedingRules: FeedingRule[] = [
  {
    id: '0prFAKE1',
    name: 'Eng & Product — full-time',
    status: 'ACTIVE',
    userAttributes: ['department'],
    condition: 'department in {"Engineering", "Product"}',
    conditionExpression: 'user.department in {"Engineering", "Product"}',
    groupIds: ['00gFAKE1'],
    created: '2024-01-01T00:00:00.000Z',
    lastUpdated: '2025-01-01T00:00:00.000Z',
  },
];

const meta = {
  title: 'Groups/AttributeSpreadSection',
  component: AttributeSpreadSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The Insights tab's ranked stack of attribute cards, and the gate in front of the " +
          'roster it needs.\n\n' +
          '**Rule coupling ranks, it does not partition.** Three signals order the stack: ' +
          'near-duplicate spellings (weight 4), a hidden tail carrying a fifth of the group or ' +
          'more (2), and rule coupling (1). Coupling is deliberately lightest — an attribute ' +
          'spelled two ways outranks an immaculate one that merely feeds a rule, because the ' +
          'drift is what will break the rule. The partition this replaced sorted the ' +
          'mis-spelled attribute *last*, precisely because nobody had written a rule against ' +
          'it yet.\n\n' +
          '**One anatomy on both sides of the split.** Attributes with no signal render in the ' +
          'identical card under a **Nothing flagged** rule. That rule is a label on the ' +
          '*order*, not a second card shape: a reader learns one anatomy and reads top to ' +
          'bottom.\n\n' +
          '**Storybook renders no Tailwind**, so nothing here asserts the grid, the spread ' +
          'bars, or the hatch — those are visual claims verified by eye.',
      },
    },
  },
  args: {
    memberCount: members.length,
    members,
    memberStatus: 'done',
    error: null,
    onAnalyzeMembers: fn(),
    feedingRules,
    onNavigateToRule: fn(),
    onShowAll: fn(),
  },
} satisfies Meta<typeof AttributeSpreadSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The ranking, and the line that explains it: drift first, then the hidden tail,
 * then the quiet attribute under its own rule.
 */
export const Ranked: Story = {
  play: async ({ canvas }) => {
    // Every card's reason is legible without opening it.
    await expect(canvas.getByText('2 near-duplicate values')).toBeVisible();
    await expect(canvas.getByText('A rule depends on it')).toBeVisible();
    await expect(canvas.getByText('30% hidden in the tail')).toBeVisible();

    // Drift + coupling outrank a tail, so `department` leads.
    const keys = canvas
      .getAllByRole('button', { name: /^Show the value breakdown for/ })
      .map((button) => button.getAttribute('aria-label'));
    await expect(keys[0]).toBe('Show the value breakdown for department');
    await expect(keys[1]).toBe('Show the value breakdown for costCenter');

    // The quiet attribute is labelled, not hidden and not reshaped.
    const quiet = canvas.getByRole('group', { name: 'Nothing flagged' });
    await expect(within(quiet).getByText('userType')).toBeVisible();
  },
};

/** Nothing loaded yet: the cost of the read, stated, behind an explicit Analyze. */
export const Idle: Story = {
  args: { members: null, memberStatus: 'idle' },
};

/** No Okta tab connected, so the gate button cannot be pressed. */
export const IdleDisconnected: Story = {
  args: { members: null, memberStatus: 'idle', canAnalyze: false },
};

/** The roster is loading. */
export const Loading: Story = {
  args: { members: null, memberStatus: 'loading' },
};

/** The roster load failed, and the same call is offered as a retry. */
export const LoadFailed: Story = {
  args: { members: null, memberStatus: 'error', error: 'Okta returned 429.' },
};

/** An empty group: nothing to profile, and it says so rather than showing an empty grid. */
export const NoMembers: Story = {
  args: { members: [], memberCount: 0, memberStatus: 'done' },
};

/**
 * Every attribute is unique per member, so none has a spread worth reporting.
 * A real answer, not an error.
 */
export const NothingWorthReporting: Story = {
  args: {
    members: Array.from({ length: 20 }, (_, i) => ({
      id: `u${i}`,
      status: 'ACTIVE',
      profile: {
        login: `u${i}@example.com`,
        email: `u${i}@example.com`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
      },
    })),
    memberCount: 20,
    memberStatus: 'done',
  },
};

/**
 * Nothing is flagged anywhere. There is no rule to draw, because a divider with
 * nothing above it labels an order that does not exist.
 */
export const AllQuiet: Story = {
  args: {
    feedingRules: [],
    members: Array.from({ length: 20 }, (_, i) => ({
      id: `q${i}`,
      status: 'ACTIVE',
      profile: {
        login: `q${i}@example.com`,
        email: `q${i}@example.com`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
        department: i % 2 === 0 ? 'Engineering' : 'Sales',
      },
    })),
    memberCount: 20,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('department')).toBeVisible();
    await expect(canvas.queryByRole('group', { name: 'Nothing flagged' })).toBeNull();
  },
};
