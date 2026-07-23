import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { FormattedRule } from '../../../shared/types';
import RulesListPanel from './RulesListPanel';

const sampleRules: FormattedRule[] = [
  {
    id: '00rABCDEF1234567890',
    name: 'Engineering – Auto-assign by department',
    status: 'ACTIVE',
    condition: 'user.department == "Engineering"',
    conditionExpression: 'user.department == "Engineering"',
    groupIds: ['00g1a2b3c4d5e6f7g8h9', '00g9z8y7x6w5v4u3t2s1'],
    groupNames: ['Engineering – All', 'Slack – Eng Channel'],
    userAttributes: ['department'],
    created: '2024-01-15T09:00:00.000Z',
    lastUpdated: '2026-06-01T14:30:00.000Z',
    affectsCurrentGroup: true,
  },
  {
    id: '00rZYXWVUT0987654321',
    name: 'Contractors – Auto-assign by user type',
    status: 'INACTIVE',
    condition: 'user.userType == "Contractor"',
    conditionExpression: 'user.userType == "Contractor"',
    groupIds: ['00g5f6g7h8i9j0k1l2m3'],
    groupNames: ['Contractors – All'],
    userAttributes: ['userType'],
    created: '2023-11-02T12:00:00.000Z',
    lastUpdated: '2025-03-20T10:15:00.000Z',
  },
  {
    id: '00rLMNOPQR1122334455',
    name: 'Sales – Auto-assign by division',
    status: 'ACTIVE',
    condition: 'user.division == "Sales"',
    conditionExpression: 'user.division == "Sales"',
    groupIds: ['00g6g7h8i9j0k1l2m3n4'],
    groupNames: ['Sales – All'],
    userAttributes: ['division'],
    created: '2024-05-10T08:00:00.000Z',
    lastUpdated: '2026-02-14T16:45:00.000Z',
  },
];

/** The Rules tab's list region: loading, empty, and populated states. */
const meta = {
  title: 'Rules/RulesListPanel',
  component: RulesListPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "The Rules tab's list region, switching between four states.\n\n" +
          'Shows a spinner while loading; a "Load Rules" call-to-action empty state when nothing is loaded yet; a "no match" empty state when a search/filter excludes every rule; otherwise the filtered `RuleCard` list. Each card is wrapped in a `data-rule-id` anchor so a deep-linked rule can be scrolled to and highlighted.',
      },
    },
  },
  argTypes: {
    isLoading: { description: 'Whether a load is in flight.' },
    hasRules: {
      description:
        'Whether any rules are loaded at all (drives the "load" vs "no match" empty state).',
    },
    filteredRules: { description: 'Rules after search + filter.' },
    onLoad: { description: 'Load rules (used by the empty-state action).' },
    onActivate: { description: 'Activate an inactive rule.' },
    onDeactivate: {
      description: 'Request deactivation (gated behind the impact confirm upstream).',
    },
    onPreviewImpact: { description: 'Open the read-only impact preview for a rule.' },
    onAddTargetGroup: {
      description: 'Start the "add target group" consolidation for a rule (A4).',
    },
    oktaOrigin: { description: 'Okta origin for each card\'s "View in Okta" link.' },
    selectedRuleId: { description: 'Rule id to highlight/scroll to (deep-link target).' },
  },
  args: {
    isLoading: false,
    hasRules: true,
    filteredRules: sampleRules,
    onLoad: fn(),
    onActivate: fn(),
    onDeactivate: fn(),
    onPreviewImpact: fn(),
    onAddTargetGroup: fn(),
    oktaOrigin: 'https://example.okta.com',
    selectedRuleId: null,
  },
} satisfies Meta<typeof RulesListPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Populated list of rule cards. */
export const Default: Story = {};

/** A spinner while rules are loading. */
export const Loading: Story = {
  args: { isLoading: true },
};

/** No rules have been loaded yet — "Load Rules" call-to-action empty state. */
export const NoRulesLoaded: Story = {
  args: { hasRules: false, filteredRules: [] },
};

/** Rules are loaded, but none match the current search/filter — "no match" empty state. */
export const NoMatchingRules: Story = {
  args: { filteredRules: [] },
};

/** A deep-link target rule is highlighted and auto-expanded. */
export const WithSelectedRule: Story = {
  args: { selectedRuleId: sampleRules[0].id },
};

/** No `oktaOrigin` — cards hide the "View in Okta" action. */
export const WithoutOktaOrigin: Story = {
  args: { oktaOrigin: null },
};
