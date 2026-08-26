import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import type { FormattedRule } from '../../shared/types';
import RuleCard from './RuleCard';
import { NavigationProvider } from '../contexts/NavigationContext';

/**
 * Target groups render as `EntityLink` chips, which need a navigation host to be
 * openable — without one every chip degrades to plain text, which would hide the
 * very affordance these stories exist to show.
 */
const navigationHandlers = { rule: fn(), group: fn(), user: fn(), app: fn(), policy: fn() };

const baseRule: FormattedRule = {
  id: '00rABCDEF1234567890',
  name: 'Engineering – Auto-assign by department',
  status: 'ACTIVE',
  condition: 'user.department == "Engineering"',
  conditionExpression: 'user.department == "Engineering"',
  groupIds: ['00g1a2b3c4d5e6f7g8h9', '00g9z8y7x6w5v4u3t2s1'],
  groupNames: ['Engineering – All', 'Slack – Eng Channel'],
  allGroupNamesMap: {
    '00g1a2b3c4d5e6f7g8h9': 'Engineering – All',
    '00g9z8y7x6w5v4u3t2s1': 'Slack – Eng Channel',
  },
  userAttributes: ['department'],
  created: '2024-01-15T09:00:00.000Z',
  lastUpdated: '2026-06-01T14:30:00.000Z',
  affectsCurrentGroup: false,
};

/**
 * Expandable card summarising a single Okta group rule, with activate/deactivate
 * and "View in Okta" actions in its expanded detail view.
 */
const meta = {
  title: 'Rules/RuleCard',
  component: RuleCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Expandable card summarising a single Okta group rule.\n\n' +
          'The collapsed view shows the rule name, an ACTIVE/INACTIVE status badge, current-group/conflict badges, and the condition. Expanding reveals the condition expression (with inline group-name badges), referenced user attributes, target groups, conflict details, metadata, and the activate/deactivate plus "View in Okta" actions. A deep-linked rule auto-expands and flashes on arrival. Memoised for list rendering.\n\n' +
          '**A target group is named, or it is stated as un-named.** Every group — in the condition expression and under THEN ADD TO GROUPS — is a shared `EntityLink` chip that opens the group and copies its raw id. When no name was resolved, the card says "Group name not loaded" beside the copyable id instead of printing the id where a name belongs: an unresolved group used to be indistinguishable from a group actually called `00g1a2b3…`.\n\n' +
          '**Related internals:** [EntityLink](?path=/docs/shared-entitylink--docs)',
      },
    },
  },
  decorators: [
    (Story) => (
      <NavigationProvider handlers={navigationHandlers}>
        <Story />
      </NavigationProvider>
    ),
  ],
  argTypes: {
    rule: { description: 'The formatted rule to display.' },
    onActivate: {
      description: 'Called with the rule id when the user activates an inactive rule.',
    },
    onDeactivate: {
      description: 'Called with the rule id when the user deactivates an active rule.',
    },
    onPreviewImpact: {
      description: 'Called with the rule when the user opens its read-only impact preview.',
    },
    onAddTargetGroup: {
      description: 'Called with the rule to start the "add target group" consolidation (A4).',
    },
    oktaOrigin: {
      description: 'Okta org origin used to build the "View in Okta" rules-page link.',
    },
    isHighlighted: {
      description: 'When true, the card auto-expands and flashes on arrival (deep-link target).',
    },
  },
  args: {
    rule: baseRule,
    onActivate: fn(),
    onDeactivate: fn(),
    onPreviewImpact: fn(),
    onAddTargetGroup: fn(),
    oktaOrigin: 'https://dev-12345.okta.com',
    isHighlighted: false,
  },
} satisfies Meta<typeof RuleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Collapsed, active rule with no conflicts. */
export const Default: Story = {};

/**
 * Highlighted deep-link target — auto-expands, flashes on arrival, and shows all
 * detail sections, including the metadata row's copyable rule id. That copy control
 * is named after the rule, since a list can have several cards expanded at once.
 */
export const Expanded: Story = {
  args: { isHighlighted: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', {
        name: `Copy rule id for ${baseRule.name}`,
      }),
    ).toBeInTheDocument();
  },
};

/**
 * Every target group resolved to a name: each is an openable chip, with a copy
 * control named after the *id* rather than the group, since two groups on one card
 * can share a display name.
 */
export const NamedTargetGroups: Story = {
  args: { isHighlighted: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Open group Engineering – All' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: `Copy group id ${baseRule.groupIds[0]}` }),
    ).toBeInTheDocument();
  },
};

/**
 * The same rule with **no names resolved** for its target groups. The card states
 * the gap — "Group name not loaded" — and puts the raw id in the identifier
 * register beside its copy control, rather than printing the id where a name
 * belongs. Nothing here fetches, so the name cannot be filled in at render time.
 */
export const UnresolvedTargetGroups: Story = {
  args: {
    isHighlighted: true,
    rule: { ...baseRule, groupNames: undefined, allGroupNamesMap: {} },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('Group name not loaded')).toHaveLength(2);
    await expect(
      canvas.getByRole('button', { name: `Copy group id ${baseRule.groupIds[1]}` }),
    ).toBeInTheDocument();
    // No name, so nothing claims to open the group.
    await expect(canvas.queryByRole('button', { name: /^Open group/ })).not.toBeInTheDocument();
  },
};

/**
 * A condition expression that names a group by id. The literal is replaced by the
 * chip it resolves to — the same trade `RuleExpressionText` makes for the Group
 * Detail clause view, so the app's two renderers of rule conditions read alike.
 */
export const ConditionNamesAGroup: Story = {
  args: {
    isHighlighted: true,
    rule: {
      ...baseRule,
      condition: 'isMemberOfAnyGroup("00g1a2b3c4d5e6f7g8h9")',
      conditionExpression: 'isMemberOfAnyGroup("00g1a2b3c4d5e6f7g8h9")',
    },
  },
};

/** Rule that assigns to the group currently being viewed — shows the "Current Group" badge. */
export const AffectsCurrentGroup: Story = {
  args: {
    isHighlighted: true,
    rule: { ...baseRule, affectsCurrentGroup: true },
  },
};

/** Expanded view with a detected conflict against another rule. */
export const WithConflicts: Story = {
  args: {
    isHighlighted: true,
    rule: {
      ...baseRule,
      conflicts: [
        {
          rule1: { id: baseRule.id, name: baseRule.name },
          rule2: { id: '00rZYXWVUT0987654321', name: 'Contractors – Auto-assign by department' },
          reason: 'Both rules assign users to "Engineering – All" based on overlapping conditions.',
          severity: 'high',
          affectedGroups: ['00g1a2b3c4d5e6f7g8h9'],
        },
      ],
    },
  },
};

/** Inactive rule — collapsed dot is neutral grey and the primary action becomes "Activate Rule". */
export const Inactive: Story = {
  args: {
    rule: { ...baseRule, status: 'INACTIVE' },
  },
};

/** No `oktaOrigin`, `onPreviewImpact`, or `onAddTargetGroup` — the optional action buttons are hidden. */
export const MinimalActions: Story = {
  args: {
    isHighlighted: true,
    oktaOrigin: null,
    onPreviewImpact: undefined,
    onAddTargetGroup: undefined,
  },
};
