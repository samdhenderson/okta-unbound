import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import RulesTab from './RulesTab';

/**
 * Rules tab shell: browse, search, filter, and manage group rules (rules load
 * on demand via the "Load Rules" button — nothing is fetched automatically).
 */
const meta = {
  title: 'Rules/RulesTab',
  component: RulesTab,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    // heading-order disabled: this story renders the tab as a page fragment out of
    // its heading context (no surrounding app shell), so axe flags the isolated headings.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          'Rules tab shell: browse, search, filter, and manage group rules.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Contexts](?path=/docs/internals-contexts--docs), ' +
          '[Rules engine](?path=/docs/internals-rules-engine--docs), ' +
          '[Scheduler & messaging](?path=/docs/internals-scheduler-messaging--docs)',
      },
    },
  },
  argTypes: {
    targetTabId: {
      description: 'Chrome tab id of the connected Okta tab; required to fetch or mutate rules.',
    },
    currentGroupId: {
      description: 'Id of the currently detected group; enables the "Current Group" filter.',
    },
    oktaOrigin: {
      description: 'Okta org origin passed to each RuleCard for its "View in Okta" link.',
    },
    selectedRuleId: {
      description: 'Rule id to scroll to and highlight when navigated here from another tab.',
    },
    onRuleSelected: {
      description: 'Called once the highlighted rule has been shown, so the parent can clear it.',
    },
    onNavigateToGroup: {
      description: "Deep-link to a group in the Groups tab (from a rule's target groups).",
    },
  },
  args: {
    targetTabId: 1,
    currentGroupId: undefined,
    oktaOrigin: 'https://example.okta.com',
    selectedRuleId: null,
    onRuleSelected: fn(),
    onNavigateToGroup: fn(),
  },
} satisfies Meta<typeof RulesTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Connected Okta tab, no rules loaded yet — shows the header and empty list panel. */
export const Default: Story = {};

/** No Okta tab connected — "Load Rules" will report a connection error. */
export const Disconnected: Story = {
  args: { targetTabId: undefined },
};

/** A group is detected on the page, enabling the "Current Group" filter once rules load. */
export const WithCurrentGroup: Story = {
  args: { currentGroupId: 'group123' },
};

/** Deep-linked from another tab to a specific rule id before any rules are loaded. */
export const DeepLinkedRule: Story = {
  args: { selectedRuleId: 'rule1' },
};
