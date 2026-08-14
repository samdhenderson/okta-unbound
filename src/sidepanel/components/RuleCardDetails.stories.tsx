import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { FormattedRule } from '../../shared/types';
import RuleCardDetails from './RuleCardDetails';

const baseRule: FormattedRule = {
  id: '00rABCDEF1234567890',
  name: 'Engineering – Auto-assign by department',
  status: 'ACTIVE',
  condition: 'user.department == "Engineering"',
  conditionExpression:
    'user.department == "Engineering" && isMemberOfGroupName("00g1a2b3c4d5e6f7g8h9")',
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
 * The detail panel a `RuleCard` reveals when it is expanded, shown here on its
 * own so each section can be reviewed without the card header around it.
 */
const meta = {
  title: 'Rules/RuleCardDetails',
  component: RuleCardDetails,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The expandable detail panel of a [RuleCard](?path=/docs/rules-rulecard--docs), extracted so the card itself stays a header plus its expand/flash state.\n\n' +
          'It shows the condition expression (with inline group-name badges for recognised `00g…` ids), the referenced user attributes, the target groups, any detected conflicts, the metadata line, and the action row — activate/deactivate, preview impact, add target group, and "View in Okta".\n\n' +
          "It owns the whole `.disclose` wrapper — the element the card header's chevron points `aria-controls` at — so a collapsed panel stays mounted at zero height and `inert`, out of the tab order and the accessibility tree, rather than unmounting. Nothing here fetches.",
      },
    },
  },
  argTypes: {
    rule: { description: 'The formatted rule whose detail is being shown.' },
    detailsId: { description: "`id` of the disclosure region — the chevron's `aria-controls`." },
    isExpanded: { description: 'Whether the card is expanded; drives `.disclose` and `inert`.' },
    oktaOrigin: {
      description: 'Okta org origin used to build the "View in Okta" rules-page link.',
    },
    onActivate: {
      description: 'Called with the rule id when the user activates an inactive rule.',
    },
    onDeactivate: {
      description: 'Called with the rule id when the user deactivates an active rule.',
    },
    onPreviewImpact: {
      description: 'Called with the rule to open its impact preview. Omitting it hides the button.',
    },
    onAddTargetGroup: {
      description: 'Called with the rule to start the consolidation. Omitting it hides the button.',
    },
  },
  args: {
    rule: baseRule,
    detailsId: 'rule-card-details-story',
    isExpanded: true,
    oktaOrigin: 'https://dev-12345.okta.com',
    onActivate: fn(),
    onDeactivate: fn(),
    onPreviewImpact: fn(),
    onAddTargetGroup: fn(),
  },
} satisfies Meta<typeof RuleCardDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every section, on an active rule: condition, attributes, groups, metadata, actions. */
export const Default: Story = {};

/** Collapsed — the panel stays mounted at zero height and `inert`, showing nothing. */
export const Collapsed: Story = {
  args: { isExpanded: false },
};

/** Inactive rule — the primary action becomes "Activate Rule". */
export const Inactive: Story = {
  args: { rule: { ...baseRule, status: 'INACTIVE' } },
};

/** A high-severity conflict against another rule. */
export const WithConflicts: Story = {
  args: {
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

/** No name known for a referenced group id — the expression renders it bare, with no badge. */
export const WithoutGroupNames: Story = {
  args: {
    rule: { ...baseRule, groupNames: undefined, allGroupNamesMap: undefined },
  },
};

/**
 * A rule that names no attributes and targets no groups: those sections drop out
 * entirely, and "Preview Impact" goes with them (there is nothing to preview).
 */
export const MinimalRule: Story = {
  args: {
    rule: { ...baseRule, userAttributes: [], groupIds: [], groupNames: [] },
  },
};

/** No `oktaOrigin`, `onPreviewImpact`, or `onAddTargetGroup` — the optional actions are hidden. */
export const MinimalActions: Story = {
  args: {
    oktaOrigin: null,
    onPreviewImpact: undefined,
    onAddTargetGroup: undefined,
  },
};
