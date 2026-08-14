import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { FormattedRule } from '../../../shared/types';
import CurrentGroupRuleRelations from './CurrentGroupRuleRelations';

const CURRENT_GROUP = '00gCURRENTFAKE000001';
const OTHER_GROUP = '00gOTHERFAKE00000002';

/** Assigns users into the current group — relation (A). */
const assigningRule: FormattedRule = {
  id: '00rABCDEF1234567890',
  name: 'Engineering – Auto-assign by department',
  status: 'ACTIVE',
  condition: 'user.department == "Engineering"',
  conditionExpression: 'user.department=="Engineering"',
  groupIds: [CURRENT_GROUP],
  groupNames: ['Engineering – All'],
  userAttributes: ['department'],
  created: '2024-01-15T09:00:00.000Z',
  lastUpdated: '2026-06-01T14:30:00.000Z',
};

/** Reads the current group in its condition to feed a different group — relation (B). */
const referencingRule: FormattedRule = {
  id: '00rZYXWVUT0987654321',
  name: 'Slack – Eng channel from Engineering membership',
  status: 'ACTIVE',
  condition: 'member of Engineering – All',
  conditionExpression: `isMemberOfAnyGroup("${CURRENT_GROUP}")`,
  groupIds: [OTHER_GROUP],
  groupNames: ['Slack – Eng Channel'],
  userAttributes: [],
  created: '2023-11-02T12:00:00.000Z',
  lastUpdated: '2025-03-20T10:15:00.000Z',
};

/** Both directions at once: reads the group, and assigns back into it. */
const bothRule: FormattedRule = {
  id: '00rLMNOPQR1122334455',
  name: 'Engineering – Re-assert employees',
  status: 'INACTIVE',
  condition: 'member of Engineering – All and userType is Employee',
  conditionExpression: `isMemberOfGroup("${CURRENT_GROUP}") AND user.userType=="Employee"`,
  groupIds: [CURRENT_GROUP],
  groupNames: ['Engineering – All'],
  userAttributes: ['userType'],
  created: '2025-02-01T08:00:00.000Z',
  lastUpdated: '2026-04-11T11:05:00.000Z',
};

/** A rule with no relation to the current group at all. */
const unrelatedRule: FormattedRule = {
  id: '00rQQQQQQQ5566778899',
  name: 'Contractors – Auto-assign by user type',
  status: 'ACTIVE',
  condition: 'user.userType == "Contractor"',
  conditionExpression: 'user.userType=="Contractor"',
  groupIds: [OTHER_GROUP],
  groupNames: ['Contractors – All'],
  userAttributes: ['userType'],
  created: '2023-06-06T12:00:00.000Z',
  lastUpdated: '2025-01-09T09:20:00.000Z',
};

/** The current group's two rule relationships, listed apart. */
const meta = {
  title: 'Rules/CurrentGroupRuleRelations',
  component: CurrentGroupRuleRelations,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The two opposite ways a loaded rule can touch the group open in Okta, never merged into one count or one filter.\n\n' +
          "**Assigns members into this group** — the group is in the rule's `assignUserToGroups` targets, so the rule feeds it. **References this group by ID in a condition** — the group id appears in an `isMemberOfGroup(…)`/`isMemberOfAnyGroup(…)` call, so the group is an input and nobody is added here. The second list is deliberately subordinate: the first explains why members are here, the second is only a dependency edge.\n\n" +
          "Reference detection covers 2 of Okta's 7 membership functions — the two that take group **ids**. The five name-based variants (`isMemberOfGroupName`, `isMemberOfAnyGroupName`, `…NameStartsWith`, `…NameContains`, `…NameRegex`) take names that can resolve to groups this extension never sees, so a rule matching on name reads the group and still will not be listed. The section copy says so; do not remove that caveat.",
      },
    },
  },
  argTypes: {
    rules: { description: 'Every rule currently loaded in the tab (unfiltered).' },
    currentGroupId: {
      description: 'Id of the group detected on the Okta page; absent renders nothing.',
    },
    onFocusRule: { description: "Scroll to and highlight a rule's card in the list below." },
  },
  args: {
    rules: [assigningRule, referencingRule, bothRule, unrelatedRule],
    currentGroupId: CURRENT_GROUP,
    onFocusRule: fn(),
  },
} satisfies Meta<typeof CurrentGroupRuleRelations>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both relations populated, including a rule that appears in both lists. */
export const Default: Story = {};

/** Only rules that assign into the group — the reference list states its own empty fact. */
export const AssignsOnly: Story = {
  args: { rules: [assigningRule, unrelatedRule] },
};

/** Only rules that read the group in a condition — nothing feeds it automatically. */
export const ReferencesOnly: Story = {
  args: { rules: [referencingRule, unrelatedRule] },
};

/** Neither relation: two different empty statements, no bare zeros. */
export const NoRelations: Story = {
  args: { rules: [unrelatedRule] },
};

/** No group detected on the page — the panel renders nothing. */
export const NoCurrentGroup: Story = {
  args: { currentGroupId: undefined },
};
