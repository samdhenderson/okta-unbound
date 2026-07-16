import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { FormattedRule } from '../../shared/types';
import RuleCard from './RuleCard';

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
  title: 'Sidepanel/RuleCard',
  component: RuleCard,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
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

/** Highlighted deep-link target — auto-expands with a ring and shows all detail sections. */
export const Expanded: Story = {
  args: { isHighlighted: true },
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
